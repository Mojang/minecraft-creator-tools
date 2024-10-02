// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import JSZip from "jszip";
import IStorage, { StorageErrorStatus } from "./IStorage";
import ZipFolder from "./ZipFolder";
import StorageBase from "./StorageBase";
import CartoApp, { HostType } from "../app/CartoApp";
import StorageUtilities from "./StorageUtilities";

export default class ZipStorage extends StorageBase implements IStorage {
  private _jsz: JSZip;

  name?: string;
  rootFolder: ZipFolder;
  modified: Date | null = null;
  lastLoadedOrSaved: Date | null = null;

  get updatedSinceLoad() {
    if (this.modified === null || (this.lastLoadedOrSaved === null && this.modified === null)) {
      return false;
    } else if (this.lastLoadedOrSaved === null) {
      return true;
    }

    return this.modified > this.lastLoadedOrSaved;
  }

  constructor() {
    super();

    ZipStorage.zipFixup();

    this._jsz = new JSZip();

    this.rootFolder = new ZipFolder(this, this._jsz, null, "", "");
  }

  static zipFixup() {
    if (CartoApp.hostType === HostType.electronNodeJs || CartoApp.hostType === HostType.toolsNodejs) {
      // eslint-disable-next-line
      eval("jszip_1.default = jszip_1");
    }
  }

  static fromJsObject(data: object) {
    const zs = new ZipStorage();

    const file = zs.rootFolder.ensureFile("d.json");

    let jsonData = undefined;

    jsonData = JSON.stringify(data);

    file.setContent(jsonData);

    file.saveContent();

    return zs;
  }

  static async toJsObject(storage: IStorage) {
    const file = storage.rootFolder.ensureFile("d.json");

    await file.loadContent();

    return StorageUtilities.getJsonObject(file);
  }

  updateLastLoadedOrSaved() {
    this.lastLoadedOrSaved = new Date();
  }

  async loadFromBase64(data: string, name?: string) {
    try {
      await this._jsz.loadAsync(data, {
        base64: true,
        checkCRC32: true,
      });
    } catch (e: any) {
      this.errorMessage = e.toString();
      this.errorStatus = StorageErrorStatus.unprocessable;
    }

    // Log.fail("Loading zip file from data " + data.length);

    this.name = name;
    this.updateLastLoadedOrSaved();

    await this.rootFolder.load(true);
  }

  async loadFromUint8Array(data: Uint8Array, name?: string) {
    try {
      await this._jsz.loadAsync(data, {
        base64: false,
      });
    } catch (e: any) {
      this.errorMessage = e.toString();
      this.errorStatus = StorageErrorStatus.unprocessable;
    }

    // Log.fail("Loading zip file from data " + data.length);

    this.name = name;
    this.updateLastLoadedOrSaved();

    await this.rootFolder.load(true);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(StorageBase.slashFolderDelimiter)) {
      fullPath += StorageBase.slashFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  async generateUint8ArrayAsync(): Promise<Uint8Array> {
    const result = await this._jsz.generateAsync({
      type: "uint8array",
    });

    return result;
  }
  async generateCompressedBase64Async(): Promise<string> {
    const result = await this._jsz.generateAsync({
      type: "base64",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
    });

    return result;
  }
  async generateCompressedUint8ArrayAsync(): Promise<Uint8Array> {
    const result = await this._jsz.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
    });

    return result;
  }

  async generateBlobAsync(): Promise<any> {
    let type = "blob";

    if (CartoApp.isLocalNode) {
      type = "nodebuffer";
    }

    const result = await this._jsz.generateAsync({ type: type as any });

    return result;
  }
}
