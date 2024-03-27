// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import BrowserFile from "./BrowserFile";
import BrowserStorage from "./BrowserStorage";
import StorageUtilities from "./StorageUtilities";
import Utilities from "./../core/Utilities";
import Log from "./../core/Log";

import localforage from "localforage";
import IFolderState from "./IFolderState";
import IFileState from "./IFileState";
import IFolderSummaryState from "./IFolderSummaryState";
import FolderBase from "./FolderBase";

export default class BrowserFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;
  private _lastSavedContent: string;
  private _storage: BrowserStorage;
  private _parentFolder: BrowserFolder | null;

  get storage(): BrowserStorage {
    return this._storage;
  }

  get parentFolder(): BrowserFolder | null {
    return this._parentFolder;
  }

  folders: { [id: string]: BrowserFolder | undefined };
  files: { [id: string]: BrowserFile | undefined };

  lastSavedFileCount: number;
  modifiedAtLoad?: Date;

  get name() {
    return this._name;
  }

  get fullPath() {
    return this._parentPath + BrowserStorage.folderDelimiter + StorageUtilities.canonicalizeName(this.name);
  }

  constructor(storage: BrowserStorage, parentFolder: BrowserFolder | null, parentPath: string, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._parentPath = parentPath;
    this._name = folderName;
    this._lastSavedContent = "";

    this.lastSavedFileCount = 0;

    this.folders = {};
    this.files = {};
  }

  ensureFile(name: string): BrowserFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new BrowserFile(this, name);

      this.files[nameCanon] = candFile;

      this.storage.notifyFileAdded(candFile);
    }

    return candFile;
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async ensureExists(): Promise<boolean> {
    return true;
  }

  async deleteThisFolder(): Promise<boolean> {
    if (this.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    let result = await this.recursiveDeleteThisFolder();

    await localforage.removeItem(this.fullPath + BrowserStorage.folderDelimiter);

    return result;
  }

  ensureFolder(name: string): BrowserFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new BrowserFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
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

  _addExistingFile(file: BrowserFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const newFolderPath = StorageUtilities.getPath(newStorageRelativePath);
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

      this._parentFolder = newParentFolder as BrowserFolder;

      this._name = newFolderName;

      (newParentFolder as BrowserFolder)._addExistingFolder(this);
    }

    this._name = newFolderName;

    if (this._parentFolder !== null) {
      await this._parentFolder.save(true);
    }

    // throw new Error("Not implemented."); // need to add considerable localforage remapping, including remapping and removing source keys

    return true;
  }

  async createFile(name: string): Promise<IFile> {
    const file = this.ensureFile(name);

    this.storage.notifyFileAdded(file);

    return file;
  }

  async load(force: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    const listingContent = await localforage.getItem<string>(this.fullPath + BrowserStorage.folderDelimiter);

    if (listingContent != null) {
      this._lastSavedContent = listingContent;

      let folderState: IFolderState | undefined = undefined;

      try {
        folderState = JSON.parse(listingContent);
      } catch (e: any) {
        Log.debugAlert("Failure to parse browser folder content JSON:" + e.toString());
      }

      if (folderState) {
        for (var i = 0; i < folderState.files.length; i++) {
          const fileMeta = folderState.files[i];

          // JSON.parse doesn't fix up dates produced by JSON.stringify, so do that here.
          if (fileMeta.modified != null && !(fileMeta.modified instanceof Date)) {
            fileMeta.modified = new Date(fileMeta.modified);
          }

          const newFile = this.ensureFile(fileMeta.name);

          newFile.modifiedAtLoad = fileMeta.modified == null ? null : fileMeta.modified;

          if (newFile.sizeAtLoad === undefined) {
            newFile.sizeAtLoad = fileMeta.size;
          }
        }

        for (var j = 0; j < folderState.folders.length; j++) {
          const folderMeta = folderState.folders[j];

          // JSON.parse doesn't fix up dates produced by JSON.stringify, so do that here.
          if (folderMeta.modified != null && !(folderMeta.modified instanceof Date)) {
            folderMeta.modified = new Date(folderMeta.modified);
          }

          const newFolder = this.ensureFolder(folderMeta.name);

          newFolder.modifiedAtLoad = folderMeta.modified;
          newFolder.lastSavedFileCount = folderMeta.fileCount;
        }
      }
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }

  async save(force: boolean): Promise<Date> {
    // we need to load before we save if the only thing this folder has seen is a bunch of
    // /ensures/
    if (!this.isLoaded) {
      await this.load(false);
    }

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
      this._lastSavedContent = saveContent;
      await localforage.setItem<string>(this.fullPath + BrowserStorage.folderDelimiter, saveContent);
    }

    return this.lastLoadedOrSaved as Date;
  }

  override async saveAll(): Promise<boolean> {
    // Log.verbose("Saving all at " + this.storageRelativePath);
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    const initialDateTime = new Date().getTime();
    let needsContentSave = false;

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file !== undefined && file.needsSave) {
        let newContentSaveDate = await file.saveContent(false, true);

        if (newContentSaveDate.getTime() > initialDateTime) {
          needsContentSave = true;
        }
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder !== undefined && !folder.errorStatus) {
        needsContentSave = true;
        await folder.saveAll();
      }
    }

    if (needsContentSave || this._lastSavedContent === undefined) {
      await this.save(false);
    }

    return true;
  }
}
