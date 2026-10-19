// Saving admin exports as JSON files: written into a folder the admin picks
// where the browser allows it (Chromium's File System Access API), or
// downloaded to be dropped over the original by hand. Used by the mission
// seed export (AdminSettingsExport) and the reward ship snapshot
// (RewardShipSnapshotPanel).

// The parts of the File System Access API lib.dom doesn't type yet.
type PermissionMode = { mode: "readwrite" };
export type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: PermissionMode): Promise<PermissionState>;
  requestPermission(options: PermissionMode): Promise<PermissionState>;
};
type DirectoryPickerWindow = Window & {
  showDirectoryPicker(options: PermissionMode & { id?: string }): Promise<WritableDirectoryHandle>;
};

/** Pretty-printed with a trailing newline, like the checked-in files, so an unchanged export has no diff. */
export function formatJsonFile(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function canWriteFiles(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([formatJsonFile(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Opens a folder for writing; `id` makes the picker start where it was last used for this purpose. */
export function pickWritableDirectory(id: string): Promise<WritableDirectoryHandle> {
  return (window as unknown as DirectoryPickerWindow).showDirectoryPicker({ mode: "readwrite", id });
}

/** Asks again for write access if the picker's grant lapsed. Resolves false if refused. */
export async function ensureWritable(dir: WritableDirectoryHandle): Promise<boolean> {
  if ((await dir.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await dir.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Writes `data` over the existing `filename` in `dir`. */
export async function writeJson(dir: WritableDirectoryHandle, filename: string, data: unknown) {
  const handle = await dir.getFileHandle(filename);
  const writable = await handle.createWritable();
  await writable.write(formatJsonFile(data));
  await writable.close();
}
