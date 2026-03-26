import FileBase from "../app/storage/FileBase";
import IFile from "../app/storage/IFile";
import StorageUtilities, { EncodingType } from "../app/storage/StorageUtilities";
import Log from "../app/core/Log";
import PackFolder from "./PackFolder";

export default class PackFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: PackFolder;
  private _hasImported: boolean = false;

  public jsonObject?: object;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return true;
  }

  get parentFolder(): PackFolder {
    return this._parentFolder;
  }

  get fullPath() {
    return this._parentFolder.fullPath + this.name;
  }

  constructor(parentFolder: PackFolder, folderName: string) {
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

      if (!this._hasImported) {
        this._hasImported = true;

        // TODO: Implement dynamic import of pack data.
        // Original approach (commented out) used dynamic import paths:
        //   import("../../data" + this.parentFolder.fullPath + StorageUtilities.getBaseFromName(this._name));
      }
    }

    return this.lastLoadedOrSaved;
  }

  async deleteFile(): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("PackFile is read-only.");
  }

  setJsonObject(newContent: object) {
    this.jsonObject = newContent;
    this._content = JSON.stringify(newContent);
  }

  setContent(newContent: string | Uint8Array | null) {
    this._content = newContent;

    return true;
  }

  async scanForChanges(): Promise<void> {
    return;
  }

  async saveContent(): Promise<Date> {
    throw new Error("PackFile is read-only.");
  }
}
