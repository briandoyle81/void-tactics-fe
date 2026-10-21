"use client";

import React, { useRef, useState } from "react";
import { useAccount } from "wagmi";
import { MAP_ADMIN_ADDRESS } from "../config/alpha";
import { useIsEncounterEditor } from "../hooks/useIsEncounterEditor";
import { useIsNodeMapEditor } from "../hooks/useIsNodeMapEditor";
import { useMissionChainSnapshot } from "../hooks/useMissionChainSnapshot";
import { SHIP_GRANT_ADDRESS } from "../hooks/useShipGrants";
import { buildRewardShipSnapshot, REWARD_SHIP_SNAPSHOT_FILE } from "../utils/rewardShipSnapshot";
import { positionalSeedIds, seedDeploymentIds, type ContentSyncState } from "../utils/seedDeploymentIds";
import { baseSepolia } from "viem/chains";
import type { ShipGrantSpec } from "../utils/shipGrant";
import {
  buildMissionSeedFiles,
  type MissionSeedFiles,
  type PvpSeed,
  type RoguelikeSeed,
  type SinglePlayerSeed,
} from "../utils/missionSeedExport";
import {
  canWriteFiles,
  downloadJson,
  ensureWritable,
  isAbort,
  pickWritableDirectory,
  writeJson,
  type WritableDirectoryHandle,
} from "../utils/jsonFileSave";

// Seed file names in the contracts repo (ignition/data/), read by
// ignition/modules/DeployAndConfig.ts. Where the browser can write files
// (Chromium's File System Access API), the panel opens the repo's ignition/
// folder, reads the seeds and the deployment's record of their on-chain ids
// (deployments/chain-<id>/, see seedDeploymentIds.ts) and saves over the
// seed files in place; elsewhere it reads picked files and downloads under
// the same names, to be dropped over the originals by hand.
const SEED_FILE_NAMES = {
  singlePlayer: "singlePlayerStarterContent.json",
  roguelike: "roguelikeStarterContent.json",
  pvp: "pvpStarterContent.json",
} as const;
type SeedSlot = keyof typeof SEED_FILE_NAMES;

/** The deployment whose ids the export uses (the live chain the panel reads). */
const DEPLOYMENT_FOLDER = `chain-${baseSepolia.id}`;
const JOURNAL_FILE = "journal.jsonl";
const SYNC_STATE_FILE = "content-sync.json";

/** The deployment record: Ignition's journal and the sync script's content-sync.json. */
interface DeploymentRecord {
  journal: string;
  syncState: ContentSyncState | null;
}

const isSyncState = (d: unknown): d is ContentSyncState =>
  !!d && typeof d === "object" && !Array.isArray((d as ContentSyncState).maps) &&
  typeof (d as ContentSyncState).maps === "object";

// The reward ship app copy (app/data/content/rewardShips.json, see
// app/utils/rewardShipSnapshot.ts) lives in this repo, not the contracts
// repo, so it's saved into a second folder.
const CONTENT_FOLDER_NAME = "content";

/** A child folder, or null if there's none by that name. */
async function subfolder(dir: FileSystemDirectoryHandle, name: string): Promise<WritableDirectoryHandle | null> {
  try {
    return (await dir.getDirectoryHandle(name)) as WritableDirectoryHandle;
  } catch {
    return null;
  }
}

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  return (await (await dir.getFileHandle(name)).getFile()).text();
}

async function hasFile(dir: WritableDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Identify a seed file by shape, so a renamed copy still works. */
function seedSlotOf(data: unknown): SeedSlot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.campaignNodes) && Array.isArray(d.aiShipConfigs)) return "singlePlayer";
  if (Array.isArray(d.nodes) && Array.isArray(d.edges) && typeof d.root === "string") return "roguelike";
  if (Array.isArray(d.maps) && Object.keys(d).length === 1) return "pvp";
  return null;
}

// Exports every on-chain mission setting (maps, AI ship configs, enemy
// placements, campaign + roguelike node graphs, node titles, roguelike win
// effects and reward ships) as the three seed files the contracts deploy
// reads, plus the app's reward ship copy. Takes the
// current seed files as input so existing keys stay stable — see
// app/utils/missionSeedExport.ts. Visible to anyone holding at least one of
// the admin roles this page already gates on, since it only aggregates data
// those roles can already see.
export function AdminSettingsExport() {
  const { address } = useAccount();
  const isMapAdmin = address?.toLowerCase() === MAP_ADMIN_ADDRESS.toLowerCase();
  const { isEditor: isEncounterEditor } = useIsEncounterEditor();
  const { isEditor: isNodeEditor } = useIsNodeMapEditor();
  if (!isMapAdmin && !isEncounterEditor && !isNodeEditor) return null;
  // Inner component so the full-chain reads only run for editors.
  return <MissionSeedExportPanel />;
}

