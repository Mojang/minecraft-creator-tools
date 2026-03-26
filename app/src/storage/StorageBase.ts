// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * StorageBase.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This is the base implementation for all storage types in MCTools.
 * It provides the event dispatching infrastructure for file/folder change notifications.
 *
 * EVENTS (for real-time synchronization):
 * ---------------------------------------
 * - onFileAdded: Dispatched by notifyFileAdded() when a new file is detected
 * - onFileRemoved: Dispatched by notifyFileRemoved() when a file is deleted
 * - onFileContentsUpdated: Dispatched by notifyFileContentsUpdated() when content changes
 * - onFolderAdded: Dispatched by notifyFolderAdded() when a folder is created
 * - onFolderRemoved: Dispatched by notifyFolderRemoved() when a folder is deleted
 * - onFolderMoved: Dispatched by notifyFolderMoved() when a folder is renamed/moved
 *
 * These events power the sync pipeline:
 *   NodeStorage (watcher) -> HttpServer -> WebSocket -> HttpStorage -> MCWorld -> WorldView
 *
 * SUBCLASSES:
 * -----------
 * - NodeStorage: Local file system (server-side, adds fs.watch() support)
 * - HttpStorage: HTTP-based storage (client-side, receives WebSocket notifications)
 * - ZipStorage: ZIP file storage (in-memory)
 * - BrowserStorage: Browser local storage
 * - VirtualFolderStorage: Aggregates multiple folders
 *
 * HOW TO ADD A NEW STORAGE TYPE:
 * ------------------------------
 * 1. Extend StorageBase
 * 2. Implement abstract rootFolder and getAvailable()
 * 3. Create corresponding FolderBase and FileBase subclasses
 * 4. If supporting watching, implement IWatchableStorage from IStorageWatcher.ts
 * 5. Call notify*() methods when changes are detected
 */

import IStorage, { IFileUpdateEvent, IFolderMove, StorageErrorStatus } from "./IStorage";
import IFolder from "./IFolder";
import IFile, { FileUpdateType } from "./IFile";
import { EventDispatcher } from "ste-events";
import IVersionContent from "./IVersionContent";
import StorageUtilities from "./StorageUtilities";

export const MaxRecentVersionsToConsider = 100;
export const WeRecentlyChangedItThresholdMs = 50;
export default abstract class StorageBase implements IStorage {
  abstract rootFolder: IFolder;
  isContentUpdated: boolean = false;
  readOnly: boolean = false;
  scanForChangesPhase: number = 0;

  static readonly slashFolderDelimiter = "/";

  priorVersions: IVersionContent[] = [];
  currentVersionId: string | undefined;

  containerFile?: IFile | undefined;

  #onFileAdded = new EventDispatcher<StorageBase, IFile>();
  #onFileRemoved = new EventDispatcher<StorageBase, string>();
  #onFileContentsUpdated = new EventDispatcher<StorageBase, IFileUpdateEvent>();
  #onFolderMoved = new EventDispatcher<StorageBase, IFolderMove>();

  #onFolderAdded = new EventDispatcher<StorageBase, IFolder>();
  #onFolderRemoved = new EventDispatcher<StorageBase, string>();

  #storagePath: string | undefined;

  available?: boolean | undefined;

  errorStatus?: StorageErrorStatus;
  errorMessage?: string;

  channelId?: string;

  get folderDelimiter() {
    return StorageBase.slashFolderDelimiter;
  }

  public get storagePath() {
    return this.#storagePath;
  }

  public set storagePath(newStoragePath: string | undefined) {
    this.#storagePath = newStoragePath;
  }

  public resetContentUpdated() {
    this.isContentUpdated = false;
  }

  public get onFileAdded() {
    return this.#onFileAdded.asEvent();
  }

  public get onFileRemoved() {
    return this.#onFileRemoved.asEvent();
  }

  public get onFileContentsUpdated() {
    return this.#onFileContentsUpdated.asEvent();
  }

  public get onFolderMoved() {
    return this.#onFolderMoved.asEvent();
  }

  public get onFolderAdded() {
    return this.#onFolderAdded.asEvent();
  }

  public get onFolderRemoved() {
    return this.#onFolderRemoved.asEvent();
  }

  async ensureFolderFromStorageRelativePath(path: string) {
    if (path.startsWith("/" + this.rootFolder.name + "/")) {
      path = path.substring(this.rootFolder.name.length + 1);
    }

    return this.rootFolder.ensureFolderFromRelativePath(path);
  }

