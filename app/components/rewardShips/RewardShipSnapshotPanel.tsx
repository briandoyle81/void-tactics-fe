"use client";

import React, { useState } from "react";
import { REWARD_SHIP_SNAPSHOT } from "../../config/rewardShips";
import { buildRewardShipSnapshot, isSnapshotForContract } from "../../utils/rewardShipSnapshot";
import type { ShipGrantSpec } from "../../utils/shipGrant";
import {
  canWriteFiles,
  downloadJson,
  ensureWritable,
  isAbort,
  pickWritableDirectory,
  writeJson,
  type WritableDirectoryHandle,
} from "../../utils/jsonFileSave";

// Reward Ships' app copy: compares the chain's grants with the checked-in
// app/data/content/rewardShips.json (what players' screens show) and saves
// a new copy, into that folder where the browser can write files, or as a
// download to drop over it. Commit and deploy to update players. Web3 only.

const FILE_NAME = "rewardShips.json";
const FOLDER_NAME = "content";

async function hasFile(dir: WritableDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export function RewardShipSnapshotPanel({
  address,
  liveGrants,
  staleCount,
  isLoading,
}: {
  /** This deploy's ShipGrantWinEffect. */
  address: string;
  liveGrants: Map<number, ShipGrantSpec>;
  /** Nodes whose chain grant differs from the app copy. */
  staleCount: number;
  isLoading: boolean;
}) {
  const [dir, setDir] = useState<WritableDirectoryHandle | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const forContract = isSnapshotForContract(REWARD_SHIP_SNAPSHOT, address);
  const writable = canWriteFiles();

  const save = async () => {
    setMessage(null);
    const file = buildRewardShipSnapshot(address, liveGrants);
    if (!writable) {
      downloadJson(FILE_NAME, file);
      setMessage({ tone: "good", text: `Downloaded ${FILE_NAME}. Drop it over app/data/content/${FILE_NAME}, then commit and deploy.` });
      return;
    }
    setIsSaving(true);
    try {
      let target = dir;
      if (!target) {
        target = await pickWritableDirectory("vt-app-content");
        // Only save over the real copy: the repo's app/data/content/ folder,
        // which already holds the file. Another folder would get a stray
        // file and players would keep the old copy.
        if (target.name !== FOLDER_NAME || !(await hasFile(target, FILE_NAME))) {
          setMessage({
            tone: "bad",
            text: `That folder isn't app/data/content/ (it needs to hold ${FILE_NAME}). Pick the repo's app/data/content/ folder.`,
          });
          return;
        }
        setDir(target);
      }
      if (!(await ensureWritable(target))) {
        setMessage({ tone: "bad", text: "Saving needs write access to the folder." });
        return;
      }
      await writeJson(target, FILE_NAME, file);
      setMessage({
        tone: "good",
        text: `Saved ${target.name}/${FILE_NAME}. Commit and deploy to update players (the dev server picks it up on reload).`,
      });
    } catch (e) {
      if (!isAbort(e)) setMessage({ tone: "bad", text: `Saving failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsSaving(false);
    }
  };

  const status = isLoading
    ? "Comparing with the chain…"
    : !forContract
      ? "The app copy is from another deploy, so players' screens read the chain until you save a new one."
      : staleCount === 0
        ? "The app copy matches the chain."
        : `${staleCount} node${staleCount === 1 ? "" : "s"} changed since the app copy was saved. Players still see the old ship${staleCount === 1 ? "" : "s"} until you save and deploy.`;
  const needsSave = !isLoading && (!forContract || staleCount > 0);

  return (
    <div className={`mb-4 space-y-2 border p-3 font-mono ${needsSave ? "border-amber/60 bg-amber/5" : "border-gunmetal bg-black/30"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">App copy</div>
          <div className="text-[11px] text-text-muted">
            app/data/content/{FILE_NAME} · saved {new Date(REWARD_SHIP_SNAPSHOT.savedAt).toLocaleString()}
          </div>
        </div>
        <button
          type="button"
          disabled={isLoading || isSaving}
          onClick={() => void save()}
          className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50 ${
            needsSave ? "border-amber text-amber hover:bg-amber/10" : "border-cyan text-cyan hover:bg-cyan/10"
          }`}
        >
          {isSaving ? "[SAVING...]" : writable ? "[SAVE APP COPY]" : `[DOWNLOAD ${FILE_NAME}]`}
        </button>
      </div>
      <p className={`text-xs ${needsSave ? "text-amber" : "text-text-secondary"}`}>{status}</p>
      {writable && !dir && (
        <p className="text-[11px] text-text-muted">Saving asks for the repo&apos;s app/data/content/ folder the first time.</p>
      )}
      {message && (
        <p className={`text-xs ${message.tone === "good" ? "text-phosphor-green" : "text-warning-red"}`}>{message.text}</p>
      )}
    </div>
  );
}
