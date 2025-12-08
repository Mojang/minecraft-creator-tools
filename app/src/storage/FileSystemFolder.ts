// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import FileSystemFile from "./FileSystemFile";
import FileSystemStorage from "./FileSystemStorage";
import StorageUtilities from "./StorageUtilities";
import Utilities from "./../core/Utilities";
import Log from "./../core/Log";
import FolderBase from "./FolderBase";

export default class FileSystemFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;
  private _storage: FileSystemStorage;
  private _parentFolder: FileSystemFolder | null;
  private _handle?: FileSystemDirectoryHandle;
  private _writeHandle?: FileSystemDirectoryHandle;
  private _lastLoadedPath?: string;

  get handle(): FileSystemDirectoryHandle | undefined {
    return this._handle;
  }

  set handle(newHandle: FileSystemDirectoryHandle | undefined) {
    this._handle = newHandle;
  }

  get writeHandle(): FileSystemDirectoryHandle | undefined {
    return this._writeHandle;
  }

  set writeHandle(newHandle: FileSystemDirectoryHandle | undefined) {
    this._writeHandle = newHandle;
  }

  get storage(): FileSystemStorage {
    return this._storage;
  }

  get parentFolder(): FileSystemFolder | null {
    return this._parentFolder;
  }

  folders: { [id: string]: FileSystemFolder | undefined };
  files: { [id: string]: FileSystemFile | undefined };

  lastSavedFileCount: number;
  modifiedAtLoad?: Date;

  get name() {
    return this._name;
  }

  get fullPath() {
    return (
      this._parentPath + FileSystemStorage.fileSystemFolderDelimiter + StorageUtilities.canonicalizeName(this.name)
    );
  }

  constructor(
    storage: FileSystemStorage,
    parentFolder: FileSystemFolder | null,
    parentPath: string,
    folderName: string,
    handle?: FileSystemDirectoryHandle
  ) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;
    this._handle = handle;
    this._writeHandle = handle;

    this._parentPath = parentPath;
    this._name = folderName;

    this.lastSavedFileCount = 0;

    this.folders = {};
    this.files = {};
  }

  async getIsEmptyError(depth?: number, processedFolders?: number): Promise<string | undefined> {
    if (depth && depth > 10) {
      return "Folder hierarchy is too deep.";
    }

    await this.load(false);

    for (const fileName in this.files) {
      return "Folder '" + this.fullPath + "' is not empty.";
    }

    const folderCount = this.folderCount;

    processedFolders = processedFolders === undefined ? folderCount : processedFolders + this.folderCount;

    if (folderCount > 1000) {
      return "Folder hierarchy is too complex. (" + folderCount + " folders)";
    }

    if (processedFolders > 4000) {
      return "Too many folders to process in this folder.";
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        const result = await folder.getFirstUnsafeError(depth === undefined ? 1 : depth + 1, processedFolders);

        if (result !== undefined) {
          return result;
        }
      }
    }

    return undefined;
  }

  async scanForChanges() {
    await this.load(true);
  }

  async getFirstUnsafeError(depth?: number, processedFolders?: number): Promise<string | undefined> {
    if (depth && depth > 10) {
      return "Folder hierarchy is too deep.";
    }

    await this.load(false);

    for (const fileName in this.files) {
      const file = this.files[fileName];
      if (!StorageUtilities.isUsableFile(fileName) && file && !file.canIgnore) {
        return "Cannot work with '" + this.fullPath + fileName + "'";
      }
    }

    const folderCount = this.folderCount;

    processedFolders = processedFolders === undefined ? folderCount : processedFolders + this.folderCount;

    if (folderCount > 1000) {
      return "Folder hierarchy is too complex. (" + folderCount + " folders)";
    }

    if (processedFolders > 4000) {
      return "Too many folders to process in this folder.";
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        const result = await folder.getFirstUnsafeError(depth === undefined ? 1 : depth + 1, processedFolders);

        if (result !== undefined) {
          return result;
        }
      }
    }

    return undefined;
  }

  ensureFile(name: string, file?: FileSystemFileHandle): FileSystemFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new FileSystemFile(this, name);

      this.files[nameCanon] = candFile;

      this.storage.notifyFileAdded(candFile);
    }

    if (file) {
      candFile.handle = file;
      candFile.writeHandle = file;
    }

    return candFile;
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async ensureExists(): Promise<boolean> {
    return true;
  }

  ensureFolder(name: string, handle?: FileSystemDirectoryHandle): FileSystemFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new FileSystemFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;

      this.storage.notifyFolderAdded(candFolder);
    }

    if (handle) {
      candFolder.handle = handle;
    }

    return candFolder;
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    if (Utilities.isUsableAsObjectKey(nameCanon)) {
      const candFile = this.files[nameCanon];

      Log.assert(candFile === file, "Files don't match.");

      this.files[nameCanon] = undefined;

      this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
    }
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Deletion of all folder contents at " + this.fullPath + " is not supported.");
  }

  async _removeFileExistence(fileName: string) {
    const handle = await this.getHandle();

    await handle?.removeEntry(fileName, {
      recursive: false,
    });
  }

  _addExistingFile(file: FileSystemFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    if (Utilities.isUsableAsObjectKey(nameCanon)) {
      this.files[nameCanon] = file;
    }
  }

  _addExistingFolderToParent(folder: FileSystemFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    if (Utilities.isUsableAsObjectKey(nameCanon)) {
      this.folders[nameCanon] = folder;
    }
  }

  async loadAll() {
    if (!this.isLoaded) {
      await this.load();
    }

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file && !file.isContentLoaded) {
        await (file as FileSystemFile).loadContent();
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        await folder.loadAll();
      }
    }
  }

  async resaveAfterMove(newParentPath: string) {
    this._parentPath = newParentPath;
    this._handle = undefined;
    this._writeHandle = undefined;

    await this.getHandle();
    await this.ensureWriteHandle();

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file) {
        await (file as FileSystemFile).resaveAfterMove();
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        await folder.resaveAfterMove(this.fullPath);
      }
    }

    if (this._lastLoadedPath === undefined) {
      return;
    }

    if (this._lastLoadedPath !== StorageUtilities.ensureEndsWithDelimiter(this.fullPath)) {
      this.saveAndGetDate(true);
    }
  }

  async moveTo(newStorageRelativePath: string, ignoreParentSave?: boolean): Promise<boolean> {
    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    await this.loadAll();

    const oldPath = this._lastLoadedPath;
    if (newFolderName.length < 2) {
      throw new Error("New path is not correct.");
    }

    if (this.isSameFolder(newStorageRelativePath)) {
      return false;
    }

    let oldParentHandle: FileSystemDirectoryHandle | undefined = undefined;
    let oldChildFolderName: string | undefined = undefined;

    if (this._parentFolder == null) {
      return false;
    }

    const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

    if (newParentFolder.folders[newFolderName] !== undefined) {
      throw new Error("Folder exists at specified path.");
    }

    oldParentHandle = await this._parentFolder.ensureWriteHandle();
    oldChildFolderName = this._name;

    this._parentFolder._removeExistingFolderFromParent(this);

    this._parentFolder = newParentFolder as FileSystemFolder;

    this._name = newFolderName;

    (newParentFolder as FileSystemFolder)._addExistingFolderToParent(this);

    this._name = newFolderName;

    if (this._parentFolder !== null) {
      this._parentFolder.saveAndGetDate(true);
    }

    this.resaveAfterMove(newParentFolder.fullPath);

    if (oldChildFolderName && oldParentHandle) {
      for await (const [key, value] of oldParentHandle.entries()) {
        if (value.kind === "directory" && key.toLowerCase() === oldChildFolderName.toLowerCase()) {
          await oldParentHandle.removeEntry(oldChildFolderName, { recursive: true });
          break;
        }
      }
    }

    if (!ignoreParentSave) {
      this.notifyFolderMoved({ previousStoragePath: oldPath, newStoragePath: this.fullPath, folder: this });
    }

    return true;
  }

  async createFile(name: string): Promise<IFile> {
    const file = this.ensureFile(name);

    this.storage.notifyFileAdded(file);

    return file;
  }

  async getHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    if (!this._handle) {
      if (this._writeHandle) {
        return this._writeHandle;
      }

      if (this.parentFolder) {
        if (!this.parentFolder.handle) {
          await this.parentFolder.getHandle();
        }

        const parentFolderHandle = this.parentFolder.handle;

        if (parentFolderHandle) {
          try {
            this._handle = await parentFolderHandle.getDirectoryHandle(this.name, {
              create: false,
            });
          } catch (e) {
            // Log.debugAlert("Folder r/o retrieval: " + e);
            return undefined;
          }
        }
      }
    }

    return this._handle;
  }

  async ensureWriteHandle() {
    if (!this._writeHandle) {
      if (this.parentFolder) {
        if (!this.parentFolder.writeHandle) {
          await this.parentFolder.ensureWriteHandle();
        }

        if (this.parentFolder.writeHandle) {
          try {
            this._writeHandle = await this.parentFolder.writeHandle.getDirectoryHandle(this.name, {
              create: true,
            });
          } catch (e) {
            Log.debugAlert("Folder r/w retrieval: " + e);
          }
        }
      }
    }

    Log.assert(this._writeHandle !== undefined, "No folder handle.");

    return this._writeHandle;
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    this._lastLoadedPath = this.fullPath + FileSystemStorage.slashFolderDelimiter;

    const handle = await this.getHandle();

    if (handle) {
      const canonFolderNames: string[] = [];
      const canonFileNames: string[] = [];

      for await (const [key, value] of handle.entries()) {
        const nameCanon = StorageUtilities.canonicalizeName(key);
        if (value.kind === "file") {
          this.ensureFile(key, value as FileSystemFileHandle);
          canonFileNames.push(nameCanon);
        } else if (value.kind === "directory") {
          canonFolderNames.push(nameCanon);
          if (!StorageUtilities.isIgnorableFolder(key)) {
            this.ensureFolder(key, value as FileSystemDirectoryHandle);
          }
        }
      }

      for (const folderKey in this.folders) {
        if (!canonFolderNames.includes(folderKey)) {
          const folderToRemove = this.folders[folderKey];

          if (folderToRemove) {
            this.folders[folderKey] = undefined;
            this.storage.notifyFolderRemoved(folderToRemove);
          }
        }
      }

      for (const fileKey in this.files) {
        if (!canonFileNames.includes(fileKey)) {
          const fileToRemove = this.files[fileKey];

          if (fileToRemove) {
            this.files[fileKey] = undefined;
            this.storage.notifyFileRemoved(fileToRemove.name);
          }
        }
      }
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }

  saveAndGetDate(force: boolean): Date {
    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
