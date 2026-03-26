import FileBase from "./../app/storage/FileBase";
import PropertyFolder from "./PropertyFolder";
import IFile from "./../app/storage/IFile";
import StorageUtilities, { EncodingType } from "./../app/storage/StorageUtilities";

export default class PropertyFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: PropertyFolder;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return true;
  }

  get parentFolder(): PropertyFolder {
    return this._parentFolder;
  }

  get fullPath() {
    return this._parentFolder.fullPath + this.name;
  }

  constructor(parentFolder: PropertyFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  get isBinary() {
    return false;
  }

  get isString() {
    return true;
  }

  async scanForChanges(): Promise<void> {
    return;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean | undefined): Promise<boolean> {
    return false;
  }

  async exists() {
    await this.loadContent(false);

    return this._content !== null;
  }

  async loadContent(force?: boolean): Promise<Date> {
    //        Log.assert(this.fullPath.startsWith("/"), "Expecting a full absolute path");

    if (force || !this.lastLoadedOrSaved) {
      this.lastLoadedOrSaved = new Date();

      this._content = null;

      let path = this.fullPath;

      /*      if (this.fullPath.startsWith("/")) {
        path = this.fullPath.substring(1, this.fullPath.length);
      }*/

      if (StorageUtilities.getEncodingByFileName(this.name) === EncodingType.ByteBuffer) {
        // TODO: Load binary content from property storage
      } else {
        // TODO: Load text content from property storage
      }
    }

    return this.lastLoadedOrSaved;
  }

  async deleteFile(): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  setContent(newContent: string | Uint8Array | null): boolean {
    throw new Error("HttpFile is read-only.");
  }

  async saveContent(): Promise<Date> {
    throw new Error("HttpFile is read-only.");
  }
}
