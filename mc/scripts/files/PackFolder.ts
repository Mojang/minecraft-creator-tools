import IFolder from "../app/storage/IFolder";
import IFile from "../app/storage/IFile";
import StorageUtilities from "../app/storage/StorageUtilities";
import FolderBase from "../app/storage/FolderBase";
import Log from "../app/core/Log";
import PackStorage from "./PackStorage";
import PackFile from "./PackFile";

export default class PackFolder extends FolderBase implements IFolder {
  private _name: string;

  folders: { [name: string]: PackFolder | undefined };
  files: { [name: string]: PackFile | undefined };

  private _storage: PackStorage;
  private _parentFolder: PackFolder | null;

  get storage(): PackStorage {
    return this._storage;
  }

  get parentFolder(): PackFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath(): string {
    if (this._parentFolder === null) {
      return "/";
    }

    return this._parentFolder.fullPath + this.name + PackStorage.folderDelimiter;
  }

  constructor(storage: PackStorage, parentFolder: PackFolder | null, folderName: string) {
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

  ensureFile(name: string): PackFile {
    let nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile === undefined) {
      candFile = new PackFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  _removeFile(file: IFile) {
    let nameCanon = StorageUtilities.canonicalizeName(file.name);

    let candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;
  }

  _addExistingFile(file: PackFile) {
    let nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): IFolder {
    let nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new PackFolder(this._storage, this, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteThisFolder() {
    return true;
  }

  async deleteFile(name: string): Promise<boolean> {
    throw new Error("Deletion of file not supported");
  }

  async createFile(name: string): Promise<IFile> {
    throw new Error("Deletion of file not supported");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    return true;
  }

  async scanForChanges(): Promise<void> {
    return;
  }

  async load(force: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
