// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder, { FolderErrorStatus } from "./IFolder";
import IFile from "./IFile";
import IStorage, { IFolderMove } from "./IStorage";
import StorageUtilities from "./StorageUtilities";
import Utilities from "./../core/Utilities";
import AllFolderFileIterator from "./AllFolderFileIterator";
import Log from "../core/Log";
import { EventDispatcher } from "ste-events";
import StorageBase from "./StorageBase";

export default abstract class FolderBase implements IFolder {
  abstract get name(): string;

  get ensuredName(): string {
    return this.name;
  }

  isDisposed: boolean = false;
  #lastLoadedOrSaved: Date | null;

  abstract get parentFolder(): IFolder | null;
  abstract get storage(): IStorage;
  manager?: any;

  #onFolderMoved = new EventDispatcher<FolderBase, IFolderMove>();
  #onChildFolderMoved = new EventDispatcher<FolderBase, IFolderMove>();

  errorStatus?: FolderErrorStatus;

  public get onFolderMoved() {
    return this.#onFolderMoved.asEvent();
  }

  public get onChildFolderMoved() {
    return this.#onChildFolderMoved.asEvent();
  }

  get isLoaded() {
    return this.#lastLoadedOrSaved !== null;
  }

  get allFiles(): AsyncIterable<IFile> {
    let parentFolder = this;

    return {
      [Symbol.asyncIterator](): AsyncIterator<IFile> {
        return new AllFolderFileIterator(parentFolder);
      },
    };
  }

  get folderCount() {
    let i = 0;

    // eslint-disable-next-line
    for (const folderName in this.folders) {
      i++;
    }

    return i;
  }

  get fileCount() {
    let i = 0;

    // eslint-disable-next-line
    for (const fileName in this.files) {
      i++;
    }

    return i;
  }

  get storageRelativePath() {
    if (this.parentFolder === null) {
      return "/";
    } else {
      return this.parentFolder.storageRelativePath + this.name + "/";
    }
  }

  get lastLoadedOrSaved() {
    return this.#lastLoadedOrSaved;
  }

  get fullPath(): string {
    return this.storageRelativePath;
  }

  get extendedPath(): string {
    let start = "";

    if (this.storage.storagePath) {
      start = this.storage.storagePath;
    }

    return start + this.fullPath;
  }

  constructor() {
    this.#lastLoadedOrSaved = null;
  }

  updateLastLoadedOrSaved() {
    this.#lastLoadedOrSaved = new Date();
  }

  getFolderRelativePath(toFolder: IFolder): string | undefined {
    if (toFolder.storage !== this.storage && this.storage.storagePath) {
      return this.extendedPath;
    } else if (this === toFolder) {
      return "/";
    } else if (this.parentFolder === null) {
      return undefined;
    } else {
      const result = this.parentFolder.getFolderRelativePath(toFolder);

      if (result === undefined) {
        return undefined;
      }

      return result + this.name + "/";
    }
  }

  dispose() {
    this.manager = undefined;

    if (this.folders) {
      for (const folderName in this.folders) {
        const folder = this.folders[folderName];

        if (folder) {
          folder.dispose();
          this.folders[folderName] = undefined;
        }
      }
    }

    if (this.files) {
      for (const fileName in this.files) {
        const file = this.files[fileName];

        if (file) {
          file.dispose();
          this.files[fileName] = undefined;
        }
      }
    }

    this.isDisposed = true;
  }

  async setStructureFromFileList(fileList: string[]) {
    this.updateLastLoadedOrSaved();

    for (const file of fileList) {
      let folderPath = StorageUtilities.getFolderPath(file);

      if (folderPath) {
        folderPath = StorageUtilities.ensureEndsDelimited(folderPath);

        if (folderPath.length > 2) {
          const folder = (await this.ensureFolderFromRelativePath(folderPath, true)) as FolderBase;

          folder.updateLastLoadedOrSaved();
          let parentFolder = folder.parentFolder as FolderBase;

          while (parentFolder && parentFolder !== this) {
            parentFolder.updateLastLoadedOrSaved();

            parentFolder = parentFolder.parentFolder as FolderBase;
          }
        }

        await this.ensureFileFromRelativePath(file, true);
      }
    }
  }

  isSameFolder(newFolderStorageRelativePath: string) {
    if (
      StorageUtilities.canonicalizePath(newFolderStorageRelativePath) ===
      StorageUtilities.canonicalizePath(this.storageRelativePath)
    ) {
      return true;
    }

    return false;
  }

  _addExistingFolder(folder: IFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = folder as this;
  }

  _clearExistingFolder(folder: IFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = undefined;
  }

  folderExists(name: string): boolean {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    const nameCanon = StorageUtilities.canonicalizeName(name);

    return !Utilities.isNullOrUndefined(this.folders[nameCanon]);
  }

