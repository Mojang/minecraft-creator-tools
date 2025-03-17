// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "./IFile";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";
import IStorage from "./IStorage";
import md5 from "js-md5";
import Log from "../core/Log";

export default abstract class FileBase implements IFile {
  abstract get name(): string;
  abstract get parentFolder(): IFolder;
  abstract get isContentLoaded(): boolean;

  isDisposed: boolean = false;

  isInErrorState?: boolean;
  errorStateMessage?: string;

  protected _content: string | Uint8Array | null;

  #fileContainerStorage: IStorage | null = null;

  get fileContainerStorage() {
    return this.#fileContainerStorage;
  }

  set fileContainerStorage(newStorage: IStorage | null) {
    this.#fileContainerStorage = newStorage;
  }

  get isString() {
    return this._content !== null && typeof this._content === "string";
  }

  get isBinary() {
    if (this._content === undefined) {
      return false;
    }

    if (this._content instanceof Uint8Array) {
      return true;
    }

    return false;
  }

  get content() {
    return this._content;
  }

  get latestModified() {
    if (this.modified == null) {
      return this.modifiedAtLoad;
    }

    if (this.modifiedAtLoad == null) {
      return null;
    }

    if (this.modified.getTime() > this.modifiedAtLoad.getTime()) {
      return this.modified;
    }

    return this.modifiedAtLoad;
  }

  modified: Date | null;
  modifiedAtLoad: Date | null;
  lastLoadedOrSaved: Date | null;
  manager?: any;
  tag?: any;

  get type(): string {
    return StorageUtilities.getTypeFromName(this.name);
  }

  get needsSave() {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    return this.modified != null && (this.lastLoadedOrSaved == null || this.modified >= this.lastLoadedOrSaved);
  }

  get fullPath(): string {
    return this.storageRelativePath;
  }

  get extendedPath(): string {
    let start = "";

    if (this.parentFolder.storage.storagePath) {
      start = this.parentFolder.storage.storagePath;
    }

    return start + this.fullPath;
  }

  get storageRelativePath() {
    return this.parentFolder.storageRelativePath + this.name;
  }

  getRootRelativePath() {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    return this.getFolderRelativePath(this.parentFolder.storage.rootFolder);
  }

  getFolderRelativePath(toFolder: IFolder) {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    let result = this.parentFolder.getFolderRelativePath(toFolder);

    if (result === undefined) {
      return undefined;
    }

    return result + this.name;
  }

  get coreContentLength() {
    if (!this.content) {
      return 0;
    }

    if (this.isBinary || typeof this.content !== "string") {
      return this.content.length;
    }

    return this.content.replace(/\s/g, "").length;
  }

  constructor() {
    this.modified = null;
    this.modifiedAtLoad = null;
    this.lastLoadedOrSaved = null;
    this._content = null;
  }

  contentWasModified() {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    this.modified = new Date();

    if (this.parentFolder.storage) {
      this.parentFolder.storage.notifyFileContentsUpdated(this);
    }
  }

  async getHash(): Promise<string | undefined> {
    await this.loadContent(false);

    if (this._content === undefined || this._content === null) {
      return undefined;
    }

    return md5.base64(this._content);
  }

  unload() {
    this._content = null;
    this.lastLoadedOrSaved = null;
  }

  dispose() {
    this.manager = undefined;
    this._content = null;
    this.lastLoadedOrSaved = null;

    this.isDisposed = true;
  }

  async exists() {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    await this.loadContent(false);

    return this._content !== null;
  }

  getRelativePathFor(file: IFile): string | undefined {
    if (file.parentFolder.storage !== this.parentFolder.storage) {
      return undefined;
    }
    const foldersByPath: { [path: string]: IFolder } = {};
    let targetParentFolder: IFolder | null = file.parentFolder;

    while (targetParentFolder) {
      foldersByPath[targetParentFolder.storageRelativePath] = targetParentFolder;
      targetParentFolder = targetParentFolder.parentFolder;
    }

    let myParentFolder: IFolder | null = this.parentFolder;

    let relativePath = "." + myParentFolder.storage.folderDelimiter;
    while (myParentFolder && foldersByPath[myParentFolder.storageRelativePath] === undefined) {
      relativePath += ".." + myParentFolder.storage.folderDelimiter;

      myParentFolder = myParentFolder.parentFolder;
    }

    if (!myParentFolder) {
      return undefined;
    }

    const folderRelativePath = file.getFolderRelativePath(myParentFolder);

    if (!folderRelativePath) {
      return undefined;
    }

    return relativePath + StorageUtilities.ensureNotStartsWithDelimiter(folderRelativePath);
  }

  abstract deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean>;
  abstract moveTo(newStorageRelativePath: string): Promise<boolean>;
  abstract loadContent(force?: boolean): Promise<Date>;
  abstract setContent(value: String | Uint8Array | null): void;
  abstract saveContent(): Promise<Date>;
}