  notifyFileAdded(file: IFile) {
    this.#onFileAdded.dispatch(this, file);
  }

  notifyFolderAdded(folder: IFolder) {
    this.#onFolderAdded.dispatch(this, folder);
  }

  notifyFolderRemoved(folder: IFolder) {
    this.#onFolderRemoved.dispatch(this, folder.name);
  }

  notifyFileContentsUpdated(fileEvent: IFileUpdateEvent) {
    this.isContentUpdated = true;

    this.#onFileContentsUpdated.dispatch(this, fileEvent);
  }

  notifyFolderMoved(folderMove: IFolderMove) {
    this.isContentUpdated = true;
    this.#onFolderMoved.dispatch(this, folderMove);
  }

  notifyFileRemoved(fileName: string) {
    this.#onFileRemoved.dispatch(this, fileName);
  }

  async incrementalScanForChanges() {
    const folders = this.getFolderList();

    this.scanForChangesPhase++;
    this.scanForChangesPhase %= folders.length;

    const folderToScan = folders[this.scanForChangesPhase];

    await folderToScan.scanForChanges();

    for (const fileKey in folderToScan.files) {
      const file = folderToScan.files[fileKey];

      if (file) {
        await file.scanForChanges();
      }
    }
  }

  async scanForChanges() {
    const folders = this.getFolderList();

    for (const folder of folders) {
      await folder.scanForChanges();

      for (const fileKey in folder.files) {
        const file = folder.files[fileKey];

        if (file) {
          await file.scanForChanges();
        }
      }
    }
  }

  async notifyPathWasUpdatedExternal(path: string) {
    const dtNow = new Date().getTime();
    path = StorageUtilities.canonicalizePath(path);

    for (let i = 0; i < this.priorVersions.length && i < MaxRecentVersionsToConsider; i++) {
      const pv = this.priorVersions[i];

      if (
        pv.versionTime &&
        StorageUtilities.canonicalizePath(pv.file.fullPath) === StorageUtilities.canonicalizePath(path)
      ) {
        if (Math.abs(pv.versionTime.getTime() - dtNow) < WeRecentlyChangedItThresholdMs) {
          // we updated the file very recently, so ignore this change, "it's probably us"
          return;
        }
      }
    }

    if (path.startsWith(this.rootFolder.fullPath)) {
      path = StorageUtilities.ensureStartsWithDelimiter(path.substring(this.rootFolder.fullPath.length));

      const file = await this.rootFolder.getFileFromRelativePath(path);

      if (file) {
        await file.scanForChanges();
      }
    }
  }

  /**
   * Called when a new file is detected externally (e.g., by fs.watch in Electron).
   * Creates the file object in the folder tree and fires the onFileAdded event.
   *
   * @param path The full path to the newly added file
   */
  async notifyPathWasAddedExternal(path: string) {
    path = StorageUtilities.canonicalizePath(path);

    if (path.startsWith(this.rootFolder.fullPath)) {
      const relativePath = StorageUtilities.ensureStartsWithDelimiter(path.substring(this.rootFolder.fullPath.length));

      // Get the parent folder path and filename
      const lastDelim = relativePath.lastIndexOf("/");
      if (lastDelim < 0) {
        return; // No valid path structure
      }

      const folderPath = relativePath.substring(0, lastDelim);
      const fileName = relativePath.substring(lastDelim + 1);

      if (!fileName) {
        // This is a folder being added, not a file
        const folder = await this.rootFolder.ensureFolderFromRelativePath(relativePath);
        if (folder) {
          this.notifyFolderAdded(folder);
        }
        return;
      }

      // Ensure the parent folder exists in our tree
      const parentFolder = await this.rootFolder.ensureFolderFromRelativePath(folderPath || "/");

      if (parentFolder) {
        // Create the file in the folder tree
        const file = parentFolder.ensureFile(fileName);

        // Fire the event so subscribers (like Project) can react
        this.notifyFileAdded(file);
      }
    }
  }

