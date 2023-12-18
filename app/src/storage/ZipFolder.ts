import IFolder from "./IFolder";
import IFile from "./IFile";
import ZipFile from "./ZipFile";
import ZipStorage from "./ZipStorage";
import JSZip from "jszip";
import StorageUtilities from "./StorageUtilities";
import FolderBase from "./FolderBase";
import Utilities from "../core/Utilities";
import Log from "../core/Log";

export default class ZipFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;

  folders: { [id: string]: ZipFolder | undefined };
  files: { [id: string]: ZipFile | undefined };

  private _storage: ZipStorage;
  private _parentFolder: ZipFolder | null;

  private _jsz: JSZip;

  get zip() {
    return this._jsz;
  }

  set zip(newZip: JSZip) {
    this._jsz = newZip;
  }

  get storage(): ZipStorage {
    return this._storage;
  }

  get parentFolder(): ZipFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    if (!this.parentFolder) {
      return "/";
    }

    return StorageUtilities.ensureEndsWithDelimiter(this._parentPath) + this.name;
  }

  constructor(
    storage: ZipStorage,
    jszipThisFolder: JSZip,
    parentFolder: ZipFolder | null,
    parentPath: string,
    folderName: string
  ) {
    super();

    this._jsz = jszipThisFolder;

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._parentPath = parentPath;
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

  ensureFile(name: string): ZipFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      const zipObject = this._jsz.file(name);

      candFile = new ZipFile(this, name, zipObject);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  ensureFolder(name: string): ZipFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      const zipFolder = this._jsz.folder(name);

      if (zipFolder == null) {
        throw new Error("unexpected inability to create a zip file folder");
      }

      candFolder = new ZipFolder(this._storage, zipFolder as JSZip, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteFile(name: string): Promise<boolean> {
    throw new Error("Deletion of file not supported");
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force: boolean): Promise<Date> {
    if (this.lastProcessed != null && !force) {
      return this.lastProcessed;
    }

    this.updateLastProcessed();

    this._jsz.forEach((relativePath: string, file: JSZip.JSZipObject) => {
      const countDelim = Utilities.countChar(relativePath, ZipStorage.folderDelimiter);

      if (countDelim === 0) {
        const nameCanon = StorageUtilities.canonicalizeName(relativePath);

        let candFile = this.files[nameCanon];

        if (candFile == null) {
          candFile = new ZipFile(this, relativePath, file);

          this.files[nameCanon] = candFile;
        }
      } else if (countDelim >= 1) {
        let lastFolder: IFolder = this;
        let subPath = relativePath;

        if (subPath.startsWith("/")) {
          subPath = subPath.substring(1);
        }

        let nextDelim = subPath.indexOf(ZipStorage.folderDelimiter);

        while (nextDelim > 0) {
          lastFolder = lastFolder.ensureFolder(subPath.substring(0, nextDelim));

          subPath = subPath.substring(nextDelim + 1);
          nextDelim = subPath.indexOf(ZipStorage.folderDelimiter);
        }

        if (subPath.length > 0 && file) {
          Log.assert(!file.dir, "Unexpected non directory file.");
          const zipFile = lastFolder.ensureFile(subPath) as ZipFile;
          zipFile.updateZipNativeFile(file);
        }
      }
    });

    return this.lastProcessed as Date;
  }
}
