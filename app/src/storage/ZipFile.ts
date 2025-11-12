// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ZipFolder from "./ZipFolder";
import IFile, { FileUpdateType } from "./IFile";
import FileBase from "./FileBase";
import JSZip from "jszip";
import StorageUtilities, { EncodingType } from "./StorageUtilities";
import Log from "../core/Log";

export default class ZipFile extends FileBase implements IFile {
  _name: string;
  _parentFolder: ZipFolder;
  _jszipo: JSZip.JSZipObject | null;

  get name() {
    return this._name;
  }

  get fullPath() {
    return StorageUtilities.ensureEndsWithDelimiter(this._parentFolder.fullPath) + this.name;
  }

  get parentFolder(): ZipFolder {
    return this._parentFolder;
  }

  get isContentLoaded(): boolean {
    return this.lastLoadedOrSaved != null || this.modified != null;
  }

  updateZipNativeFile(thisFileObject: JSZip.JSZipObject) {
    this._jszipo = thisFileObject;
  }

  constructor(parentFolder: ZipFolder, fileName: string, thisFileObject: JSZip.JSZipObject | null) {
    super();

    this._jszipo = thisFileObject;
    this._parentFolder = parentFolder;
    this._name = fileName;

    this.modified = null;
    this.lastLoadedOrSaved = null;
  }

  async scanForChanges(): Promise<void> {
    // No-op for zip storage
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async loadContent(force?: boolean, forceEncoding?: EncodingType): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      if (this._jszipo !== null) {
        const type = forceEncoding ?? StorageUtilities.getEncodingByFileName(this.name);

        if (type === EncodingType.ByteBuffer) {
          try {
            this._content = await this._jszipo.async("uint8array");
          } catch (e: any) {
            this.errorStateMessage = e.toString();
          } /*, (metadata) => {
            Log.verbose("Extracting " + this.storageRelativePath + " (" + metadata.percent.toFixed(2) + ")%");
          });*/

          Log.assert(this._content !== null, "Unexpectedly could not load content.");
        } else {
          try {
            this._content = await this._jszipo.async("string");
          } catch (e: any) {
            this.errorStateMessage = e.toString();
          }
        }
      }

      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null, updateType?: FileUpdateType, sourceId?: string) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);

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

    this._parentFolder.storage.modified = this.modified;

    return true;
  }

  async saveContent(force?: boolean): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    if (this.needsSave || force === true) {
      this.lastLoadedOrSaved = new Date();

      if (this.content !== null) {
        // Log.debug("Saving '" + this.content.length + "' content to '" + this.name + "' within zip");

        this._parentFolder.storage.modified = this.modified;
        this._parentFolder.zip.file(this.name, this.content);
      }
    }

    if (this.lastLoadedOrSaved === null) {
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }
}
