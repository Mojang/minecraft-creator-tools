import { useCallback, useEffect, useRef, useState } from "react";
import FileSystemStorage from "../../../storage/FileSystemStorage";
import FileSystemFolder from "../../../storage/FileSystemFolder";
import { isDirectoryPickerSupported, pickDirectory as pickNativeDirectory } from "../../utils/DirectoryPicker";

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

/**
 * React access to the device folder picker.
 *
 * Returns `[directory, pickDirectory, error, isSupported]`. `pickDirectory`
 * opens the native dialog through the shared `DirectoryPicker` helper, so
 * repeated activations while a dialog is open are ignored instead of
 * launching a second picker, a cancelled dialog leaves state untouched, and
 * unsupported browsers or real failures land in `error` for the component to
 * display. `pickDirectory` never rejects.
 */
export function useDirectoryPicker(window: typeof globalThis, config: PickerConfig = {}) {
  const [directory, setDirectory] = useState<Directory>();
  const [error, setError] = useState<{ message: string } | null>();
  const { onDirectoryPicked, ...validation } = config;
  const prevDirectory = useRef<Directory>();
  const isSupported = isDirectoryPickerSupported(window);

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
    const outcome = await pickNativeDirectory(window, { mode: "readwrite" });

    switch (outcome.status) {
      case "cancelled":
      case "busy":
        return;

      case "unsupported":
      case "failed":
        setError({ message: outcome.message });
        return;

      case "picked":
        break;
    }

    const handle = outcome.handle;
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

  return [directory, pickDirectory, error, isSupported] as const;
}
