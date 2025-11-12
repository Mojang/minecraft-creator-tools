// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileBase from "./FileBase";
import BrowserFolder from "./BrowserFolder";
import IFile, { FileUpdateType } from "./IFile";
import BrowserStorage from "./BrowserStorage";
import StorageUtilities from "./StorageUtilities";
import localforage from "localforage";
import Log from "../core/Log";

export default class BrowserFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: BrowserFolder;
  private _lastLoadedPath?: string;
  sizeAtLoad?: number;

  get name(): string {
    return this._name;
  }

  get parentFolder(): BrowserFolder {
    return this._parentFolder;
  }

  get fullPath(): string {
    return this._parentFolder.fullPath + BrowserStorage.slashFolderDelimiter + this.name;
  }

  get size(): number {
    if (this.content == null) {
      return -1;
    }

    return this.content.length;
  }

  constructor(parentFolder: BrowserFolder, fileName: string) {
    super();

    this.sizeAtLoad = undefined;

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

      await this._parentFolder.save(false);
    }

    await localforage.removeItem(this.fullPath);

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
    this._parentFolder = newParentFolder as BrowserFolder;

    this.modified = new Date();

    (newParentFolder as BrowserFolder)._addExistingFile(this);

    await localforage.removeItem(originalPath);

    return true;
  }

  async loadContent(force?: boolean): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      this._lastLoadedPath = this.fullPath;
      this._content = await localforage.getItem(this.fullPath);

      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  async resaveAfterMove() {
    if (this._lastLoadedPath === undefined) {
      return;
    }

    if (this._lastLoadedPath !== this.fullPath) {
      // store old path because saving will change _lastLoadedPath
      const oldPath = this._lastLoadedPath;

      await this.saveContent(true, true);

      await localforage.removeItem(oldPath);
    }
  }

  async scanForChanges(): Promise<void> {
    // No-op for browser storage
  }

  setContent(newContent: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string) {
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

    if (
      this.isInErrorState &&
      typeof newContent === "string" &&
      StorageUtilities.getMimeType(this) === "application/json"
    ) {
      StorageUtilities.getJsonObject(this);
    }

    this.contentWasModified(oldContent, updateType, sourceId);

    return true;
  }

  async saveContent(force?: boolean, skipParentFolderSave?: boolean): Promise<Date> {
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

      this._lastLoadedPath = this.fullPath;
      await localforage.setItem(this.fullPath, this.content);

      this.lastLoadedOrSaved = new Date();

      if (skipParentFolderSave !== true) {
        await this._parentFolder.save(false);
      }
    }

    if (this.lastLoadedOrSaved === null) {
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }
}
