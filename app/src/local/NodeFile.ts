import NodeFolder from "./NodeFolder";
import NodeStorage from "./NodeStorage";
import IFile from "../storage/IFile";
import FileBase from "../storage/FileBase";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import * as crypto from "crypto";
import * as fs from "fs";

export default class NodeFile extends FileBase implements IFile {
  _name: string;
  _parentFolder: NodeFolder;

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._parentFolder.fullPath;

    if (!path.endsWith(NodeStorage.folderDelimiter)) {
      path += NodeStorage.folderDelimiter;
    }

    return path + this.name;
  }

  get parentFolder(): NodeFolder {
    return this._parentFolder;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  constructor(parentFolder: NodeFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async exists(): Promise<boolean> {
    return fs.existsSync(this.fullPath);
  }

  async loadContent(force: boolean): Promise<Date> {
    if (force || this.lastLoadedOrSaved == null) {
      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (!fs.existsSync(this.fullPath)) {
        this._content = null;
      } else if (encoding === EncodingType.ByteBuffer) {
        // Log.debug(`NodeFS loading '${this.fullPath}' as binary.`);
        const byteResult = fs.readFileSync(this.fullPath);

        if (byteResult instanceof ArrayBuffer) {
          this._content = new Uint8Array(byteResult as ArrayBuffer);
        } else {
          this._content = byteResult;
        }
      } else {
        // Log.debug(`NodeFS loading '${this.fullPath}' as text.`);

        this._content = fs.readFileSync(this.fullPath, { encoding: "utf8" });
      }

      //  this._content += "";
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);

    if (!areEqual) {
      if (!this.lastLoadedOrSaved) {
        this.lastLoadedOrSaved = new Date();
        this.lastLoadedOrSaved = new Date(this.lastLoadedOrSaved.getTime() - 1);

        // Log.debugAlert("Setting a file without loading it first.");
      }

      this._content = newContent;

      this.contentWasModified();
    }
  }

  async getHash(): Promise<string | undefined> {
    await this.loadContent(false);

    if (this._content === undefined || this._content === null) {
      return undefined;
    }

    const hash = crypto.createHash("MD5");

    hash.update(this._content);

    return hash.digest("base64");
  }

  async saveContent(): Promise<Date> {
    if (this.needsSave) {
      this.lastLoadedOrSaved = new Date();

      if (this.content != null) {
        this.parentFolder.ensureExists();

        const encoding = StorageUtilities.getEncodingByFileName(this._name);

        if (encoding === EncodingType.ByteBuffer) {
          // Log.verbose("Saving '" + this.fullPath + "' as binary. size: " + this.content.length);

          fs.writeFileSync(this.fullPath, this.content);
        } else {
          // Log.verbose("Saving '" + this.fullPath + "' as text. size: " + this.content.length);

          fs.writeFileSync(this.fullPath, this.content, { encoding: "utf8" });
        }
      }
    }

    if (this.lastLoadedOrSaved === null) {
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  async deleteFile(): Promise<boolean> {
    this._parentFolder._removeFile(this);

    this._recycleItem(this.fullPath);

    return true;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const newFolderPath = StorageUtilities.getPath(newStorageRelativePath);
    const newFileName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFileName.length < 2) {
      throw new Error("New path is not correct.");
    }

    const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

    if (newParentFolder.files[newFileName] !== undefined) {
      throw new Error("File exists at specified path.");
    }

    await this.loadContent(false);

    const originalPath = this.fullPath;

    this._name = newFileName;
    this._parentFolder = newParentFolder as NodeFolder;

    this.modified = new Date();

    (newParentFolder as NodeFolder)._addExistingFile(this);

    this._recycleItem(originalPath);

    return true;
  }

  async _recycleItem(path: string) {
    //    await trash(path);
  }
}
