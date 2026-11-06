// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Single entry point for the browser's native directory picker
 * (`window.showDirectoryPicker`, File System Access API).
 *
 * Every place that lets the user choose a folder on their device - the home
 * page "Open a Folder on This Device" button, the new-project dialogs'
 * "Save to My Computer" option and the project editor's "Export to a folder"
 * action - goes through `pickDirectory` so that they share one in-flight
 * guard. The browser allows a single picker per window: a second
 * `showDirectoryPicker` call while one is open rejects with
 * `NotAllowedError: File picker already active`, and when a button handler
 * fired twice (double click, Enter plus click, a re-render that re-ran the
 * handler) that rejection escaped as an unhandled promise and surfaced in the
 * global error overlay.
 *
 * `pickDirectory` never throws. It reports what happened as a
 * `DirectoryPickerOutcome` so callers decide what the user sees:
 *
 * - `picked`       the user chose a folder (and, for `readwrite`, write access
 *                  was granted).
 * - `cancelled`    the user dismissed the dialog. Nothing to show.
 * - `busy`         a picker is already open in this window, either one we
 *                  started or another native picker. Nothing to show; the open
 *                  dialog is the one the user is interacting with.
 * - `unsupported`  the browser has no directory picker (Firefox, Safari,
 *                  Android and iOS browsers). `message` tells the user what
 *                  works instead.
 * - `failed`       a real error: the picker needs a user gesture that has
 *                  expired, the page runs in a sandboxed frame, write
 *                  permission was denied, etc. `message` is suitable to show.
 *
 * Support detection is `isDirectoryPickerSupported`; UI that offers a folder
 * button should hide or disable it when this is false and point at the
 * import paths that work everywhere (Choose Files, drag and drop, .zip /
 * .mcaddon / .mcpack uploads), see `getUnsupportedDirectoryPickerMessage`.
 */

export type DirectoryPickerMode = "read" | "readwrite";

export type DirectoryPickerOutcome =
  | { status: "picked"; handle: FileSystemDirectoryHandle }
  | { status: "cancelled" }
  | { status: "busy" }
  | { status: "unsupported"; message: string }
  | { status: "failed"; message: string };

export interface IDirectoryPickerOptions {
  /**
   * Access requested from the browser. Defaults to `readwrite`, which also
   * verifies (and, if needed, requests) write permission on the chosen handle
   * so that a denial shows up here instead of on the first save.
   */
  mode?: DirectoryPickerMode;
}

/**
 * The subset of `window` the picker needs. Tests pass a plain object; real
 * callers pass `window`.
 */
export interface IDirectoryPickerHost {
  showDirectoryPicker?: (options?: { mode?: DirectoryPickerMode }) => Promise<FileSystemDirectoryHandle>;
}

interface IPermissionHandle {
  queryPermission?: (descriptor: { mode: DirectoryPickerMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: DirectoryPickerMode }) => Promise<PermissionState>;
}

const UnsupportedMessage =
  "This browser can't open folders on your device. Folder access works in Chrome and Edge on a desktop computer " +
  "(Windows, macOS, ChromeOS, Linux); Firefox, Safari and mobile browsers, including Android and iOS, don't offer it. " +
  "You can still open your project here with Choose Files or drag and drop (individual files or a .zip, .mcaddon or .mcpack), " +
  "and new projects are kept in this browser's storage.";

const PermissionDeniedMessage =
  "Write permission to the selected folder was not granted. Please pick the folder again and allow editing.";

// One in-flight picker per window object. Keying on the host rather than a
// module variable keeps unrelated windows (and tests) independent.
const activePickers = new WeakMap<object, Promise<DirectoryPickerOutcome>>();

/**
 * Whether this host offers the native directory picker.
 */
export function isDirectoryPickerSupported(host: IDirectoryPickerHost | undefined): boolean {
  return host !== undefined && host !== null && typeof host.showDirectoryPicker === "function";
}

/**
 * Guidance shown where a folder picker would otherwise be offered on a browser
 * that does not have one.
 */
export function getUnsupportedDirectoryPickerMessage(): string {
  return UnsupportedMessage;
}

/**
 * Whether a directory picker started through this module is currently open
 * for the given host.
 */
export function isDirectoryPickerActive(host: IDirectoryPickerHost): boolean {
  return activePickers.has(host);
}

/**
 * Opens the native directory picker, at most one at a time per host. See the
 * module documentation for the outcomes.
 */
export async function pickDirectory(
  host: IDirectoryPickerHost,
  options: IDirectoryPickerOptions = {}
): Promise<DirectoryPickerOutcome> {
  if (!isDirectoryPickerSupported(host)) {
    return { status: "unsupported", message: UnsupportedMessage };
  }

  if (activePickers.has(host)) {
    return { status: "busy" };
  }

  const pending = showPicker(host, options.mode ?? "readwrite");
  activePickers.set(host, pending);

  try {
    return await pending;
  } finally {
    activePickers.delete(host);
  }
}

async function showPicker(host: IDirectoryPickerHost, mode: DirectoryPickerMode): Promise<DirectoryPickerOutcome> {
  let handle: FileSystemDirectoryHandle;

  try {
    handle = await host.showDirectoryPicker!({ mode });
  } catch (e) {
    return classifyPickerError(e);
  }

  if (!handle) {
    return { status: "cancelled" };
  }

  if (mode === "readwrite") {
    const permissionOutcome = await ensureWritePermission(handle);

    if (permissionOutcome) {
      return permissionOutcome;
    }
  }

  return { status: "picked", handle };
}

function classifyPickerError(e: unknown): DirectoryPickerOutcome {
  const name = getErrorName(e);
  const message = getErrorMessage(e);

  // The user closed the dialog.
  if (name === "AbortError") {
    return { status: "cancelled" };
  }

  // Another native picker (ours or a file input's) is open in this window.
  if (name === "NotAllowedError" && /already active/i.test(message)) {
    return { status: "busy" };
  }

  if (name === "SecurityError" || name === "NotAllowedError") {
    return {
      status: "failed",
      message:
        "The browser did not allow opening a folder picker" +
        (message ? " (" + message + ")" : "") +
        ". Please click the button again directly, and make sure Minecraft Creator Tools is not embedded in another page.",
    };
  }

  return { status: "failed", message: "Could not open a folder picker: " + (message || String(e)) };
}

// Even with mode "readwrite", the browser may grant only prompt-level access
// at picker time. Ask now so a refusal surfaces here instead of during save.
async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<DirectoryPickerOutcome | undefined> {
  const permissionHandle = handle as unknown as IPermissionHandle;

  try {
    let state: PermissionState | undefined;

    if (typeof permissionHandle.queryPermission === "function") {
      state = await permissionHandle.queryPermission({ mode: "readwrite" });
    }

    if (state !== "granted" && typeof permissionHandle.requestPermission === "function") {
      state = await permissionHandle.requestPermission({ mode: "readwrite" });
    }

    if (state && state !== "granted") {
      return { status: "failed", message: PermissionDeniedMessage };
    }
  } catch (e) {
    return {
      status: "failed",
      message: "Could not obtain write permission for the selected folder: " + getErrorMessage(e),
    };
  }

  return undefined;
}

function getErrorName(e: unknown): string | undefined {
  if (e && typeof e === "object" && "name" in e && typeof (e as { name: unknown }).name === "string") {
    return (e as { name: string }).name;
  }

  return undefined;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }

  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }

  return e === undefined || e === null ? "" : String(e);
}
