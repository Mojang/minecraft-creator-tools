import MessageProxyFolder from "./MessageProxyFolder";
import MessageProxyStorage from "./MessageProxyStorage";
import IFile from "../storage/IFile";
import FileBase from "../storage/FileBase";
import MessageProxy, { MessageProxyCommands } from "./MessageProxy";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import Log from "../core/Log";
import Utilities from "../core/Utilities";

export default class MessageProxyFile extends FileBase implements IFile {
  _name: string;
  _parentFolder: MessageProxyFolder;

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._parentFolder.fullPath;

    if (!path.endsWith(MessageProxyStorage.folderDelimiter)) {
      path += MessageProxyStorage.folderDelimiter;
    }

    return path + this.name;
  }

  get parentFolder(): MessageProxyFolder {
    return this._parentFolder;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  constructor(parentFolder: MessageProxyFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async exists(): Promise<boolean> {
    return await MessageProxy.sendAsync(
      MessageProxyCommands.fsExists,
      this.parentFolder.storage.channelId,
      this.fullPath
    );
  }

  async reload() {
    this.lastLoadedOrSaved = null;
    await this.loadContent(false);
  }

  async loadContent(force: boolean): Promise<Date> {
    if (force || this.lastLoadedOrSaved == null) {
      if (!this.parentFolder.storage.isEnabled) {
        Log.debugAlert(
          "Unexpected usage of a disabled storage (loading file content) on storage '" +
            this.parentFolder.storage.channelId +
            "'"
        );
        throw new Error();
      }

      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (encoding === EncodingType.ByteBuffer) {
        // Log.debug(`MP loading '${this.fullPath}' as binary on storage '${this.parentFolder.storage.channelId}'`);

        const byteResult = await MessageProxy.sendAsync(
          MessageProxyCommands.fsReadFile,
          this.parentFolder.storage.channelId,
          this.fullPath
        );

        if (byteResult instanceof Uint8Array) {
          this._content = byteResult;
        } else if (typeof byteResult === "string") {
          if (byteResult === "null" || byteResult === "|null|") {
            this._content = null;
          } else {
            const arrayBuf = Utilities.base64ToArrayBuffer(byteResult);

            if (arrayBuf) {
              this._content = new Uint8Array(arrayBuf);
            } else {
              this._content = null;
            }
          }
        } else if (byteResult === undefined) {
          this._content = byteResult;
        } else {
          Log.debugAlert("Unknown file received: " + this.fullPath + "|" + byteResult + "|" + typeof byteResult);
          this._content = byteResult;
        }
      } else {
        /*Log.debug(
          "MP loading '" + this.fullPath + "' as text on storage '" + this.parentFolder.storage.channelId + "'"
        );*/

        let result: string | null = await MessageProxy.sendAsync(
          MessageProxyCommands.fsReadUtf8File,
          this.parentFolder.storage.channelId,
          this.fullPath
        );

        if (result === "null" || result === "|null|") {
          result = null;
        }

        this._content = result;
      }

      //  this._content += "";
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);

    if (!areEqual) {
      if (!this.lastLoadedOrSaved) {
        this.lastLoadedOrSaved = new Date();
        this.lastLoadedOrSaved = new Date(this.lastLoadedOrSaved.getTime() - 1);

        // Log.debugAlert("Setting a file without loading it first.");
      }

      this._content = newContent;

      this.contentWasModified();
    }
  }

  async saveContent(): Promise<Date> {
    if (this.content != null) {
      await this.parentFolder.ensureExists();

      const encoding = StorageUtilities.getEncodingByFileName(this._name);

      if (encoding === EncodingType.ByteBuffer) {
        // Log.verbose(`MPX saving '${this.fullPath}' as binary. size: ${this.content.length}`);

        MessageProxy.send(MessageProxyCommands.fsWriteFile, this.parentFolder.storage.channelId, {
          path: this.fullPath,
          content: this.content,
        });
      } else {
        // Log.verbose(`MPX saving '${this.fullPath}' as text. size: ${this.content.length}`);

        MessageProxy.send(MessageProxyCommands.fsWriteUtf8File, this.parentFolder.storage.channelId, {
          path: this.fullPath,
          content: this.content,
        });
      }
    } else {
      Log.verbose(`MPX note '${this.fullPath}' is null and can't be saved.`);
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }

  async deleteFile(): Promise<boolean> {
    this._parentFolder._removeFile(this);

    MessageProxy.send(MessageProxyCommands.fsDeleteItem, this.parentFolder.storage.channelId, this.fullPath);

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

    await this.loadContent(false);

    const originalPath = this.fullPath;

    this._name = newFileName;
    this._parentFolder = newParentFolder as MessageProxyFolder;

    this.modified = new Date();

    (newParentFolder as MessageProxyFolder)._addExistingFile(this);

    this._recycleItem(originalPath);

    return true;
  }

  async _recycleItem(path: string) {}
}
