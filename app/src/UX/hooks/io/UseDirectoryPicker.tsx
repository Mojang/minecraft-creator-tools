import { useCallback, useEffect, useRef, useState } from "react";
import FileSystemStorage from "../../../storage/FileSystemStorage";
import FileSystemFolder from "../../../storage/FileSystemFolder";

export type Directory = {
  name: string;
  root: FileSystemFolder;
};

type PickerConfig = {
  onDirectoryPicked?: (directory?: Directory) => void;
  checkEmptyDir?: boolean;
  checkUnsafeFiles?: boolean;
};

const UnsafeFileMessage =
  "Folder has unsupported files within it. Please choose a folder on your device that only has Minecraft asset files in it (.json, .png, .mcfunction, etc.)";

export function useDirectoryPicker(window: typeof globalThis, config: PickerConfig = {}) {
  const [directory, setDirectory] = useState<Directory>();
  const [error, setError] = useState<{ message: string } | null>();
  const { onDirectoryPicked, ...validation } = config;
  const prevDirectory = useRef<Directory>();

  const getError = useCallback(
    async (directoryHandle: FileSystemStorage) => {
      let message = null;
      if (!!validation.checkEmptyDir) {
        message = (await directoryHandle.rootFolder.getIsEmptyError()) ?? null;
      }
      if (!message && !!validation.checkUnsafeFiles) {
        const unsafeDetails = await directoryHandle.rootFolder.getFirstUnsafeError();
        if (unsafeDetails) {
          message = unsafeDetails && `${UnsafeFileMessage}\n\nDetails:  ${unsafeDetails}`;
        }
      }

      if (message) {
        return { message };
      }

      return null;
    },
    [validation]
  );

  const pickDirectory = useCallback(async () => {
    if (typeof window.showDirectoryPicker !== "function") {
      setError({
        message:
          "Your browser does not support folder selection. Please use a Chromium-based browser (Chrome, Edge) on desktop.",
      });
      return;
    }

    let handle;
    try {
      //show file dialog
      handle = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      //user cancelled - expected and safe to ignore
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      //pass through errors we don't explictly handle
      throw err;
    }

    // Even with mode: "readwrite", the browser may only grant prompt-level
    // permission at picker time. Explicitly verify/request write access now so
    // that failures surface here instead of silently later during save.
    try {
      const handleAny = handle as unknown as {
        queryPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
        requestPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
      };

      let state: PermissionState | undefined;
      if (typeof handleAny.queryPermission === "function") {
        state = await handleAny.queryPermission({ mode: "readwrite" });
      }
      if (state !== "granted" && typeof handleAny.requestPermission === "function") {
        state = await handleAny.requestPermission({ mode: "readwrite" });
      }
      if (state && state !== "granted") {
        setError({
          message:
            "Write permission to the selected folder was not granted. Please pick the folder again and allow editing.",
        });
        return;
      }
    } catch (permErr) {
      setError({
        message:
          "Could not obtain write permission for the selected folder: " +
          (permErr instanceof Error ? permErr.message : String(permErr)),
      });
      return;
    }

    const storage = new FileSystemStorage(handle, handle.name);

    const error = await getError(storage);
    setError(error);
    if (error) {
      return;
    }

    const directory = { name: handle.name, root: storage.rootFolder };
    setDirectory(directory);
  }, [window, getError]);

  //trigger callback when directory changes values
  //useEffect avoids issues with stale state
  useEffect(() => {
    if (directory !== prevDirectory.current) {
      onDirectoryPicked?.(directory);
    }

    prevDirectory.current = directory;
  }, [directory, onDirectoryPicked]);

  return [directory, pickDirectory, error] as const;
}
