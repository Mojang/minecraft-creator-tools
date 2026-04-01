import { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import CreatorTools from "../app/CreatorTools";
import LocalEnvironment from "../local/LocalEnvironment";
import ElectronUtils from "./ElectronUtils";
import StorageUtilities from "../storage/StorageUtilities";

/** Debounce time in ms for batching file change notifications */
const FILE_CHANGE_DEBOUNCE_MS = 300;

export default class FileSystemCommandHandler {
  _window: BrowserWindow;
  _ipcMain: IpcMain;
  _env: LocalEnvironment;
  _utils: ElectronUtils;
  _watchingPaths: { [name: string]: fs.FSWatcher } = {};

  /** Pending file changes for debouncing, keyed by storage path */
  _pendingFileChanges: {
    [storagePath: string]: {
      added: Set<string>;
      removed: Set<string>;
      updated: Set<string>;
      timer: NodeJS.Timeout | null;
    };
  } = {};

  constructor(
    browserWindow: BrowserWindow,
    incomingIpcMain: IpcMain,
    creatorTools: CreatorTools,
    env: LocalEnvironment,
    utils: ElectronUtils
  ) {
    this._window = browserWindow;
    this._ipcMain = incomingIpcMain;
    this._env = env;
    this._utils = utils;

    this.exists = this.exists.bind(this);
    this.folderExists = this.folderExists.bind(this);
    this.mkdir = this.mkdir.bind(this);
    this.readDir = this.readDir.bind(this);
    this.renameFolder = this.renameFolder.bind(this);
    this.deleteFolder = this.deleteFolder.bind(this);
    this.readFile = this.readFile.bind(this);
    this.writeFile = this.writeFile.bind(this);
    this.writeUtf8File = this.writeUtf8File.bind(this);
    this.readUtf8File = this.readUtf8File.bind(this);
    this.stat = this.stat.bind(this);
    this.getDirname = this.getDirname.bind(this);
    this.rootStorageExists = this.rootStorageExists.bind(this);

    this._ipcMain.handle("asyncgetDirname", this.getDirname);
    this._ipcMain.handle("asyncfsExists", this.exists);
    this._ipcMain.handle("asyncfsFolderExists", this.folderExists);

    this._ipcMain.handle("asyncfsRenameFolder", this.renameFolder);
    this._ipcMain.handle("asyncfsDeleteFolder", this.deleteFolder);
    this._ipcMain.handle("asyncfsRootStorageExists", this.rootStorageExists);
    this._ipcMain.handle("asyncfsMkdir", this.mkdir);
    this._ipcMain.handle("asyncfsReaddir", this.readDir);
    this._ipcMain.handle("asyncfsWriteFile", this.writeFile);
    this._ipcMain.handle("asyncfsWriteUtf8File", this.writeUtf8File);
    this._ipcMain.handle("bsyncfsReadFile", this.readFile);
    this._ipcMain.handle("asyncfsReadUtf8File", this.readUtf8File);
    this._ipcMain.handle("asyncfsStat", this.stat);
  }

  exists(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("EXT: Could not process path: " + slargs[1]);
    }

    this._utils.validateFilePath(path);

    this._window.webContents.send("appsvc", "asyncfsExists|" + slargs[0] + "|" + fs.existsSync(path));
  }

  rootStorageExists(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    let storagePath: string | undefined = slargs[1];

    if (!storagePath) {
      this._window.webContents.send("appsvc", "asyncfsRootStorageExists|" + slargs[0] + "|false");
      return;
    }

    let result = false;

    if (storagePath.startsWith("<BDRK>")) {
      storagePath = this._utils.getMinecraftReleasePath();

      if (storagePath) {
        result = true;
      }
    } else if (storagePath.startsWith("<BDPV>")) {
      storagePath = this._utils.getMinecraftPreviewPath();

      if (storagePath) {
        result = true;
      }
    } else if (storagePath.startsWith("<pt_") || storagePath.startsWith("<DOCP>")) {
      storagePath = this._utils.deTokenizePath(storagePath);

      if (storagePath) {
        result = true;
      }
    }

    if (!storagePath) {
      this._window.webContents.send("appsvc", "asyncfsRootStorageExists|" + slargs[0] + "|false");
      return;
    }

    if (result === true) {
      if (fs.existsSync(storagePath) === false) {
        result = false;
      } else {
        if (!this._watchingPaths[storagePath]) {
          // Capture storagePath in a const for use in callbacks (TypeScript flow analysis)
          const watchedPath = storagePath;

          // Initialize pending changes structure for this storage path
          this._pendingFileChanges[watchedPath] = {
            added: new Set<string>(),
            removed: new Set<string>(),
            updated: new Set<string>(),
            timer: null,
          };

          let listener = fs.watch(watchedPath, { recursive: true }, (eventType, fileName) => {
            if (!fileName) {
              return;
            }

            const mappedPath = this._utils.ensureMappingForPath(watchedPath);
            const updatePath =
              StorageUtilities.ensureEndsWithDelimiter("<pt_" + mappedPath + ">") + fileName.toString();
            const fullFilePath = watchedPath + "/" + fileName.toString();

            // Get the pending changes for this storage
            const pending = this._pendingFileChanges[watchedPath];
            if (!pending) {
              return;
            }

            if (eventType === "change") {
              // File contents changed - only if it wasn't just added
              if (!pending.added.has(updatePath)) {
                pending.updated.add(updatePath);
              }
            } else if (eventType === "rename") {
              // On Windows, "rename" is fired for both adds and deletes
              // Check if file exists to disambiguate
              try {
                if (fs.existsSync(fullFilePath)) {
                  // File exists - it was added or renamed to this name
                  // If it was in removed, move it to updated (quick delete+recreate)
                  if (pending.removed.has(updatePath)) {
                    pending.removed.delete(updatePath);
                    pending.updated.add(updatePath);
                  } else {
                    pending.added.add(updatePath);
                  }
                } else {
                  // File doesn't exist - it was removed or renamed away
                  // If it was in added, just remove from added (never notify)
                  if (pending.added.has(updatePath)) {
                    pending.added.delete(updatePath);
                  } else {
                    // Mark for removal
                    pending.updated.delete(updatePath);
                    pending.removed.add(updatePath);
                  }
                }
              } catch (e) {
                // If we can't check existence, assume it was removed
                pending.removed.add(updatePath);
              }
            }

            // Reset the debounce timer
            if (pending.timer) {
              clearTimeout(pending.timer);
            }

            pending.timer = setTimeout(() => {
              this._flushPendingChanges(watchedPath);
            }, FILE_CHANGE_DEBOUNCE_MS);
          });

          this._watchingPaths[watchedPath] = listener;
        }
      }
    }

    this._window.webContents.send("appsvc", "asyncfsRootStorageExists|" + slargs[0] + "|" + result.toString());
  }

  /**
   * Flushes pending file changes for a storage path, sending batched IPC messages.
   * This is called after the debounce timer expires.
   */
  _flushPendingChanges(storagePath: string) {
    const pending = this._pendingFileChanges[storagePath];
    if (!pending) {
      return;
    }

    // Clear the timer reference
    pending.timer = null;

    try {
      // Send removed files first
      for (const path of pending.removed) {
        this._window.webContents.send("appsvc", "localFileRemoved|" + path);
      }

      // Send added files
      for (const path of pending.added) {
        this._window.webContents.send("appsvc", "localFileAdded|" + path);
      }

      // Send updated files
      for (const path of pending.updated) {
        this._window.webContents.send("appsvc", "localFileUpdate|" + path);
      }
    } catch (e) {
      // Window may have been closed
    }

    // Clear the sets
    pending.added.clear();
    pending.removed.clear();
    pending.updated.clear();
  }

  folderExists(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    if (slargs[1].startsWith("<BDRK>")) {
      let mcpath = this._utils.getMinecraftReleasePath();

      if (!mcpath) {
        this._window.webContents.send("appsvc", "asyncfsFolderExists|" + slargs[0] + "|false");
      }
    }

    if (slargs[1].startsWith("<BDPV>")) {
      let BDPVath = this._utils.getMinecraftPreviewPath();

      if (!BDPVath) {
        this._window.webContents.send("appsvc", "asyncfsFolderExists|" + slargs[0] + "|false");
      }
    }

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("FEX: Could not process path: " + slargs[1]);
    }

    const folderExistsResult = fs.existsSync(path);
    let result = false;

    if (folderExistsResult) {
      const statResult = fs.statSync(path);

      if (statResult.isDirectory()) {
        result = true;
      }
    }

    try {
      this._window.webContents.send("appsvc", "asyncfsFolderExists|" + slargs[0] + "|" + result.toString());
    } catch (e) {}
  }

  getDirname(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");
    this._window.webContents.send("appsvc", "asyncgetDirname|" + slargs[0] + "|" + __dirname);
  }

  renameFolder(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const fromPath = this._utils.deTokenizePath(slargs[1]);

    if (fromPath === undefined) {
      throw new Error("RNDA: Could not process path: " + slargs[1]);
    }

    const toPath = this._utils.deTokenizePath(slargs[2]);

    if (toPath === undefined) {
      throw new Error("RNDB: Could not process path: " + slargs[2]);
    }

    this._utils.validateFolderPath(fromPath);
    this._utils.validateFolderPath(toPath);

    let result = true;

    try {
      fs.renameSync(fromPath, toPath);
    } catch (e) {
      result = false;
    }

    this._window.webContents.send("appsvc", "asyncfsRenameFolder|" + slargs[0] + "|" + result.toString());
  }

  deleteFolder(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("DLF: Could not process path: " + slargs[1]);
    }

    this._utils.validateFolderPath(path);

    let result = true;

    try {
      fs.rmSync(path, { recursive: true, force: true });
    } catch (e) {
      result = false;
    }

    this._window.webContents.send("appsvc", "asyncfsDeleteFolder|" + slargs[0] + "|" + result.toString());
  }

  mkdir(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("MKD: Could not process path: " + slargs[1]);
    }

    this._utils.validateFolderPath(path);

    // Use recursive: true to create parent directories and avoid EEXIST errors
    try {
      fs.mkdirSync(path, { recursive: true });
    } catch (e: any) {
      // Only throw if it's not an EEXIST error (directory already exists is OK)
      if (e.code !== "EEXIST") {
        throw e;
      }
    }

    this._window.webContents.send("appsvc", "asyncfsMkdir|" + slargs[0] + "|true");
  }

  readDir(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");
    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("RDD: Could not process path: " + slargs[1]);
    }

    this._utils.validateFolderPath(path);

    let fsReadDirResult = undefined;

    try {
      fsReadDirResult = fs.readdirSync(path);
    } catch (e) {}

    const res = fsReadDirResult ? JSON.stringify(fsReadDirResult) : "<undefined>";

    this._window.webContents.send("appsvc", "asyncfsReadDir|" + slargs[0] + "|" + res);
  }

  writeFile(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const writeFilePath = this._utils.deTokenizePath(slargs[1]);

    if (writeFilePath === undefined) {
      throw new Error("WFI: Could not process path: " + slargs[1]);
    }

    let writeFileContent = slargs[2];

    this._utils.validateFilePath(writeFilePath);

    // Ensure parent directory exists before writing
    const dirPath = StorageUtilities.getFolderPath(writeFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const dvWriteFileContent = new DataView(this._utils.base64ToArrayBuffer(writeFileContent));

    fs.writeFileSync(writeFilePath, dvWriteFileContent);

    this._window.webContents.send("appsvc", "asyncfsWriteFile|" + slargs[0] + "|");
  }

  readFile(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("RFI: Could not process path: " + slargs[1]);
    }

    this._utils.validateFilePath(path);

    if (!fs.existsSync(path)) {
      this._window.webContents.send("appsvc", "bsyncfsReadFile|" + slargs[0] + "|<undefined>");
      return;
    }

    const readFileResult = fs.readFileSync(path);

    this._window.webContents.send(
      "appsvc",
      "bsyncfsReadFile|" + slargs[0] + "|" + this._utils.arrayBufferToBase64(readFileResult)
    );
  }

  readUtf8File(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("RUF: Could not process path: " + slargs[1]);
    }

    this._utils.validateFilePath(path);

    if (!fs.existsSync(path)) {
      this._window.webContents.send("appsvc", "asyncfsReadUtf8File|" + slargs[0] + "|<undefined>");
      return;
    }

    const fileContents = fs.readFileSync(path, { encoding: "utf8" });

    this._window.webContents.send("appsvc", "asyncfsReadUtf8File|" + slargs[0] + "|" + fileContents);
  }

  stat(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("STT: Could not process path: " + slargs[1]);
    }

    this._utils.validateFolderPath(path);

    const statResult = fs.statSync(path);
    const statResultData = {
      isDirectory: statResult.isDirectory(),
      isFile: statResult.isFile(),
      mtime: statResult.mtime,
      ctime: statResult.ctime,
      size: statResult.size,
    };

    try {
      this._window.webContents.send("appsvc", "asyncfsStat|" + slargs[0] + "|" + JSON.stringify(statResultData));
    } catch (e) {}
  }

  writeUtf8File(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const path = this._utils.deTokenizePath(slargs[1]);

    if (path === undefined) {
      throw new Error("WUF: Could not process path: " + slargs[1]);
    }

    const content = slargs[2];

    this._utils.validateFilePath(path);

    const dirPath = StorageUtilities.getFolderPath(path);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(path, content, { encoding: "utf8" });

    this._window.webContents.send("appsvc", "asyncfsWriteUtf8File|" + slargs[0] + "|");
  }
}