  fileExists(name: string): boolean {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    const nameCanon = StorageUtilities.canonicalizeName(name);

    return !Utilities.isNullOrUndefined(this.files[nameCanon]);
  }

  async deleteFileFromRelativePath(path: string): Promise<boolean> {
    path = this.canonicalizePath(path);

    const file = await this.getFileFromRelativePath(path);

    if (file !== undefined) {
      return await file.deleteThisFile();
    }

    return false;
  }

  canonicalizePath(path: string) {
    return path.replace(/\\/g, "/");
  }

  async getFileFromRelativePath(path: string): Promise<IFile | undefined> {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    if (path.length < 2) {
      throw Error("Path is too short.");
    }

    path = this.canonicalizePath(path);

    if (path[0] !== "/") {
      throw Error("Storage relative path '" + path + "' is not in the right format.");
    }

    await this.ensureExists();
    await this.load(false);

    const nextSlash = path.indexOf("/", 1);

    if (nextSlash < 0) {
      const fileName = path.substring(1, path.length);

      return this.files[StorageUtilities.canonicalizeName(fileName)];
    } else {
      const folderName = path.substring(1, nextSlash);

      const folder = this.folders[StorageUtilities.canonicalizeName(folderName)];

      if (folder === undefined || folder === null) {
        return undefined;
      }

      return (folder as IFolder).getFileFromRelativePath(path.substring(nextSlash, path.length));
    }
  }

