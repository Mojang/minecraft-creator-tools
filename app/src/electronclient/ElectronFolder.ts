import IFolder from "./../storage/IFolder";
import IFile from "./../storage/IFile";
import ElectronFile, { IFStatResult } from "./ElectronFile";
import ElectronStorage from "./ElectronStorage";
import StorageUtilities from "./../storage/StorageUtilities";
import FolderBase from "./../storage/FolderBase";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import Log from "./../core/Log";
import Utilities from "../core/Utilities";

export default class ElectronFolder extends FolderBase implements IFolder {
  private _name: string;
  private _path: string;

  folders: { [id: string]: ElectronFolder | undefined };
  files: { [id: string]: ElectronFile | undefined };
  private _storage: ElectronStorage;
  private _parentFolder: ElectronFolder | null;

  get storage(): ElectronStorage {
    return this._storage;
  }

  get parentFolder(): ElectronFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._path;

    if (!path.endsWith(ElectronStorage.folderDelimiter) && !path.endsWith(">")) {
      path += ElectronStorage.folderDelimiter;
    }

    return path + this.name;
  }

  constructor(storage: ElectronStorage, parentFolder: ElectronFolder | null, parentPath: string, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._path = parentPath;
    this._name = folderName;

    this.folders = {};
    this.files = {};
  }

  async scanForChanges(): Promise<void> {
    // No-op for electron storage
  }

  ensureFile(name: string): ElectronFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      Log.unsupportedToken(nameCanon);
      throw new Error();
    }

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new ElectronFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
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

  _addExistingFile(file: ElectronFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);
    if (Utilities.isUsableAsObjectKey(nameCanon)) {
      this.files[nameCanon] = file;
    }
  }

  ensureFolder(name: string): ElectronFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      Log.unsupportedToken(nameCanon);
      throw new Error();
    }

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new ElectronFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async exists(): Promise<boolean> {
    if (this.storage.available !== true) {
      const res = await this.storage.getAvailable();

      if (!res) {
        return false;
      }
    }

    if (this.storage.available === false) {
      return false;
    }

    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsFolderExists, this.fullPath);

    return result === "true";
  }

  async deleteThisFolder(): Promise<boolean> {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsDeleteFolder, this.fullPath);

    if (result === "true") {
      this.removeMeFromParent();
      return true;
    }

    return false;
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Deletion of all folder contents at " + this.fullPath + " is not supported.");
  }

  async ensureExists(): Promise<boolean> {
    Log.assert(this.fullPath.lastIndexOf("<") < 1, "Tokens in a folder path: " + this.fullPath);

    const exists = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsFolderExists, this.fullPath);

    if (exists !== "true") {
      try {
        await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsMkdir, this.fullPath);
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  _addExistingFolderToParent(folder: ElectronFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    if (!Utilities.isUsableAsObjectKey(nameCanon)) {
      Log.unsupportedToken(nameCanon);
      throw new Error();
    }

    this.folders[nameCanon] = folder;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const oldFullPath = this.fullPath;

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

      const newFullPath =
        (newParentFolder as ElectronFolder).fullPath + ElectronStorage.folderDelimiter + newFolderName;

      // Perform the disk rename BEFORE modifying in-memory tree.
      // If the disk rename fails, the in-memory tree stays consistent.
      const result = await AppServiceProxy.sendAsync(
        AppServiceProxyCommands.fsRenameFolder,
        oldFullPath + "|" + newFullPath
      );

      if (result !== "true") {
        return false;
      }

      // Disk rename succeeded — now update in-memory tree
      const previousStoragePath = this.storageRelativePath;

      this._parentFolder._removeExistingFolderFromParent(this);

      this._parentFolder = newParentFolder as ElectronFolder;

      this._name = newFolderName;
      (newParentFolder as ElectronFolder)._addExistingFolderToParent(this);

      // Notify listeners about the folder move
      this.notifyFolderMoved({
        folder: this,
        previousStoragePath: previousStoragePath,
        newStoragePath: this.storageRelativePath,
      });

      return true;
    }

    this._name = newFolderName;

    const newFullPath = this.fullPath;

    const result = await AppServiceProxy.sendAsync(
      AppServiceProxyCommands.fsRenameFolder,
      oldFullPath + "|" + newFullPath
    );

    return result === "true";
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    // Log.debug("Reading details on folder '" + this.fullPath + "'");
    const strResult = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsReaddir, this.fullPath);

    if (strResult !== undefined) {
      const results = JSON.parse(strResult);

      if (results) {
        for (const fileOrFolderName of results) {
          let filePath = this.fullPath;

          if (!filePath.endsWith(ElectronStorage.folderDelimiter)) {
            filePath += ElectronStorage.folderDelimiter;
          }

          filePath += fileOrFolderName;

          var stat = undefined;

          let statResultStr: string | undefined = "";
          let mtime: number | undefined = undefined;
          try {
            statResultStr = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsStat, filePath);

            if (statResultStr) {
              stat = JSON.parse(statResultStr) as IFStatResult;
              mtime = Date.parse(stat.mtime);
            }
          } catch (e) {
            Log.fail("Failed to parse statistics for " + fileOrFolderName + ". " + statResultStr);
          }

          if (stat) {
            if (stat.isDirectory && !StorageUtilities.isIgnorableFolder(fileOrFolderName)) {
              this.ensureFolder(fileOrFolderName);
            } else if (stat.isFile && StorageUtilities.isUsableFile(filePath)) {
              const file = this.ensureFile(fileOrFolderName);
              file.localPersistDateTime = mtime;

              if (stat.mtime) {
                file.modifiedAtLoad = new Date(stat.mtime);
              }
            }
          }
        }
      }
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
