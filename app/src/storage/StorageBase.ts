// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IStorage, { IFileUpdateEvent, IFolderMove, StorageErrorStatus } from "./IStorage";
import IFolder from "./IFolder";
import IFile, { FileUpdateType } from "./IFile";
import { EventDispatcher } from "ste-events";
import IVersionContent from "./IVersionContent";
import StorageUtilities from "./StorageUtilities";
import Log from "../core/Log";

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
