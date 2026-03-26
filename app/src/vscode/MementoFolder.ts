import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import MementoFile from "./MementoFile";
import MementoStorage from "./MementoStorage";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "./../core/Utilities";
import Log from "./../core/Log";

import IFolderState from "../storage/IFolderState";
import IFileState from "../storage/IFileState";
import IFolderSummaryState from "../storage/IFolderSummaryState";
import FolderBase from "../storage/FolderBase";
import StorageBase from "../storage/StorageBase";

export default class MementoFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;
  private _lastSavedContent: string;
  private _storage: MementoStorage;
  private _parentFolder: MementoFolder | null;

  get storage(): MementoStorage {
    return this._storage;
  }

  get parentFolder(): MementoFolder | null {
    return this._parentFolder;
  }

  folders: { [id: string]: MementoFolder | undefined };
  files: { [id: string]: MementoFile | undefined };

  lastSavedFileCount: number;
  modifiedAtLoad?: Date;

  get name() {
    return this._name;
  }

  get fullPath() {
    return this._parentPath + StorageBase.slashFolderDelimiter + StorageUtilities.canonicalizeName(this.name);
  }

  constructor(storage: MementoStorage, parentFolder: MementoFolder | null, parentPath: string, folderName: string) {
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

  ensureFile(name: string): MementoFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new MementoFile(this, name);

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

  ensureFolder(name: string): MementoFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new MementoFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Deletion of all folder contents at " + this.fullPath + " is not supported.");
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;

    this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
  }

  _addExistingFile(file: MementoFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  _addExistingFolderToParent(folder: MementoFolder) {
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

      this._parentFolder._removeExistingFolderFromParent(this);

      this._parentFolder = newParentFolder as MementoFolder;

      this._name = newFolderName;

      (newParentFolder as MementoFolder)._addExistingFolderToParent(this);
    }

    this._name = newFolderName;

    if (this._parentFolder !== null) {
      await this._parentFolder.save(true);
    }

    throw new Error("Not implemented.");
    //return true;
  }

  async scanForChanges(): Promise<void> {
    // No-op for Memento storage
  }

  async createFile(name: string): Promise<IFile> {
    const file = this.ensureFile(name);

    this.storage.notifyFileAdded(file);

    return file;
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    const listingContent = this.storage.memento.get<string>(this.fullPath + StorageBase.slashFolderDelimiter);

    if (listingContent != null) {
      this._lastSavedContent = listingContent;

      try {
        const folderState: IFolderState = JSON.parse(listingContent);

        for (var i = 0; i < folderState.files.length; i++) {
          const fileMeta = folderState.files[i];

          // JSON.parse doesn't fix up dates produced by JSON.stringify, so do that here.
          if (fileMeta.modified != null && !(fileMeta.modified instanceof Date)) {
            fileMeta.modified = new Date(fileMeta.modified);
          }

          const newFile = this.ensureFile(fileMeta.name);

          newFile.modifiedAtLoad = fileMeta.modified == null ? null : fileMeta.modified;
          newFile.lastSavedSize = fileMeta.size;
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
      } catch (e) {}
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

      if (childFolder !== undefined) {
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
      await this.storage.memento.update(this.fullPath + StorageBase.slashFolderDelimiter, saveContent);
    }

    return this.lastLoadedOrSaved as Date;
  }
}
