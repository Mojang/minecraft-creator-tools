// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import File from "./File";
import Storage from "./Storage";
import StorageUtilities from "./StorageUtilities";
import FolderBase from "./FolderBase";
import Log from "../core/Log";

export default class Folder extends FolderBase implements IFolder {
  private _name: string;
  private _path: string;

  folders: { [name: string]: Folder | undefined };
  files: { [name: string]: File | undefined };

  private _storage: Storage;
  private _parentFolder: Folder | null;

  get storage(): Storage {
    return this._storage;
  }

  get parentFolder(): Folder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    return this._path + Storage.folderDelimiter + this.name;
  }

  constructor(storage: Storage, parentFolder: Folder | null, parentPath: string, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._path = parentPath;
    this._name = folderName;
    this.folders = {};
    this.files = {};
  }

  async exists() {
    return true;
  }

  async ensureExists() {
    return true;
  }

  ensureFile(name: string): File {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile === undefined) {
      candFile = new File(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;
  }

  _addExistingFile(file: File) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): Folder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new Folder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  _addExistingFolder(folder: Folder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = folder;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFolderName.length < 2) {
      throw new Error("New path is not correct.");
    }

    if (this._parentFolder !== null) {
      const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

      if (newParentFolder.folders[newFolderName] !== undefined) {
        throw new Error("Folder exists at specified path.");
      }
      this._parentFolder = newParentFolder as Folder;

      (newParentFolder as Folder)._addExistingFolder(this);
    }

    this._name = newFolderName;

    return true;
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