function MissionSeedExportPanel() {
  const { snapshot, isLoading, unknownWinEffects } = useMissionChainSnapshot();
  const [baseline, setBaseline] = useState<Partial<MissionSeedFiles>>({});
  // The ignition/data/ folder, when it was opened for writing.
  const [seedDir, setSeedDir] = useState<WritableDirectoryHandle | null>(null);
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [journalName, setJournalName] = useState<string | null>(null);
  // This repo's app/data/content/ folder, for the reward ship app copy.
  const [contentDir, setContentDir] = useState<WritableDirectoryHandle | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResult = () => {
    setFileError(null);
    setWarnings(null);
    setSavedTo(null);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    resetResult();
    const next: Partial<MissionSeedFiles> = { ...baseline };
    let journal = deployment?.journal ?? null;
    let syncState = deployment?.syncState ?? null;
    for (const file of Array.from(fileList)) {
      try {
        if (file.name.endsWith(".jsonl")) {
          journal = await file.text();
          setJournalName(file.name);
          continue;
        }
        const data = JSON.parse(await file.text());
        if (isSyncState(data)) {
          syncState = data;
          continue;
        }
        const slot = seedSlotOf(data);
        if (!slot) {
          setFileError(`${file.name} doesn't look like one of the three seed files.`);
          continue;
        }
        if (slot === "singlePlayer") next.singlePlayer = data as SinglePlayerSeed;
        else if (slot === "roguelike") next.roguelike = data as RoguelikeSeed;
        else next.pvp = data as PvpSeed;
      } catch {
        setFileError(`${file.name} isn't valid JSON.`);
      }
    }
    setBaseline(next);
    setDeployment(journal != null ? { journal, syncState } : null);
  };

  const openSeedFolder = async () => {
    resetResult();
    let picked: WritableDirectoryHandle;
    try {
      picked = await pickWritableDirectory("vt-seed-ignition");
    } catch (e) {
      if (!isAbort(e))
        setFileError(`Couldn't open the folder: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    // The contracts repo's ignition/ folder (or the repo itself): the seeds
    // are in data/, the deployment record in deployments/.
    let dir: WritableDirectoryHandle;
    let ignitionDir: WritableDirectoryHandle;
    try {
      ignitionDir = (await subfolder(picked, "ignition")) ?? picked;
      const data = await subfolder(ignitionDir, "data");
      if (!data) throw new Error("no data/");
      dir = data;
    } catch {
      setSeedDir(null);
      setFileError(`${picked.name}/ isn't the contracts repo's ignition/ folder (it needs data/ and deployments/). Pick ignition/.`);
      return;
    }
    const next: Partial<MissionSeedFiles> = {};
    const problems: string[] = [];
    for (const slot of Object.keys(SEED_FILE_NAMES) as SeedSlot[]) {
      const name = SEED_FILE_NAMES[slot];
      try {
        const data = JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
        if (seedSlotOf(data) !== slot) {
          problems.push(`${name} doesn't look like the ${slot} seed file.`);
          continue;
        }
        if (slot === "singlePlayer") next.singlePlayer = data as SinglePlayerSeed;
        else if (slot === "roguelike") next.roguelike = data as RoguelikeSeed;
        else next.pvp = data as PvpSeed;
      } catch (e) {
        problems.push(
          e instanceof DOMException && e.name === "NotFoundError"
            ? `${name} isn't in ignition/data/. Pick the contracts repo's ignition/ folder.`
            : `${name} couldn't be read: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    // Without a deployment record the export assumes fresh-deploy ids (seed
    // order), which is wrong once content was synced after the deploy.
    let record: DeploymentRecord | null = null;
    try {
      const deployDir = await subfolder(await ignitionDir.getDirectoryHandle("deployments"), DEPLOYMENT_FOLDER);
      if (deployDir) {
        const journal = await readText(deployDir, JOURNAL_FILE);
        const sync = await readText(deployDir, SYNC_STATE_FILE).catch(() => null);
        record = { journal, syncState: sync ? (JSON.parse(sync) as ContentSyncState) : null };
      }
    } catch (e) {
      problems.push(`The deployment record couldn't be read: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBaseline(next);
    setDeployment(record);
    setJournalName(record ? `deployments/${DEPLOYMENT_FOLDER}/${JOURNAL_FILE}` : null);
    setSeedDir(problems.length === 0 ? dir : null);
    if (problems.length > 0) setFileError(problems.join(" "));
  };

  const openContentFolder = async () => {
    resetResult();
    let dir: WritableDirectoryHandle;
    try {
      dir = await pickWritableDirectory("vt-app-content");
    } catch (e) {
      if (!isAbort(e))
        setFileError(`Couldn't open the folder: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    // Only save over the real copy: a stray file elsewhere would leave
    // players on the old one.
    if (dir.name !== CONTENT_FOLDER_NAME || !(await hasFile(dir, REWARD_SHIP_SNAPSHOT_FILE))) {
      setContentDir(null);
      setFileError(
        `That folder isn't app/data/content/ (it needs to hold ${REWARD_SHIP_SNAPSHOT_FILE}). Pick this repo's app/data/content/ folder.`,
      );
      return;
    }
    setContentDir(dir);
  };

  const baselineComplete =
    baseline.singlePlayer != null && baseline.roguelike != null && baseline.pvp != null;

  const handleExport = async () => {
    if (!snapshot || !baselineComplete) return;
    resetResult();
    const seeds = baseline as MissionSeedFiles;
    const saveWarnings: string[] = [];
    let ids = positionalSeedIds(seeds);
    if (deployment) {
      try {
        ids = seedDeploymentIds(seeds, deployment.journal, deployment.syncState);
      } catch (e) {
        setFileError(`The deployment record couldn't be used: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    } else {
      saveWarnings.push(
        `No deployment record (${DEPLOYMENT_FOLDER}/${JOURNAL_FILE}), so ids were taken from seed order, as on a fresh deploy. ` +
          "That's wrong for a chain whose content was synced after the deploy (live Base Sepolia).",
      );
    }
    const { files, warnings: exportWarnings } = buildMissionSeedFiles(snapshot, seeds, ids);
    const grants = new Map<number, ShipGrantSpec>();
    snapshot.roguelike.nodes.forEach((n) => {
      if (n.shipGrant) grants.set(n.id, n.shipGrant);
    });
    const rewardShips = buildRewardShipSnapshot(SHIP_GRANT_ADDRESS, grants);
    if (seedDir) {
      setIsSaving(true);
      try {
        // The grant from the picker can lapse (e.g. after a reload of the
        // page's permissions); ask again rather than fail.
        if (!(await ensureWritable(seedDir))) {
          setFileError("Saving needs write access to the folder.");
          return;
        }
        await writeJson(seedDir, SEED_FILE_NAMES.singlePlayer, files.singlePlayer);
        await writeJson(seedDir, SEED_FILE_NAMES.roguelike, files.roguelike);
        await writeJson(seedDir, SEED_FILE_NAMES.pvp, files.pvp);
        const savedFolders = [`ignition/${seedDir.name}`];
        if (contentDir && (await ensureWritable(contentDir))) {
          await writeJson(contentDir, REWARD_SHIP_SNAPSHOT_FILE, rewardShips);
          savedFolders.push(contentDir.name);
        } else {
          saveWarnings.push(
            `${REWARD_SHIP_SNAPSHOT_FILE} wasn't saved: open this repo's app/data/content/ folder and save again.`,
          );
        }
        // The saved files are the folder's contents now, so a second save
        // builds on them.
        setBaseline(files);
        setSavedTo(savedFolders.map((name) => `${name}/`).join(" and "));
      } catch (e) {
        setFileError(`Saving failed: ${e instanceof Error ? e.message : String(e)}`);
        return;
      } finally {
        setIsSaving(false);
      }
    } else {
      downloadJson(SEED_FILE_NAMES.singlePlayer, files.singlePlayer);
      downloadJson(SEED_FILE_NAMES.roguelike, files.roguelike);
      downloadJson(SEED_FILE_NAMES.pvp, files.pvp);
      downloadJson(REWARD_SHIP_SNAPSHOT_FILE, rewardShips);
    }
    setWarnings([
      ...saveWarnings,
      ...exportWarnings,
      ...unknownWinEffects.map(
        (a) => `Win effect ${a} isn't a known effect contract on this chain and was left out.`,
      ),
    ]);
  };

  const writable = canWriteFiles();

  return (
    <div className="mt-8 space-y-3 border border-purple-400 bg-black/40 p-4" style={{ borderRadius: 0 }}>
      <h4 className="text-lg font-bold text-purple tracking-widest">[EXPORT MISSION SEED FILES]</h4>
      <p className="text-xs text-text-muted">
        Turns the current on-chain missions (maps, AI ship configs, enemy placements, campaign and roguelike
        nodes, node titles, roguelike win effects, reward ships) into the contracts repo&apos;s deploy seed
        files, and saves the app&apos;s reward ship copy (<code>app/data/content/{REWARD_SHIP_SNAPSHOT_FILE}</code>)
        with them. Open the contracts repo&apos;s current <code>ignition/</code> folder first: its{" "}
        <code>data/</code> seed files keep existing keys the same, and{" "}
        <code>deployments/{DEPLOYMENT_FOLDER}/</code> says which on-chain id each key has.{" "}
        {writable
          ? "Saving writes the seed files back into that folder and the reward ship copy into this repo's app/data/content/."
          : `This browser can't save into a folder, so drop the three seed downloads over the originals and ${REWARD_SHIP_SNAPSHOT_FILE} over app/data/content/${REWARD_SHIP_SNAPSHOT_FILE}.`}{" "}
        Nothing on chain changes. Commit and deploy both repos afterwards.
      </p>

      <div className="space-y-2">
        <p className="text-xs text-text-secondary">
          {writable ? (
            <>
              Pick the contracts repo&apos;s <code>ignition/</code> folder, then this repo&apos;s{" "}
              <code>app/data/content/</code> folder, and allow editing for both.
            </>
          ) : (
            `Current seed files (${Object.values(SEED_FILE_NAMES).join(", ")}) and the deployment record (deployments/${DEPLOYMENT_FOLDER}/${JOURNAL_FILE} and ${SYNC_STATE_FILE}). Select them all at once.`
          )}
        </p>
        <button
          type="button"
          onClick={() => (writable ? void openSeedFolder() : fileInputRef.current?.click())}
          className="px-4 py-2 rounded-none font-mono text-sm border-2 border-cyan text-cyan hover:bg-cyan/10"
        >
          {writable ? "[OPEN SEED FOLDER]" : "[LOAD SEED FILES]"}
        </button>
        {writable && (
          <button
            type="button"
            onClick={() => void openContentFolder()}
            className="ml-2 px-4 py-2 rounded-none font-mono text-sm border-2 border-cyan text-cyan hover:bg-cyan/10"
          >
            [OPEN APP CONTENT FOLDER]
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,.jsonl"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Clear so picking the same file again still fires onChange.
            e.target.value = "";
          }}
        />
      </div>
      <ul className="text-xs font-mono">
        {(Object.keys(SEED_FILE_NAMES) as SeedSlot[]).map((slot) => (
          <li key={slot} className={baseline[slot] ? "text-phosphor-green" : "text-text-muted"}>
            {baseline[slot] ? "[LOADED]" : "[MISSING]"} {seedDir ? `ignition/${seedDir.name}/` : ""}
            {SEED_FILE_NAMES[slot]}
          </li>
        ))}
        <li className={deployment ? "text-phosphor-green" : "text-amber"}>
          {deployment
            ? `[LOADED] ${journalName ?? JOURNAL_FILE}${deployment.syncState ? ` + ${SYNC_STATE_FILE}` : ""} (on-chain ids)`
            : `[MISSING] deployments/${DEPLOYMENT_FOLDER}/${JOURNAL_FILE}: ids will follow seed order, as on a fresh deploy`}
        </li>
        {writable && (
          <li className={contentDir ? "text-phosphor-green" : "text-text-muted"}>
            {contentDir ? "[OPEN]" : "[NOT OPEN]"} {contentDir ? `${contentDir.name}/` : "app/data/content/"}
            {REWARD_SHIP_SNAPSHOT_FILE} (written from the chain)
          </li>
        )}
      </ul>
      {fileError && <p className="text-xs text-warning-red">{fileError}</p>}

      <button
        type="button"
        disabled={!snapshot || !baselineComplete || isSaving}
        onClick={() => void handleExport()}
        className="px-4 py-2 rounded-none font-mono text-sm border-2 border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading
          ? "Reading chain..."
          : isSaving
            ? "Saving..."
            : seedDir
              ? "[SAVE SEED FILES]"
              : "[DOWNLOAD SEED FILES]"}
      </button>

      {warnings && (
        <div className="text-xs">
          {warnings.length === 0 ? (
            <p className="text-phosphor-green">
              {savedTo ? `Saved to ${savedTo}` : "Exported"} with no warnings.
            </p>
          ) : (
            <>
              {savedTo && <p className="text-phosphor-green">Saved to {savedTo}.</p>}
              <ul className="list-disc pl-4 text-amber space-y-1">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
