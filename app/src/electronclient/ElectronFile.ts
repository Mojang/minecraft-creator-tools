import ElectronFolder from "./ElectronFolder";
import ElectronStorage from "./ElectronStorage";
import IFile, { FileUpdateType } from "../storage/IFile";
import FileBase from "../storage/FileBase";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import Log from "../core/Log";

export interface IFStatResult {
  isDirectory: boolean;
  isFile: boolean;
  mtime: string;
  ctime: string;
  size: number;
}

export default class ElectronFile extends FileBase implements IFile {
  _name: string;
  _parentFolder: ElectronFolder;
  localPersistDateTime?: number;

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._parentFolder.fullPath;

    if (!path.endsWith(ElectronStorage.folderDelimiter) && !path.endsWith(">")) {
      path += ElectronStorage.folderDelimiter;
    }

    return path + this.name;
  }

  get parentFolder(): ElectronFolder {
    return this._parentFolder;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  constructor(parentFolder: ElectronFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async scanForChanges(): Promise<void> {
    var stat = undefined;

    let statResultStr: string | undefined = "";

    let mtime: number | undefined = undefined;

    try {
      statResultStr = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsStat, this.fullPath);

      if (statResultStr) {
        stat = JSON.parse(statResultStr) as IFStatResult;
        mtime = Date.parse(stat.mtime);
      }
    } catch (e) {
      Log.fail("Failed to parse statistics for " + this.fullPath + ". " + statResultStr);
    }

    if (this.localPersistDateTime && stat && mtime && mtime > this.localPersistDateTime) {
      await this.reloadAfterExternalUpdate();
    }
  }

  async exists(): Promise<boolean> {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsExists, this.fullPath);

    return result === "true";
  }

  async loadContent(force: boolean): Promise<Date> {
    if (force || this.lastLoadedOrSaved == null) {
      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (encoding === EncodingType.ByteBuffer) {
        // Log.debug("ElecF loading '" + this.fullPath + "' as binary.");
        const byteResult = await AppServiceProxy.sendAsyncBinary(AppServiceProxyCommands.fsReadFile, this.fullPath);

        if (byteResult instanceof ArrayBuffer) {
          this._content = new Uint8Array(byteResult as ArrayBuffer);
        } else if (byteResult === undefined) {
          this._content = null;
        } else {
          this._content = byteResult;
        }
      } else {
        const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsReadUtf8File, this.fullPath);

        if (result === undefined) {
          this._content = null;
        } else {
          this._content = result;
        }

        // Log.debug("ElecF loading '" + this.fullPath + "' as text - " + (result ? result.length + " chars." : " empty"));
      }

      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);
    if (newContent === null) {
      Log.fail("Setting null content for " + this.storageRelativePath);
    }

    if (areEqual) {
      return false;
    }

    if (!this.lastLoadedOrSaved) {
      this.lastLoadedOrSaved = new Date();
      this.lastLoadedOrSaved = new Date(this.lastLoadedOrSaved.getTime() - 1);
    }

    let oldContent = this._content;

    this._content = newContent;

    this.contentWasModified(oldContent, updateType, sourceId);

    return true;
  }

  async saveContent(): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (this.content != null) {
      this.parentFolder.ensureExists();

      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (encoding === EncodingType.ByteBuffer) {
        // Log.verbose("Saving '" + this.fullPath + "' as binary. size: " + this.content.length);

        await AppServiceProxy.sendBinaryAsync(AppServiceProxyCommands.fsWriteFile, {
          path: this.fullPath,
          content: this.content,
        });
      } else {
        // Log.verbose("Saving '" + this.fullPath + "' as text. size: " + this.content.length);

        await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsWriteUtf8File, {
          path: this.fullPath,
          content: this.content,
        });
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
    this._parentFolder = newParentFolder as ElectronFolder;

    this.modified = new Date();

    (newParentFolder as ElectronFolder)._addExistingFile(this);

    this._recycleItem(originalPath);

    return true;
  }

  async _recycleItem(path: string) {
    AppServiceProxy.sendAsync(AppServiceProxyCommands.shellRecycleItem, path);
  }
}
