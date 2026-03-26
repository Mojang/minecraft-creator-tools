import ILocalUtilities, { Platform } from "../core/ILocalUtilities";
import VsFsStorage from "./VsFsStorage";
import * as vscode from "vscode";
import * as crypto from "crypto";
import Log from "./../core/Log";
import IStorage from "../storage/IStorage";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import HttpStorage from "../storage/HttpStorage";
import IConversionSettings from "../core/IConversionSettings";

export default class VsLocalUtilities implements ILocalUtilities {
  readonly userDataPath: string = "";

  readonly localAppDataPath: string = "";
  readonly roamingAppDataPath: string = "";
  readonly localReleaseServerLogPath: string = "";
  readonly localPreviewServerLogPath: string = "";

  readonly minecraftPath: string = "";
  readonly minecraftPreviewPath: string = "";

  readonly minecraftUwpPath: string = "";
  readonly minecraftPreviewUwpPath: string = "";

  private context: vscode.ExtensionContext;
  private extensionStorage: VsFsStorage;

  get platform() {
    return Platform.unsupported;
  }

  constructor(context: vscode.ExtensionContext, extensionStorage: VsFsStorage) {
    this.context = context;
    this.extensionStorage = extensionStorage;

    this.readJsonFile = this.readJsonFile.bind(this);
  }

  validateFolderPath(path: string): void {}

  countChar(source: string, find: string) {
    let count = 0;

    let index = source.indexOf(find);

    while (index >= 0) {
      count++;

      index = source.indexOf(find, index + find.length);
    }

    return count;
  }

  ensureStartsWithSlash(pathSegment: string) {
    if (!pathSegment.startsWith("/")) {
      pathSegment = "/" + pathSegment;
    }

    return pathSegment;
  }

  ensureEndsWithSlash(pathSegment: string) {
    if (!pathSegment.endsWith("/")) {
      pathSegment += "/";
    }

    return pathSegment;
  }

  ensureStartsWithBackSlash(pathSegment: string) {
    if (!pathSegment.startsWith("\\")) {
      pathSegment = "\\" + pathSegment;
    }

    return pathSegment;
  }

  ensureEndsWithBackSlash(pathSegment: string) {
    if (!pathSegment.endsWith("\\")) {
      pathSegment += "\\";
    }

    return pathSegment;
  }

  createStorage(path: string): IStorage | null {
    // It doesn't seem right in the web hosted case that VsFsStorage (vscode.workspace.fs) doesn't seem to return our "storage files"
    // so we fall back to Http against our extension endpoint.
    if (CreatorToolsHost.hostType === HostType.vsCodeWebService) {
      return HttpStorage.get(this.ensureEndsWithSlash(CreatorToolsHost.contentWebRoot) + path);
    } else {
      return new VsFsStorage(this.context, this.ensureEndsWithSlash(this.extensionStorage.path) + path, "storage");
    }
  }

  generateCryptoRandomNumber(toVal: number) {
    // In VS Code Web context, use Web Crypto API
    if (CreatorToolsHost.hostType === HostType.vsCodeWebService) {
      // Web Crypto API fallback
      const maxUint32 = 0xffffffff;
      const limit = maxUint32 - (maxUint32 % toVal);
      let randomValue: number;
      do {
        const array = new Uint32Array(1);
        globalThis.crypto.getRandomValues(array);
        randomValue = array[0];
      } while (randomValue >= limit);
      return randomValue % toVal;
    }

    // Use Node.js crypto module which is available in VS Code extension host
    // This uses rejection sampling to avoid modulo bias
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % toVal);
    let randomValue: number;
    do {
      randomValue = new Uint32Array(crypto.randomBytes(4).buffer)[0];
    } while (randomValue >= limit);
    return randomValue % toVal;
  }

  generateUuid(): string {
    // In VS Code Web context, use Web Crypto API
    if (CreatorToolsHost.hostType === HostType.vsCodeWebService) {
      return globalThis.crypto.randomUUID();
    }

    // Use Node.js crypto.randomUUID() for secure UUID generation
    return crypto.randomUUID();
  }

  async readJsonFile(path: string): Promise<object | null> {
    path = this.ensureStartsWithSlash(path);

    try {
      const catFile = await this.extensionStorage.rootFolder.ensureFileFromRelativePath(path);

      if (!catFile.isContentLoaded) {
        await catFile.loadContent();
      }

      if (!catFile.content) {
        Log.fail(path + " has no content");
        return null;
      }

      if (typeof catFile.content === "string") {
        return JSON.parse(catFile.content);
      }
    } catch (e) {
      Log.debugAlert("Content load fail: " + e + "|Folder:" + this.extensionStorage.rootFolder.uri.toString());
    }

    return null;
  }

  async processConversion(conversionSettings: IConversionSettings): Promise<boolean> {
    return true;
  }

  // Image codec methods - not available in VS Code web context, returns undefined to use browser fallback
  decodePng(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } | undefined {
    return undefined;
  }

  encodeToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    return undefined;
  }
}
