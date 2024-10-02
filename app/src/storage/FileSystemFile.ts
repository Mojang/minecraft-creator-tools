// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileBase from "./FileBase";
import FileSystemFolder from "./FileSystemFolder";
import IFile from "./IFile";
import FileSystemStorage from "./FileSystemStorage";
import StorageUtilities, { EncodingType } from "./StorageUtilities";
import Log from "../core/Log";

export default class FileSystemFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: FileSystemFolder;

  lastSavedSize: number;
  private _handle?: FileSystemFileHandle;
  private _writeHandle?: FileSystemFileHandle;

  get handle(): FileSystemFileHandle | undefined {
    return this._handle;
  }

  set handle(newHandle: FileSystemFileHandle | undefined) {
    this._handle = newHandle;
  }

  get writeHandle(): FileSystemFileHandle | undefined {
    return this._writeHandle;
  }

  set writeHandle(newHandle: FileSystemFileHandle | undefined) {
    this._writeHandle = newHandle;
  }

  get name(): string {
    return this._name;
  }

  get parentFolder(): FileSystemFolder {
    return this._parentFolder;
  }

  get fullPath(): string {
    return this._parentFolder.fullPath + FileSystemStorage.fileSystemFolderDelimiter + this.name;
  }

  get size(): number {
    if (this.content == null) {
      return -1;
    }

    return this.content.length;
  }

  constructor(parentFolder: FileSystemFolder, fileName: string) {
    super();

    this.lastSavedSize = -1;

    this._parentFolder = parentFolder;
    this._name = fileName;
  }

  async getHandle() {
    if (!this._handle) {
      if (this._writeHandle) {
        return this._writeHandle;
      }

      if (this.parentFolder) {
        const parentFolderHandle = await this.parentFolder.getHandle();

        if (parentFolderHandle) {
          try {
            this._handle = await parentFolderHandle.getFileHandle(this.name, {
              create: false,
            });
          } catch (e) {
            return; // if the file doesn't exist an exception will be thrown
            //Log.debugAlert("File r/o retrieval: " + e);
          }
        }
      }
    }

    return this._handle;
  }

  async ensureWriteHandle() {
    if (!this._writeHandle) {
      if (this.parentFolder) {
        await this.parentFolder.ensureWriteHandle();

        if (this.parentFolder.writeHandle) {
          try {
            this._writeHandle = await this.parentFolder.writeHandle.getFileHandle(this.name, {
              create: true,
            });
          } catch (e) {
            Log.debugAlert("File r/w retrieval: " + e);
          }
        }
      }
    }

    Log.assert(this._writeHandle !== undefined, "No folder handle.");

    return this._writeHandle;
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

    await this._parentFolder._removeFileExistence(this.name);

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

    const originalName = this._name;
    const originalParentFolder = this._parentFolder;

    this._name = newFileName;
    this._parentFolder = newParentFolder as FileSystemFolder;

    this.modified = new Date();

    (newParentFolder as FileSystemFolder)._addExistingFile(this);

    originalParentFolder._removeFileExistence(originalName);

    return true;
  }

  async loadContent(force?: boolean): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      const handle = await this.getHandle();

      if (handle) {
        const file = await handle.getFile();

        const encoding = StorageUtilities.getEncodingByFileName(file.name);

        if (encoding === EncodingType.ByteBuffer) {
          const stream = file.stream();

          let result = undefined;
          let reader = undefined;
          try {
            reader = stream.getReader();
          } catch (e) {
            Log.debugAlert(
              "Could not get a reader for for file (first): " + this.storageRelativePath + " (" + file.name + ")"
            );
          }

          if (reader) {
            try {
              result = await reader.read();
            } catch (e) {
              Log.debugAlert(
                "Could not read content for file (first): " + this.storageRelativePath + " (" + file.name + ")"
              );
            }

            const byteArrays: Uint8Array[] = [];
            let length = 0;

            do {
              if (result && result.value) {
                byteArrays.push(result.value);
                length += result.value.length;
              }

              try {
                result = await reader.read();
              } catch (e) {
                Log.debugAlert("Could not read content for file: " + this.storageRelativePath + " (" + file.name + ")");
              }
            } while (result && !result.done);

            const mergedArray = new Uint8Array(length);
            let offset = 0;

            for (const byteArray of byteArrays) {
              mergedArray.set(byteArray, offset);

              offset += byteArray.length;
            }

            this._content = mergedArray;
          }
        } else if (encoding === EncodingType.Utf8String) {
          this._content = await file.text();
        }
      } else {
        this._content = null;
      }

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

  async saveContent(force?: boolean): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (this.needsSave || force) {
      Log.assert(this.content !== null, "Null content found.");

      if (this.content !== null) {
        const handle = await this.ensureWriteHandle();

        if (handle) {
          const writable = await handle.createWritable();

          await writable.write(this.content);

          await writable.close();
        }

        await this._parentFolder.save(false);
      }
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }
}
