import VsFsFolder from "./VsFsFolder";
import IFile, { FileUpdateType } from "../storage/IFile";
import FileBase from "../storage/FileBase";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import * as vscode from "vscode";
import StorageBase from "../storage/StorageBase";

export default class VsFsFile extends FileBase implements IFile {
  _name: string;
  _parentFolder: VsFsFolder;
  _uri?: vscode.Uri;

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._parentFolder.fullPath;

    if (!path.endsWith(StorageBase.slashFolderDelimiter)) {
      path += StorageBase.slashFolderDelimiter;
    }

    return path + this.name;
  }

  get uri(): vscode.Uri {
    if (!this._uri) {
      this._uri = vscode.Uri.parse(this.fullPath);
    }

    return this._uri;
  }

  get parentFolder(): VsFsFolder {
    return this._parentFolder;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  constructor(parentFolder: VsFsFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async exists(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.uri);
    } catch (e) {
      // Log.fail("File '" + this.uri.toString() + "' does not exist");
      return false;
    }

    //Log.fail("File '" + this.uri.toString() + "' exists!");
    return true;
  }

  async reload() {
    this.lastLoadedOrSaved = null;
    await this.loadContent(false);
  }

  async loadContent(force?: boolean): Promise<Date> {
    if (force || this.lastLoadedOrSaved == null) {
      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (!(await this.exists())) {
        this._content = null;
      } else if (encoding === EncodingType.ByteBuffer) {
        // Log.debug(`VSFS loading '${this.fullPath}' as binary.`);

        let value: any = null;

        try {
          value = await vscode.workspace.fs.readFile(this.uri);

          //        if (!(value instanceof Uint8Array)) {
          value = new Uint8Array(value);
        } catch (e) {}
        //      }

        this._content = value;
        // Log.debug(`Done VSFS loading '${this.fullPath}' as binary.`);
      } else {
        // Log.debug(`VSFS loading '${this.fullPath}' as text.`);

        let value: any = null;

        try {
          value = await vscode.workspace.fs.readFile(this.uri);
        } catch (e) {}

        if (value === null) {
          this._content = null;
        } else {
          this._content = new TextDecoder().decode(value);
        }

        // Log.debug(`Done VSFS loading '${this.fullPath}' as text.`);
      }

      //  this._content += "";
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  async scanForChanges(): Promise<void> {
    // No-op for vsfs storage
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

  _invalidateUri() {
    this._uri = undefined;
  }

  async saveContent(force?: boolean): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (this.needsSave || force) {
      if (this.content != null) {
        this.parentFolder.ensureExists();

        //      const encoding = StorageUtilities.getEncodingByFileName(this._name);

        if (this.content instanceof Uint8Array) {
          // Log.verbose("VSFS saving '" + this.uri.toString() + "' as binary. size: " + this.content.length);

          await vscode.workspace.fs.writeFile(this.uri, this.content);
        } else {
          // Log.verbose("VSFS saving '" + this.uri.toString() + "' as text. size: " + this.content.length);

          await vscode.workspace.fs.writeFile(this.uri, new TextEncoder().encode(this.content));
        }
      }
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (skipRemoveFromParent !== true) {
      this._parentFolder._removeFile(this);
    }

    this._recycleItem(this.fullPath);

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

    await this.loadContent(false);

    const originalPath = this.fullPath;

    this._name = newFileName;
    this._parentFolder = newParentFolder as VsFsFolder;

    this.modified = new Date();

    (newParentFolder as VsFsFolder)._addExistingFile(this);

    this._recycleItem(originalPath);

    return true;
  }

  async _recycleItem(path: string) {
    //    await trash(path);
  }
}
