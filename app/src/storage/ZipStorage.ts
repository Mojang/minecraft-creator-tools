// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import JSZip from "jszip";
import IStorage, { StorageErrorStatus } from "./IStorage";
import ZipFolder from "./ZipFolder";
import StorageBase from "./StorageBase";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import StorageUtilities from "./StorageUtilities";
import IFile from "./IFile";
import SecurityUtilities from "../core/SecurityUtilities";

export default class ZipStorage extends StorageBase implements IStorage {
  private _jsz: JSZip;

  name?: string;
  rootFolder: ZipFolder;
  modified: Date | null = null;
  lastLoadedOrSaved: Date | null = null;

  allowAllFiles = false;

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
    if (CreatorToolsHost.hostType === HostType.electronNodeJs || CreatorToolsHost.hostType === HostType.toolsNodejs) {
      // Fix CommonJS/ESM interop for JSZip without using eval
      // The issue is that in some Node.js contexts, jszip_1.default is undefined
      // but jszip_1 itself is the constructor we need
      try {
        // Access the module through the global require cache if available
        // This is safer than eval and achieves the same result
        const jszip_1 = require("jszip");
        if (jszip_1 && !jszip_1.default && typeof jszip_1 === "function") {
          // If jszip_1 is the constructor but default is missing, add it
          (jszip_1 as any).default = jszip_1;
        }
      } catch {
        // If require fails (e.g., in bundled contexts), the import should work
        // No action needed
      }
    }
  }

  static fromJsonString(jsonData: string) {
    const zs = new ZipStorage();

    const file = zs.rootFolder.ensureFile("d.json");

    file.setContent(jsonData);

    file.saveContent();

    return zs;
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

  static async fromZipBytesToJsonObject(data: Uint8Array) {
    const zs = new ZipStorage();

    await zs.loadFromUint8Array(data);

    return await ZipStorage.toJsObject(zs);
  }

  static async toJsObject(storage: IStorage) {
    const file = storage.rootFolder.ensureFile("d.json");

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

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

  static async loadFromFile(file: IFile) {
    if (file.fileContainerStorage && file.fileContainerStorage instanceof ZipStorage) {
      return file.fileContainerStorage;
    }

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    const data = file.content;

    if (data && data instanceof Uint8Array) {
      const zs = new ZipStorage();

      await zs.loadFromUint8Array(data, file.name);

      file.fileContainerStorage = zs;
      zs.containerFile = file;

      return zs;
    }

    return undefined;
  }

  async loadFromUint8Array(data: Uint8Array, name?: string) {
    // Security: Validate upload size
    if (!SecurityUtilities.validateFileSize(data.byteLength)) {
      this.errorMessage = `ZIP file too large: ${data.byteLength} bytes (max: ${SecurityUtilities.MAX_UPLOAD_SIZE})`;
      this.errorStatus = StorageErrorStatus.unprocessable;
      throw new Error(this.errorMessage);
    }

    try {
      await this._jsz.loadAsync(data, {
        base64: false,
      });
    } catch (e: any) {
      this.errorMessage = e.toString();
      this.errorStatus = StorageErrorStatus.unprocessable;
      throw e;
    }

    const filePaths = Object.keys(this._jsz.files);

    // Security: Validate ZIP contents
    const fileCount = filePaths.length;
    if (fileCount > SecurityUtilities.MAX_ZIP_FILES) {
      this.errorMessage = `ZIP contains too many files: ${fileCount} (max: ${SecurityUtilities.MAX_ZIP_FILES})`;
      this.errorStatus = StorageErrorStatus.unprocessable;
      throw new Error(this.errorMessage);
    }

    // Security: Validate paths in ZIP
    for (const filePath of filePaths) {
      if (!SecurityUtilities.validatePath(filePath)) {
        this.errorMessage = `ZIP contains invalid path: ${filePath}`;
        this.errorStatus = StorageErrorStatus.unprocessable;
        throw new Error(this.errorMessage);
      }
    }

    // Security: Validate total decompressed size against bomb threshold
    let totalDecompressedSize = 0;
    for (const filePath of filePaths) {
      const file = this._jsz.files[filePath];
      if (file && !file.dir) {
        const fileData = (file as any)._data;
        if (fileData && typeof fileData.uncompressedSize === "number") {
          totalDecompressedSize += fileData.uncompressedSize;
        }
      }
    }

    if (totalDecompressedSize > SecurityUtilities.MAX_DECOMPRESSED_SIZE) {
      this.errorMessage = `This file is too large to import: decompressed size ${totalDecompressedSize} bytes exceeds limit of ${SecurityUtilities.MAX_DECOMPRESSED_SIZE} bytes`;
      this.errorStatus = StorageErrorStatus.unprocessable;
      throw new Error(this.errorMessage);
    }

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
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
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

    if (CreatorToolsHost.isLocalNode) {
      type = "nodebuffer";
    }

    const result = await this._jsz.generateAsync({ type: type as any });

    return result;
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
