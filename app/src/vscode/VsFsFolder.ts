import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import VsFsFile from "./VsFsFile";
import VsFsStorage from "./VsFsStorage";
import StorageUtilities from "../storage/StorageUtilities";
import FolderBase from "../storage/FolderBase";
import Log from "./../core/Log";
import * as vscode from "vscode";
import Utilities from "../core/Utilities";
import StorageBase from "../storage/StorageBase";

export default class VsFsFolder extends FolderBase implements IFolder {
  private _name?: string;
  private _path: string;

  private _uri?: vscode.Uri;

  folders: { [id: string]: VsFsFolder | undefined };
  files: { [id: string]: VsFsFile | undefined };
  private _storage: VsFsStorage;
  private _parentFolder: VsFsFolder | null;

  get storage(): VsFsStorage {
    return this._storage;
  }

  get uri(): vscode.Uri {
    if (!this._uri) {
      this._uri = vscode.Uri.parse(this.fullPath);
    }

    return this._uri;
  }

  get parentFolder(): VsFsFolder | null {
    return this._parentFolder;
  }

  get name() {
    if (!this._name) {
      return "";
    }

    return this._name;
  }

  get fullPath() {
    let path = this._path;

    if (this._name && this._name.length > 0) {
      path += this._name + StorageBase.slashFolderDelimiter;
    }

    if (path === null) {
      return this.storage.path;
    }

    return Utilities.ensureEndsWithSlash(path);
  }

  constructor(storage: VsFsStorage, parentFolder: VsFsFolder | null, parentPath: string, folderName?: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._path = parentPath;
    this._name = folderName;

    this.folders = {};
    this.files = {};
  }

  async scanForChanges(): Promise<void> {
    // No-op for vsfs storage
  }

  ensureFile(name: string): VsFsFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new VsFsFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Deletion of all folder contents at " + this.fullPath + " is not supported.");
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }
    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;

    this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
  }

  _addExistingFile(file: VsFsFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }
    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): VsFsFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new VsFsFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  _addExistingFolderToParent(folder: VsFsFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }
    this.folders[nameCanon] = folder;
  }

  _removeExistingFolder(folder: VsFsFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      throw new Error();
    }
    this.folders[nameCanon] = undefined;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const oldFullPath = this.fullPath;

    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (this.isSameFolder(newStorageRelativePath)) {
      return false;
    }

    if (newFolderName.length < 1) {
      throw new Error("New path is not well formed.");
    }

    if (this._parentFolder !== null) {
      const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

      if (newParentFolder.folders[newFolderName] !== undefined) {
        throw new Error("Folder exists at specified path.");
      }

      if (this._parentFolder !== newParentFolder) {
        this._parentFolder._removeExistingFolder(this);
        this._parentFolder = newParentFolder as VsFsFolder;

        this._name = newFolderName;

        (newParentFolder as VsFsFolder)._addExistingFolderToParent(this);
      }
    }

    this._name = newFolderName;

    const newFullPath = this.fullPath;

    Log.debug("Renaming folder from '" + oldFullPath + "' to '" + newFullPath + "'");

    vscode.workspace.fs.rename(vscode.Uri.parse(oldFullPath), vscode.Uri.parse(newFullPath));

    this._invalidateUri();

    return true;
  }

  _invalidateUri() {
    this._uri = undefined;

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file) {
        file._invalidateUri();
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        folder._invalidateUri();
      }
    }
  }

  async exists(): Promise<boolean> {
    let result: vscode.FileStat | undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      result = await vscode.workspace.fs.stat(this.uri);
    } catch (e) {
      return false;
    }

    return true;
  }

  async ensureExists(): Promise<boolean> {
    const exists = await this.exists();

    //    Log.fail("Creating folder '" + this.fullPath + "'");

    if (!exists) {
      vscode.workspace.fs.createDirectory(this.uri);
    }

    return true;
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    //Log.debug("Reading details on folder '" + this.fullPath + "' " + this.uri.toString());
    let results: [string, vscode.FileType][] = [];

    // this command seems to fail when passed the path to the root of the
    // extension URI. In this case, assume most operations are "ensured" so will
    // continue to work anyways
    try {
      results = await vscode.workspace.fs.readDirectory(this.uri);
    } catch (e: any) {
      Log.debug(
        "Could not read details on folder '" +
          this.fullPath +
          "' " +
          this.uri.toString() +
          " " +
          e.toString() +
          ". It may not exist."
      );
    }

    if (results) {
      for (const [name, type] of results) {
        const canonName = StorageUtilities.canonicalizeName(name);
        // Log.debug("Considering VSFS file: " + name + "|" + canonName);

        if (type === vscode.FileType.File) {
          const file = this.ensureFile(canonName);

          const stat = await vscode.workspace.fs.stat(file.uri);

          if (stat.mtime) {
            file.modifiedAtLoad = new Date(stat.mtime);
          }
        } else if (type === vscode.FileType.Directory) {
          this.ensureFolder(canonName);
        }
      }
    }

    this.updateLastLoadedOrSaved();

    // Log.debug("Completed load of folder '" + this.fullPath + "'");
    return this.lastLoadedOrSaved as Date;
  }
}
