// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import HttpFile from "./HttpFile";
import HttpStorage from "./HttpStorage";
import StorageUtilities from "./StorageUtilities";
import FolderBase from "./FolderBase";
import Log from "../core/Log";
import axios from "axios";
import IIndexJson from "./IIndexJson";

export default class HttpFolder extends FolderBase implements IFolder {
  private _name: string;

  folders: { [name: string]: HttpFolder | undefined };
  files: { [name: string]: HttpFile | undefined };

  private _storage: HttpStorage;
  private _parentFolder: HttpFolder | null;

  private _pendingLoadRequests: ((value: unknown) => void)[] = [];
  private _isLoading = false;

  get storage(): HttpStorage {
    return this._storage;
  }

  get parentFolder(): HttpFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath(): string {
    if (this._parentFolder === null) {
      return this._storage.baseUrl;
    }

    return this._parentFolder.fullPath + this.name + HttpStorage.slashFolderDelimiter;
  }

  constructor(storage: HttpStorage, parentFolder: HttpFolder | null, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._name = folderName;
    this.folders = {};
    this.files = {};
  }

  async scanForChanges(): Promise<void> {
    await this.load(true);
  }

  async exists() {
    return true;
  }

  async ensureExists() {
    return true;
  }

  ensureFile(name: string): HttpFile {
    Log.assert(name.indexOf("/") < 0, "Unexpected to find / in file name: " + name);

    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile === undefined) {
      candFile = new HttpFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;
  }

  _addExistingFile(file: HttpFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): HttpFolder {
    Log.assert(name.indexOf("/") < 0, "Unexpected to find / in folder name: " + name);
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new HttpFolder(this._storage, this, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteFile(name: string): Promise<boolean> {
    throw new Error("Deletion of file not supported");
  }

  async createFile(name: string): Promise<IFile> {
    throw new Error("Deletion of file not supported");
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Deletion of all folder contents at " + this.fullPath + " is not supported.");
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    if (this._isLoading) {
      const pendingLoad = this._pendingLoadRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);

      if (this.lastLoadedOrSaved === null) {
        throw new Error();
      }

      return this.lastLoadedOrSaved;
    } else {
      let response = undefined;

      try {
        response = await axios.get(this.fullPath + "index.json");
      } catch (e: any) {
        Log.debug(e.message + " at " + this.fullPath + "index.json");
      }

      if (response) {
        const index: IIndexJson = response.data;

        if (index.files !== null && index.files !== undefined) {
          for (let i = 0; i < index.files.length; i++) {
            const file = index.files[i];

            if (StorageUtilities.isUsableFile(file)) {
              this.ensureFile(file);
            }
          }
        }

        if (index.folders !== null && index.folders !== undefined) {
          for (let i = 0; i < index.folders.length; i++) {
            const folder = index.folders[i];

            this.ensureFolder(folder);
          }
        }
      }

      this.updateLastLoadedOrSaved();

      this._isLoading = false;

      const pendingLoad = this._pendingLoadRequests;
      this._pendingLoadRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }

    return this.lastLoadedOrSaved as Date;
  }
}
