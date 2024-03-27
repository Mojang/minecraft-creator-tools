// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import FileBase from "./FileBase";
import Folder from "./Folder";
import IFile from "./IFile";
import Storage from "./Storage";
import StorageUtilities from "./StorageUtilities";

export default class File extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: Folder;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return true;
  }

  get parentFolder(): Folder {
    return this._parentFolder;
  }

  get fullPath() {
    return this._parentFolder.fullPath + Storage.folderDelimiter + this.name;
  }

  constructor(parentFolder: Folder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async loadContent(force?: boolean): Promise<Date> {
    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    Log.verbose("Deleting file '" + this.storageRelativePath + "'");

    if (skipRemoveFromParent !== true) {
      this._parentFolder._removeFile(this);
    }

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

    this._name = newFileName;
    this._parentFolder = newParentFolder as Folder;

    (newParentFolder as Folder)._addExistingFile(this);

    return true;
  }

  setContent(newContent: string | Uint8Array | null) {
    if (this._content !== newContent) {
      if (!this.lastLoadedOrSaved) {
        this.lastLoadedOrSaved = new Date();
        this.lastLoadedOrSaved = new Date(this.lastLoadedOrSaved.getTime() - 1);

        Log.debugAlert("Setting a file without loading it first.");
      }

      this._content = newContent;

      this.contentWasModified();
    }
  }

  async saveContent(): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }
}
