"use client";

import React, { useRef, useState } from "react";
import { useAccount } from "wagmi";
import { MAP_ADMIN_ADDRESS } from "../config/alpha";
import { useIsEncounterEditor } from "../hooks/useIsEncounterEditor";
import { useIsNodeMapEditor } from "../hooks/useIsNodeMapEditor";
import { useMissionChainSnapshot } from "../hooks/useMissionChainSnapshot";
import {
  buildMissionSeedFiles,
  type MissionSeedFiles,
  type PvpSeed,
  type RoguelikeSeed,
  type SinglePlayerSeed,
} from "../utils/missionSeedExport";

// Seed file names in the contracts repo (ignition/data/), read by
// ignition/modules/DeployAndConfig.ts. Where the browser can write files
// (Chromium's File System Access API), the panel opens that folder and saves
// over these files in place; elsewhere it reads picked files and downloads
// under the same names, to be dropped over the originals by hand.
const SEED_FILE_NAMES = {
  singlePlayer: "singlePlayerStarterContent.json",
  roguelike: "roguelikeStarterContent.json",
  pvp: "pvpStarterContent.json",
} as const;
type SeedSlot = keyof typeof SEED_FILE_NAMES;

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([seedJson(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// The parts of the File System Access API lib.dom doesn't type yet.
type PermissionMode = { mode: "readwrite" };
type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: PermissionMode): Promise<PermissionState>;
  requestPermission(options: PermissionMode): Promise<PermissionState>;
};
type DirectoryPickerWindow = Window & {
  showDirectoryPicker(options: PermissionMode & { id?: string }): Promise<WritableDirectoryHandle>;
};

function canWriteFiles(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function seedJson(data: unknown): string {
  // Same formatting as the checked-in seed files, so an unchanged export
  // produces no diff.
  return `${JSON.stringify(data, null, 2)}\n`;
}

async function writeJson(dir: WritableDirectoryHandle, filename: string, data: unknown) {
  const handle = await dir.getFileHandle(filename);
  const writable = await handle.createWritable();
  await writable.write(seedJson(data));
  await writable.close();
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
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
// effects) as the three seed files the contracts deploy reads. Takes the
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
    for (const file of Array.from(fileList)) {
      try {
        const data = JSON.parse(await file.text());
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
  };

  const openSeedFolder = async () => {
    resetResult();
    let dir: WritableDirectoryHandle;
    try {
      dir = await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
        mode: "readwrite",
        id: "vt-seed-data",
      });
    } catch (e) {
      if (!isAbort(e))
        setFileError(`Couldn't open the folder: ${e instanceof Error ? e.message : String(e)}`);
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
            ? `${name} isn't in ${dir.name}/. Pick the contracts repo's ignition/data/ folder.`
            : `${name} couldn't be read: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    setBaseline(next);
    setSeedDir(problems.length === 0 ? dir : null);
    if (problems.length > 0) setFileError(problems.join(" "));
  };

  const baselineComplete =
    baseline.singlePlayer != null && baseline.roguelike != null && baseline.pvp != null;

  const handleExport = async () => {
    if (!snapshot || !baselineComplete) return;
    resetResult();
    const { files, warnings: exportWarnings } = buildMissionSeedFiles(snapshot, baseline as MissionSeedFiles);
    if (seedDir) {
      setIsSaving(true);
      try {
        // The grant from the picker can lapse (e.g. after a reload of the
        // page's permissions); ask again rather than fail.
        if ((await seedDir.queryPermission({ mode: "readwrite" })) !== "granted") {
          if ((await seedDir.requestPermission({ mode: "readwrite" })) !== "granted") {
            setFileError("Saving needs write access to the folder.");
            return;
          }
        }
        await writeJson(seedDir, SEED_FILE_NAMES.singlePlayer, files.singlePlayer);
        await writeJson(seedDir, SEED_FILE_NAMES.roguelike, files.roguelike);
        await writeJson(seedDir, SEED_FILE_NAMES.pvp, files.pvp);
        // The saved files are the folder's contents now, so a second save
        // builds on them.
        setBaseline(files);
        setSavedTo(seedDir.name);
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
    }
    setWarnings([
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
        nodes, node titles, roguelike win effects) into the contracts repo&apos;s deploy seed files. Open the
        repo&apos;s current <code>ignition/data/</code> files first so existing keys stay the same.{" "}
        {writable
          ? "Saving writes the three files back into that folder."
          : "This browser can't save into a folder, so drop the three downloads over the originals."}{" "}
        Nothing on chain changes.
      </p>

      <div className="space-y-2">
        <p className="text-xs text-text-secondary">
          {writable ? (
            <>
              Pick the contracts repo&apos;s <code>ignition/data/</code> folder and allow editing.
            </>
          ) : (
            `Current seed files (${Object.values(SEED_FILE_NAMES).join(", ")}). Select all three at once.`
          )}
        </p>
        <button
          type="button"
          onClick={() => (writable ? void openSeedFolder() : fileInputRef.current?.click())}
          className="px-4 py-2 rounded-none font-mono text-sm border-2 border-cyan text-cyan hover:bg-cyan/10"
        >
          {writable ? "[OPEN SEED FOLDER]" : "[LOAD SEED FILES]"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
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
            {baseline[slot] ? "[LOADED]" : "[MISSING]"} {seedDir ? `${seedDir.name}/` : ""}
            {SEED_FILE_NAMES[slot]}
          </li>
        ))}
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
              {savedTo ? `Saved to ${savedTo}/` : "Exported"} with no warnings.
            </p>
          ) : (
            <>
              {savedTo && <p className="text-phosphor-green">Saved to {savedTo}/.</p>}
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
