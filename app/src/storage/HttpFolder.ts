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

    return this._parentFolder.fullPath + this.name + HttpStorage.folderDelimiter;
  }

  constructor(storage: HttpStorage, parentFolder: HttpFolder | null, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

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

  ensureFile(name: string): HttpFile {
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

  async load(force: boolean): Promise<Date> {
    if (this.lastProcessed != null && !force) {
      return this.lastProcessed;
    }

    let response = undefined;

    try {
      response = await axios.get(this.fullPath + "index.json");
    } catch (e: any) {
      Log.debug(e);
    }

    if (response) {
      const index: IIndexJson = response.data;

      if (index.files !== null && index.files !== undefined) {
        for (let i = 0; i < index.files.length; i++) {
          const file = index.files[i];

          this.ensureFile(file);
        }
      }

      if (index.folders !== null && index.folders !== undefined) {
        for (let i = 0; i < index.folders.length; i++) {
          const folder = index.folders[i];

          this.ensureFolder(folder);
        }
      }
    }

    this.updateLastProcessed();

    return this.lastProcessed as Date;
  }
}
