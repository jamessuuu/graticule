"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface ImportedFile {
  name: string;
  text: string;
}

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];
const MAX_FILE_BYTES = 300_000; // a single generous ceiling; the session's
// own 200,000-character cap (packages/core/src/caps.ts) is the real backstop.

function looksLikeTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function readFileAsText(file: File): Promise<ImportedFile | null> {
  if (!looksLikeTextFile(file.name) || file.size > MAX_FILE_BYTES) return null;
  try {
    const text = await file.text();
    return { name: file.name, text };
  } catch {
    return null;
  }
}

/** Recursively walks a drag-and-drop `FileSystemDirectoryEntry` (the
 * classic `webkitGetAsEntry()` API, broadly supported for drag-and-drop —
 * distinct from the newer File System Access API used by the folder
 * *picker* button below). */
async function walkEntry(entry: FileSystemEntry, out: ImportedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    const imported = await readFileAsText(file);
    if (imported) out.push(imported);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    for (const child of entries) {
      await walkEntry(child, out);
    }
  }
}

export function useFileImport() {
  /** Drag-and-drop handler: files and/or whole folders. */
  const importFromDrop = useCallback(async (dataTransfer: DataTransfer): Promise<ImportedFile[]> => {
    const out: ImportedFile[] = [];
    const items = Array.from(dataTransfer.items);
    const entrySupport = items.length > 0 && typeof items[0]?.webkitGetAsEntry === "function";

    if (entrySupport) {
      const entries = items.map((item) => item.webkitGetAsEntry()).filter((e): e is FileSystemEntry => e !== null);
      for (const entry of entries) {
        await walkEntry(entry, out);
      }
    } else {
      // Fallback: plain files only, no folder traversal.
      for (const file of Array.from(dataTransfer.files)) {
        const imported = await readFileAsText(file);
        if (imported) out.push(imported);
      }
    }
    return out;
  }, []);

  /** `<input type="file" webkitdirectory multiple>` fallback for
   * browsers without drag-and-drop directory entries or the File System
   * Access API — chaff's proven pattern per SPEC.md §7. */
  const importFromFileList = useCallback(async (fileList: FileList): Promise<ImportedFile[]> => {
    const out: ImportedFile[] = [];
    for (const file of Array.from(fileList)) {
      const imported = await readFileAsText(file);
      if (imported) out.push(imported);
    }
    return out;
  }, []);

  /** Modern folder picker via the File System Access API, where
   * available. Return value distinguishes two different "nothing to
   * import" cases so the caller can react correctly: `null` means the API
   * itself isn't available (caller should fall back to the
   * `webkitdirectory` input), `[]` means the API IS available but the
   * user cancelled the picker (caller should do nothing — falling back to
   * a second picker after a deliberate cancel would be surprising). */
  const pickFolder = useCallback(async (): Promise<ImportedFile[] | null> => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker;
    if (typeof picker !== "function") return null;

    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await picker();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return []; // user cancelled
      throw err;
    }

    const out: ImportedFile[] = [];

    async function walkHandle(handle: FileSystemDirectoryHandle): Promise<void> {
      // @ts-expect-error — FileSystemDirectoryHandle is async-iterable in
      // supporting browsers; TS's lib.dom typings don't model this yet.
      for await (const [, entryHandle] of handle.entries()) {
        if (entryHandle.kind === "file") {
          const file = await (entryHandle as FileSystemFileHandle).getFile();
          const imported = await readFileAsText(file);
          if (imported) out.push(imported);
        } else if (entryHandle.kind === "directory") {
          await walkHandle(entryHandle as FileSystemDirectoryHandle);
        }
      }
    }

    await walkHandle(dirHandle);
    return out;
  }, []);

  // Feature-detected via useSyncExternalStore, not a useState+useEffect
  // pair — reading `window` directly during render (SSR-vs-client-first-
  // paint) diverges (undefined vs. defined), which is a real hydration
  // mismatch (React error #418), not just a theoretical one (caught live
  // via Playwright console inspection). The feature flag never changes
  // after mount, so `subscribe` is a no-op unsubscribe.
  const supportsFileSystemAccess = useSyncExternalStore(
    () => () => {},
    () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function",
    () => false
  );

  return { importFromDrop, importFromFileList, pickFolder, supportsFileSystemAccess };
}
