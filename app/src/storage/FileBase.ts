// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile, { FileUpdateType } from "./IFile";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";
import IStorage from "./IStorage";
import * as md5 from "js-md5";
import Log from "../core/Log";
import { EventDispatcher } from "ste-events";
import Utilities from "../core/Utilities";
import IVersionContent from "./IVersionContent";

export default abstract class FileBase implements IFile {
  abstract get name(): string;
  abstract get parentFolder(): IFolder;
  abstract get isContentLoaded(): boolean;

  priorVersions: IVersionContent[] = [];

  isDisposed: boolean = false;

  isInErrorState?: boolean;
  errorStateMessage?: string;

  protected _content: string | Uint8Array | null;

  #fileContainerStorage: IStorage | null = null;
  #onFileContentUpdated = new EventDispatcher<IFile, IFile>();

  get fileContainerStorage() {
    return this.#fileContainerStorage;
  }

  public get onFileContentUpdated() {
    return this.#onFileContentUpdated.asEvent();
  }

  set fileContainerStorage(newStorage: IStorage | null) {
    this.#fileContainerStorage = newStorage;
  }

  get isString() {
    return this._content !== null && typeof this._content === "string";
  }

  get canIgnore() {
    return StorageUtilities.canIgnoreFileName(this.name) || StorageUtilities.canIgnoreFileExtension(this.type);
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

  contentWasModified(oldContent: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string) {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    let oldVersionContent: IVersionContent | undefined = undefined;

    if (updateType !== FileUpdateType.versionRestoration && updateType !== FileUpdateType.versionlessEdit) {
      let oldModified = this.modified;

      if (oldModified === null) {
        oldModified = this.lastLoadedOrSaved;
      }

      oldVersionContent = {
        id: Utilities.createRandomId(10),
        content: oldContent,
        file: this,
        versionTime: oldModified,
      };

      this.parentFolder.storage.addVersion(oldVersionContent, updateType ? updateType : FileUpdateType.regularEdit);
    }

    this.modified = new Date();

    this.notifyFileContentUpdated();

    if (this.parentFolder.storage) {
      this.parentFolder.storage.notifyFileContentsUpdated({
        file: this,
        updateType: updateType ? updateType : FileUpdateType.regularEdit,
        sourceId: sourceId,
        priorVersion: oldVersionContent,
      });
    }
  }

  notifyFileContentUpdated() {
    this.#onFileContentUpdated.dispatch(this, this);
  }

  async getHash(): Promise<string | undefined> {
    if (!this.isContentLoaded) {
      await this.loadContent(false);
    }

    if (this._content === undefined || this._content === null) {
      return undefined;
    }

    return (md5 as any).md5(this._content);
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

  setObjectContentIfSemanticallyDifferent(
    value: object | null | undefined,
    updateType?: FileUpdateType,
    sourceId?: string
  ) {
    if (value === null || value === undefined) {
      if (this._content !== null) {
        this.setContent(null, updateType, sourceId);
        return true;
      }

      return false;
    }

    if (!(typeof this._content === "string")) {
      this.setContent(JSON.stringify(value, null, 2), updateType, sourceId);
      return true;
    }

    try {
      const currentObj = JSON.parse(this._content);

      if (Utilities.consistentStringify(currentObj) !== Utilities.consistentStringify(value)) {
        this.setContent(JSON.stringify(value, null, 2), updateType, sourceId);
        return true;
      }
    } catch (e) {
      this.setContent(JSON.stringify(value, null, 2), updateType, sourceId);
      return true;
    }

    return false;
  }

  async reloadAfterExternalUpdate() {
    let existingContent = this._content;

    Log.message("Reloading file after external update: " + this.storageRelativePath);

    await this.loadContent(true);

    if (this._content !== existingContent) {
      this.contentWasModified(existingContent, FileUpdateType.externalChange);
    }
  }

  setContentIfSemanticallyDifferent(value: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string) {
    if (value === null) {
      if (this._content !== null) {
        this.setContent(null, updateType, sourceId);
        return true;
      }

      return false;
    }

    if (value instanceof Uint8Array) {
      if (!(this._content instanceof Uint8Array) || this._content.length !== value.length) {
        this.setContent(value, updateType, sourceId);
        return true;
      } else {
        for (let i = 0; i < value.length; i++) {
          if (this._content[i] !== value[i]) {
            this.setContent(value, updateType, sourceId);
            return true;
          }
        }
      }
    } else if (typeof value === "string") {
      if (!(typeof this._content === "string")) {
        this.setContent(value, updateType, sourceId);

        return true;
      } else {
        if (this.type === "json") {
          try {
            const currentObj = JSON.parse(this._content);
            const newObj = JSON.parse(value);

            if (Utilities.consistentStringify(currentObj) !== Utilities.consistentStringify(newObj)) {
              return this.setContent(value, updateType, sourceId);
            }
          } catch (e) {
            return this.setContent(value);
          }
        } else {
          if (this._content.length !== value.length) {
            return this.setContent(value, updateType, sourceId);
          }

          for (let i = 0; i < value.length; i++) {
            if (this._content[i] !== value[i]) {
              return this.setContent(value, updateType, sourceId);
            }
          }
        }
      }
    }

    return false;
  }

  abstract scanForChanges(): Promise<void>;
  abstract deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean>;
  abstract moveTo(newStorageRelativePath: string): Promise<boolean>;
  abstract loadContent(force?: boolean): Promise<Date>;
  abstract setContent(value: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string): boolean;
  abstract saveContent(): Promise<Date>;
}
