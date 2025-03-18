// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import FileSystemFile from "./FileSystemFile";
import FileSystemStorage from "./FileSystemStorage";
import StorageUtilities from "./StorageUtilities";
import Utilities from "./../core/Utilities";
import Log from "./../core/Log";

import IFolderState from "./IFolderState";
import IFileState from "./IFileState";
import IFolderSummaryState from "./IFolderSummaryState";
import FolderBase from "./FolderBase";

export default class FileSystemFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;
  private _lastSavedContent: string;
  private _storage: FileSystemStorage;
  private _parentFolder: FileSystemFolder | null;
  private _handle?: FileSystemDirectoryHandle;
  private _writeHandle?: FileSystemDirectoryHandle;

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
    this._lastSavedContent = "";

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

  async getFirstUnsafeError(depth?: number, processedFolders?: number): Promise<string | undefined> {
    if (depth && depth > 10) {
      return "Folder hierarchy is too deep.";
    }

    await this.load(false);

    for (const fileName in this.files) {
      if (!StorageUtilities.isUsableFile(fileName)) {
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
    }

    if (handle) {
      candFolder.handle = handle;
    }

    return candFolder;
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;

    this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
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

    this.files[nameCanon] = file;
  }

  _addExistingFolder(folder: FileSystemFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = folder;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFolderName.length < 2) {
      throw new Error("New path is not correct.");
    }

    if (this.isSameFolder(newStorageRelativePath)) {
      return false;
    }

    if (this._parentFolder !== null) {
      const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

      if (newParentFolder.folders[newFolderName] !== undefined) {
        throw new Error("Folder exists at specified path.");
      }

      this._parentFolder._clearExistingFolder(this);

      this._parentFolder = newParentFolder as FileSystemFolder;

      this._name = newFolderName;

      (newParentFolder as FileSystemFolder)._addExistingFolder(this);
    }

    this._name = newFolderName;

    if (this._parentFolder !== null) {
      await this._parentFolder.save(true);
    }

    throw new Error("Not implemented.");

    //return true;
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
        const parentFolderHandle = await this.parentFolder.getHandle();

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
        await this.parentFolder.ensureWriteHandle();

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

    const handle = await this.getHandle();

    if (handle) {
      for await (const [key, value] of handle.entries()) {
        if (value.kind === "file") {
          this.ensureFile(key, value as FileSystemFileHandle);
        } else if (value.kind === "directory") {
          const keyLower = key.toLowerCase();
          if (keyLower !== ".git" && keyLower !== "node_modules") {
            this.ensureFolder(key, value as FileSystemDirectoryHandle);
          }
        }
      }
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }

  async save(force: boolean): Promise<Date> {
    this.updateLastLoadedOrSaved();

    const folderState: IFolderState = {
      updated: this.lastLoadedOrSaved as Date,
      files: [],
      folders: [],
    };

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file !== undefined) {
        const fileState: IFileState = {
          name: file.name,
          size: file.size,
          modified: file.latestModified == null ? new Date() : file.latestModified,
        };

        folderState.files.push(fileState);
      }
    }

    for (const folderName in this.folders) {
      const childFolder = this.folders[folderName];

      if (childFolder !== undefined && !childFolder.errorStatus) {
        const childFolderState: IFolderSummaryState = {
          name: childFolder.name,
          fileCount: Utilities.lengthOfDictionary(childFolder.files),
          modified: childFolder.modifiedAtLoad == null ? new Date() : childFolder.modifiedAtLoad,
        };

        folderState.folders.push(childFolderState);
      }
    }

    const saveContent = JSON.stringify(folderState);

    if (this._lastSavedContent !== saveContent || force) {
      //  await localforage.setItem<string>(this.fullPath + FileSystemStorage.folderDelimiter, saveContent);
    }

    return this.lastLoadedOrSaved as Date;
  }
}