  clearAllManagers() {
    if (this.manager) {
      this.manager = undefined;
    }

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file) {
        file.manager = undefined;
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        folder.clearAllManagers();
      }
    }
  }

  async getFolderFromRelativePath(path: string): Promise<IFolder | undefined> {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    if (path === "/" || path === "\\") {
      return this;
    }

    if (path.length < 2) {
      throw Error("Path is too short.");
    }

    path = this.canonicalizePath(path);

    if (path[0] !== "/") {
      throw Error("Storage relative path '" + path + "' is not in the right format.");
    }

    await this.ensureExists();
    await this.load(false);

    const nextSlash = path.indexOf("/", 1);

    if (nextSlash < 0) {
      const folderName = path.substring(1, path.length);

      return this.folders[StorageUtilities.canonicalizeName(folderName)];
    } else {
      let folderName = path.substring(1, nextSlash);

      folderName = StorageUtilities.canonicalizeName(folderName);

      const folder = this.folders[folderName];

      if (folder === undefined || folder === null) {
        return undefined;
      }

      const nextPath = path.substring(nextSlash, path.length);

      if (nextPath === "/" || nextPath === "\\") {
        return folder;
      }

      return await (folder as IFolder).getFolderFromRelativePath(nextPath);
    }
  }

  getFolderByIndex(index: number) {
    let curIndex = 0;
    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder && curIndex === index) {
        return folder;
      }

      if (folder) {
        curIndex++;
      }
    }

    return undefined;
  }

  getSummary() {
    let str = "P: " + this.fullPath + " FO:";

    for (const folderName in this.folders) {
      str += " " + folderName;
    }

    str += " FI:";

    for (const fileName in this.files) {
      str += " " + fileName;
    }

    return str;
  }

  getFolderFromRelativePathLocal(path: string): IFolder | undefined {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    if (path === "/" || path === "\\") {
      return this;
    }

    if (path.length < 2) {
      throw Error("Path is too short.");
    }

    path = this.canonicalizePath(path);

    if (path[0] !== "/") {
      throw Error("Storage relative path '" + path + "' is not in the right format.");
    }

    const nextSlash = path.indexOf("/", 1);

    if (nextSlash < 0) {
      const folderName = path.substring(1, path.length);

      return this.folders[StorageUtilities.canonicalizeName(folderName)];
    } else {
      const folderName = path.substring(1, nextSlash);

      let folder = this.folders[StorageUtilities.canonicalizeName(folderName)];

      if (folder === undefined || folder === null) {
        if (folderName.endsWith("#")) {
          const storageFile =
            this.files[StorageUtilities.canonicalizeName(folderName.substring(0, folderName.length - 1))];

          if (storageFile) {
            if (storageFile.fileContainerStorage) {
              folder = storageFile.fileContainerStorage.rootFolder;
            }
          }
        }
        if (folder === undefined || folder === null) {
          return undefined;
        }
      }

      const nextPath = path.substring(nextSlash, path.length);

      if (nextPath === "/" || nextPath === "\\") {
        return folder;
      }

      return (folder as IFolder).getFolderFromRelativePathLocal(nextPath);
    }
  }

  async saveAll(force?: boolean): Promise<boolean> {
    // Log.verbose("Saving all at " + this.storageRelativePath);
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file !== undefined && (file.needsSave || force)) {
        await file.saveContent(force);
      }
    }

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder !== undefined && !folder.errorStatus) {
        await folder.saveAll(force);
      }
    }

    return true;
  }

  async ensureFolderFromRelativePath(path: string, ignoreLoad?: boolean): Promise<IFolder> {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    if (path === "/" || path === "\\") {
      return this;
    }

    if (path.startsWith("./")) {
      path = path.substring(1);
    }

    path = this.canonicalizePath(path);

    if (path[path.length - 1] !== "/") {
      path = path + "/";
    }

    if (path[0] !== "/") {
      throw Error("Storage relative path '" + path + "' is not in the right format.");
    }

    if (!ignoreLoad) {
      await this.ensureExists();
      await this.load(false);
    }

    const nextSlash = path.indexOf("/", 1);

    if (nextSlash < 0) {
      throw new Error("Unexpected path format error");
    } else {
      const folderName = path.substring(1, nextSlash);

      const folder = this.ensureFolder(folderName) as FolderBase;

      if (nextSlash === path.length - 1) {
        return folder;
      } else {
        return folder.ensureFolderFromRelativePath(path.substring(nextSlash, path.length), ignoreLoad);
      }
    }
  }

  async ensureFileFromRelativePath(path: string, ignoreLoad?: boolean): Promise<IFile> {
    if (this.isDisposed) {
      Log.throwIsDisposed();
    }

    if (path.length < 2) {
      throw Error("Path is too short.");
    }

    path = this.canonicalizePath(path);

    if (path[0] !== "/") {
      throw Error("Storage relative path '" + path + "' is not in the right format.");
    }

    await this.ensureExists();

    if (!ignoreLoad) {
      await this.load(false);
    }

    const nextSlash = path.indexOf("/", 1);

    if (nextSlash < 0) {
      const file = this.ensureFile(path.substring(1, path.length));

      return file;
    } else {
      const folderName = path.substring(1, nextSlash);

      const folder = this.ensureFolder(folderName) as FolderBase;

      const file = await folder.ensureFileFromRelativePath(path.substring(nextSlash, path.length), ignoreLoad);

      return file;
    }
  }

  async deleteFile(name: string): Promise<boolean> {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    const file = this.files[nameCanon];

    if (file !== undefined) {
      return await file.deleteThisFile();
    }

    this.files[nameCanon] = undefined;

    return false;
  }

  removeFolder(name: string): boolean {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    const exists = this.folders[nameCanon] !== undefined;

    this.folders[nameCanon] = undefined;

    return exists;
  }

  async rename(name: string): Promise<boolean> {
    let targetPath = name;

    if (this.parentFolder !== null) {
      targetPath = this.storage.joinPath(this.parentFolder.storageRelativePath, targetPath);
    }

    return await this.moveTo(targetPath);
  }

  async recursiveDeleteThisFolder() {
    let isAllDeletes = true;

    await this.load(true);

    for (const folderName in this.folders) {
      const folder = this.folders[folderName];

      if (folder) {
        if (!(await folder.deleteThisFolder())) {
          isAllDeletes = false;
        }
      }
    }

    for (const fileName in this.files) {
      const file = this.files[fileName];

      if (file) {
        if (!(await file.deleteThisFile(true))) {
          isAllDeletes = false;
        }
      }
    }

    this.removeMeFromParent();

    return isAllDeletes;
  }

  notifyFolderMoved(folderMove: IFolderMove) {
    this.#onFolderMoved.dispatch(this, folderMove);

    if (this.parentFolder) {
      (this.parentFolder as FolderBase).notifyChildFolderMoved(folderMove);
    }

    (this.storage as StorageBase).notifyFolderMoved(folderMove);
  }

  notifyChildFolderMoved(folderMove: IFolderMove) {
    this.#onChildFolderMoved.dispatch(this, folderMove);

    if (this.parentFolder) {
      (this.parentFolder as FolderBase).notifyChildFolderMoved(folderMove);
    }
  }

  removeMeFromParent() {
    if (this.parentFolder) {
      this.parentFolder.removeFolder(this.name);
    }
  }

  abstract deleteThisFolder(): Promise<boolean>;
  abstract exists(): Promise<boolean>;
  abstract ensureExists(): Promise<boolean>;

  abstract folders: { [name: string]: IFolder | undefined };
  abstract files: { [name: string]: IFile | undefined };
  abstract moveTo(newStorageRelativePath: string): Promise<boolean>;
  abstract load(force?: boolean): Promise<Date>;

  abstract ensureFolder(name: string): IFolder;
  abstract ensureFile(name: string): IFile;

  abstract createFile(name: string): Promise<IFile>;
}