  /**
   * Called when a file is deleted externally (e.g., by fs.watch in Electron).
   * Removes the file from the folder tree and fires the onFileRemoved event.
   *
   * @param path The full path to the removed file
   */
  async notifyPathWasRemovedExternal(path: string) {
    path = StorageUtilities.canonicalizePath(path);

    if (path.startsWith(this.rootFolder.fullPath)) {
      const relativePath = StorageUtilities.ensureStartsWithDelimiter(path.substring(this.rootFolder.fullPath.length));

      // Get the parent folder path and filename
      const lastDelim = relativePath.lastIndexOf("/");
      if (lastDelim < 0) {
        return;
      }

      const folderPath = relativePath.substring(0, lastDelim);
      const fileName = relativePath.substring(lastDelim + 1);

      if (!fileName) {
        // This might be a folder being removed
        // Try to find and remove it from the parent
        const parentPath = folderPath.substring(0, folderPath.lastIndexOf("/")) || "/";
        const parentFolder = await this.rootFolder.getFolderFromRelativePath(parentPath);
        const removedFolderName = folderPath.substring(folderPath.lastIndexOf("/") + 1);

        if (parentFolder && removedFolderName && parentFolder.folders[removedFolderName]) {
          const removedFolder = parentFolder.folders[removedFolderName];
          if (removedFolder) {
            this.notifyFolderRemoved(removedFolder);
          }
          delete parentFolder.folders[removedFolderName];
        }
        return;
      }

      // Try to find the parent folder
      const parentFolder = await this.rootFolder.getFolderFromRelativePath(folderPath || "/");

      if (parentFolder) {
        // Check if the file exists in our tree
        const file = parentFolder.files[fileName];

        if (file) {
          // Fire the event so subscribers can react
          this.notifyFileRemoved(file.fullPath);

          // Remove from the folder's files collection
          delete parentFolder.files[fileName];
        }
      }
    }
  }

  getFolderList() {
    const folders: IFolder[] = [];

    this._addFolders(this.rootFolder, folders);

    return folders;
  }

  _addFolders(folder: IFolder, folderList: IFolder[]) {
    folderList.push(folder);

    for (const folderKey in folder.folders) {
      const childFolder = folder.folders[folderKey];
      if (childFolder) {
        this._addFolders(childFolder, folderList);
      }
    }
  }

  setToVersion(versionId: string) {
    let startIndex = this.priorVersions.length - 1;

    if (this.currentVersionId) {
      for (let i = 0; i < this.priorVersions.length; i++) {
        if (this.priorVersions[i].id === this.currentVersionId) {
          startIndex = i;
        }
      }
    }

    let updateType = FileUpdateType.versionRestoration;

    if (this.currentVersionId === undefined) {
      updateType = FileUpdateType.versionRestorationRetainCurrent;
    }

    for (let i = 0; i < this.priorVersions.length; i++) {
      if (this.priorVersions[i].id === versionId) {
        // rewind to i
        if (startIndex > i) {
          for (let v = startIndex - 1; v >= i; v--) {
            const content = this.priorVersions[v].content;
            if (content !== null) {
              this.priorVersions[v].file.setContent(content, updateType);
            }
          }
        } else if (startIndex < i) {
          // fast forward to i
          for (let v = startIndex + 1; v <= i; v++) {
            const content = this.priorVersions[v].content;
            if (content !== null) {
              this.priorVersions[v].file.setContent(content, updateType);
            }
          }
        }

        this.currentVersionId = versionId;
        return;
      }
    }
  }

  trimAfterVersion(versionId: string) {
    for (let i = 0; i < this.priorVersions.length; i++) {
      if (this.priorVersions[i].id === versionId) {
        let versionsToRemove = this.priorVersions.slice(i + 1);
        this.priorVersions = this.priorVersions.slice(0, i + 1);

        for (let v = 0; v < versionsToRemove.length; v++) {
          let versionToRemove = versionsToRemove[v];

          versionToRemove.file.priorVersions = versionToRemove.file.priorVersions.filter(
            (fv) => fv.id !== versionToRemove.id
          );
        }

        break;
      }
    }
  }

  addVersion(versionContent: IVersionContent, updateType: FileUpdateType) {
    if (updateType === FileUpdateType.versionRestoration || updateType === FileUpdateType.versionlessEdit) {
      return;
    }

    // we have a new organic change in, so clear out any redo history
    if (this.currentVersionId) {
      this.trimAfterVersion(this.currentVersionId);
      this.currentVersionId = undefined;
    }

    this.priorVersions.push(versionContent);

    this.priorVersions = StorageUtilities.coalesceVersions(this.priorVersions);

    versionContent.file.priorVersions.push(versionContent);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(StorageBase.slashFolderDelimiter)) {
      fullPath += StorageBase.slashFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    const lastDelim = path.lastIndexOf(StorageBase.slashFolderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }

  abstract getAvailable(): Promise<boolean>;

  getUsesPollingBasedUpdating() {
    return false;
  }
}
