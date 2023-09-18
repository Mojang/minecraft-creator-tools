import IFolder from "./../storage/IFolder";
import IFile from "./../storage/IFile";
import MessageProxyFile from "./MessageProxyFile";
import MessageProxyStorage from "./MessageProxyStorage";
import StorageUtilities from "./../storage/StorageUtilities";
import FolderBase from "./../storage/FolderBase";
import MessageProxy, { MessageProxyCommands } from "./MessageProxy";
import Log from "./../core/Log";

export default class MessageProxyFolder extends FolderBase implements IFolder {
  private _name: string;
  private _path: string;

  folders: { [id: string]: MessageProxyFolder | undefined };
  files: { [id: string]: MessageProxyFile | undefined };
  private _storage: MessageProxyStorage;
  private _parentFolder: MessageProxyFolder | null;

  get storage(): MessageProxyStorage {
    return this._storage;
  }

  get parentFolder(): MessageProxyFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._path;

    if (!path.endsWith(MessageProxyStorage.folderDelimiter)) {
      path += MessageProxyStorage.folderDelimiter;
    }

    path += this.name;

    if (!path.endsWith(MessageProxyStorage.folderDelimiter)) {
      path += MessageProxyStorage.folderDelimiter;
    }

    return path;
  }

  constructor(
    storage: MessageProxyStorage,
    parentFolder: MessageProxyFolder | null,
    parentPath: string,
    folderName: string
  ) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._path = parentPath;
    this._name = folderName;

    this.folders = {};
    this.files = {};
  }

  ensureFile(name: string): MessageProxyFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new MessageProxyFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;

    this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
  }

  _addExistingFile(file: MessageProxyFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  ensureFolder(name: string): MessageProxyFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new MessageProxyFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async exists(): Promise<boolean> {
    return await MessageProxy.sendAsync(MessageProxyCommands.fsFolderExists, this.storage.channelId, this.fullPath);
  }

  async ensureExists(): Promise<boolean> {
    const exists = await MessageProxy.sendAsync(
      MessageProxyCommands.fsFolderExists,
      this.storage.channelId,
      this.fullPath
    );

    if (!exists) {
      // Log.message("Creating folder '" + this.fullPath + "'");

      try {
        await MessageProxy.sendAsync(MessageProxyCommands.fsMkdir, this.storage.channelId, this.fullPath);
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  _addExistingFolder(folder: MessageProxyFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = folder;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    // let oldFullPath = this.fullPath;

    const newFolderPath = StorageUtilities.getPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFolderName.length < 2) {
      throw new Error("New path is not correct.");
    }

    if (this._parentFolder !== null) {
      const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

      if (newParentFolder.folders[newFolderName] !== undefined) {
        throw new Error("Folder exists at specified path.");
      }

      this._parentFolder = newParentFolder as MessageProxyFolder;

      this._name = newFolderName;

      (newParentFolder as MessageProxyFolder)._addExistingFolder(this);
    }

    this._name = newFolderName;

    // let newFullPath = this.fullPath;

    throw new Error("Not implemented exception");
    // fs.renameSync(oldFullPath, newFullPath);

    // return true;
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force: boolean): Promise<Date> {
    if (this.lastProcessed != null && !force) {
      return this.lastProcessed;
    }

    if (!this.storage.isEnabled) {
      Log.debugAlert(
        "Unexpected usage of a disabled storage (loading folder '" +
          this.fullPath +
          "') on storage '" +
          this.storage.channelId +
          "'"
      );
      throw new Error();
    }

    const results = (await MessageProxy.sendAsync(
      MessageProxyCommands.fsReaddir,
      this.storage.channelId,
      this.fullPath
    )) as string[];

    for (const fileName of results) {
      if (StorageUtilities.isUsableFile(fileName)) {
        let filePath = this.fullPath;

        if (!filePath.endsWith(MessageProxyStorage.folderDelimiter)) {
          filePath += MessageProxyStorage.folderDelimiter;
        }

        filePath += fileName;

        const stat = await MessageProxy.sendAsync(MessageProxyCommands.fsStat, this.storage.channelId, filePath);

        if (stat.isDirectory) {
          this.ensureFolder(fileName);
        } else if (stat.isFile && StorageUtilities.isUsableFile(filePath)) {
          const file = this.ensureFile(fileName);

          if (stat.mtime) {
            file.modifiedAtLoad = new Date(stat.mtime);
          }
        }
      }
    }

    this.updateLastProcessed();

    return this.lastProcessed as Date;
  }
}
