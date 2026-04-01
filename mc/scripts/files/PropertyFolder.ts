import IFolder from "./../app/storage/IFolder";
import IFile from "./../app/storage/IFile";
import PropertyFile from "./PropertyFile";
import PropertyStorage from "./PropertyStorage";
import StorageUtilities from "./../app/storage/StorageUtilities";
import FolderBase from "./../app/storage/FolderBase";
import Log from "./../app/core/Log";
import { EventDispatcher, IEvent } from "ste-events";
import { IFolderMove } from "../app/storage/IStorage";

export default class PropertyFolder extends FolderBase implements IFolder {
  private _name: string;

  folders: { [name: string]: PropertyFolder | undefined };
  files: { [name: string]: PropertyFile | undefined };

  private _storage: PropertyStorage;
  private _parentFolder: PropertyFolder | null;

  private _onFolderMoved = new EventDispatcher<FolderBase, IFolderMove>();
  private _onChildFolderMoved = new EventDispatcher<FolderBase, IFolderMove>();

  get onFolderMoved() {
    return this._onFolderMoved.asEvent();
  }

  get onChildFolderMoved() {
    return this._onChildFolderMoved.asEvent();
  }

  get storage(): PropertyStorage {
    return this._storage;
  }

  get parentFolder(): PropertyFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath(): string {
    if (this._parentFolder === null) {
      return this._storage.baseName;
    }

    return this._parentFolder.fullPath + this.name + PropertyStorage.folderDelimiter;
  }

  constructor(storage: PropertyStorage, parentFolder: PropertyFolder | null, folderName: string) {
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

  ensureFile(name: string): PropertyFile {
    let nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile === undefined) {
      candFile = new PropertyFile(this, name);

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

  _addExistingFile(file: PropertyFile) {
    let nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): IFolder {
    let nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new PropertyFolder(this._storage, this, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteThisFolder() {
    return true;
  }

  async deleteAllFolderContents(): Promise<boolean> {
    return true;
  }

  async scanForChanges(): Promise<void> {
    return;
  }

  async deleteFile(name: string): Promise<boolean> {
    throw new Error("Deletion of file not supported");
  }

  async createFile(name: string): Promise<IFile> {
    throw new Error("Deletion of file not supported");
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    let response = undefined;
    /*
    try {
      response = await axios.get(this.fullPath + "index.json");
    } catch (e: any) {
      Log.debug(e);
    }

    if (response) {
      let index: IIndexJson = response.data;

      if (index.files !== null && index.files !== undefined) {
        for (let i = 0; i < index.files.length; i++) {
          let file = index.files[i];

          this.ensureFile(file);
        }
      }

      if (index.folders !== null && index.folders !== undefined) {
        for (let i = 0; i < index.folders.length; i++) {
          let folder = index.folders[i];

          this.ensureFolder(folder);
        }
      }
    }*/

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
