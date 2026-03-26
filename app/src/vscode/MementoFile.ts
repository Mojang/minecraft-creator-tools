import FileBase from "../storage/FileBase";
import MementoFolder from "./MementoFolder";
import IFile, { FileUpdateType } from "../storage/IFile";
import MementoStorage from "./MementoStorage";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

export default class MementoFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: MementoFolder;

  lastSavedSize: number;

  get name(): string {
    return this._name;
  }

  get parentFolder(): MementoFolder {
    return this._parentFolder;
  }

  get fullPath(): string {
    return this._parentFolder.fullPath + MementoStorage.slashFolderDelimiter + this.name;
  }

  get size(): number {
    if (this.content == null) {
      return -1;
    }

    return this.content.length;
  }

  constructor(parentFolder: MementoFolder, fileName: string) {
    super();

    this.lastSavedSize = -1;

    this._parentFolder = parentFolder;
    this._name = fileName;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (skipRemoveFromParent !== true) {
      this._parentFolder._removeFile(this);
    }

    await this.parentFolder.storage.memento.update(this.fullPath, undefined);

    return true;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFileName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFileName.length < 2) {
      throw new Error("New path is not correct.");
    }

    const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

    if (newParentFolder.files[newFileName] !== undefined) {
      throw new Error("File exists at specified path.");
    }

    await this.loadContent();

    const originalPath = this.fullPath;

    this._name = newFileName;
    this._parentFolder = newParentFolder as MementoFolder;

    this.modified = new Date();

    (newParentFolder as MementoFolder)._addExistingFile(this);

    await this.parentFolder.storage.memento.update(originalPath, undefined);

    return true;
  }

  async loadContent(force?: boolean): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      const val = await this.parentFolder.storage.memento.get<string>(this.fullPath);

      if (val) {
        this._content = val;
      } else {
        this._content = null;
      }

      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null, updateType?: FileUpdateType) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);

    if (areEqual) {
      return false;
    }

    if (!this.lastLoadedOrSaved) {
      this.lastLoadedOrSaved = new Date();
      this.lastLoadedOrSaved = new Date(this.lastLoadedOrSaved.getTime() - 1);

      // Log.debugAlert("Setting a file without loading it first.");
    }

    let oldContent = this._content;
    this._content = newContent;

    this.contentWasModified(oldContent, updateType);

    return true;
  }

  async scanForChanges(): Promise<void> {
    // No-op for Memento storage
  }

  async saveContent(force?: boolean): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (this.needsSave || force) {
      /*let contentDescript = "null";

      if (this.content instanceof Uint8Array) {
        contentDescript = this.content.length + " bytes";
      } else if (typeof this.content === "string") {
        contentDescript = this.content.length + " text";
      }*/

      Log.assert(this.content !== null, "Null content found.");

      // Log.debug("Saving file " + contentDescript + " to '" + this.fullPath + "'");

      await this.parentFolder.storage.memento.update(this.fullPath, this.content);

      await this._parentFolder.save(false);
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }
}
