// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ZipFolder from "./ZipFolder";
import IFile from "./IFile";
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

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async loadContent(force: boolean): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      if (this._jszipo !== null) {
        const type = StorageUtilities.getEncodingByFileName(this.name);

        if (type === EncodingType.ByteBuffer) {
          this._content = await this._jszipo.async("uint8array"); /*, (metadata) => {
            Log.verbose("Extracting " + this.storageRelativePath + " (" + metadata.percent.toFixed(2) + ")%");
          });*/

          Log.assert(this._content !== null, "Unexpectedly could not load content.");
        } else {
          this._content = await this._jszipo.async("string");
        }
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

      this._parentFolder.storage.modified = this.modified;
    }
  }

  async saveContent(force?: boolean): Promise<Date> {
    if (this.needsSave || force === true) {
      this.lastLoadedOrSaved = new Date();

      if (this.content !== null) {
        // Log.debug("Saving '" + this.content.length + "' content to '" + this.name + "' within zip");

        this._parentFolder.storage.modified = this.modified;
        this._parentFolder.zip = await this._parentFolder.zip.file(this.name, this.content);
      }
    }

    if (this.lastLoadedOrSaved === null) {
      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }
}
