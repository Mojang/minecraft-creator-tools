import ILocalUtilities, { Platform } from "../core/ILocalUtilities";
import MessageProxyStorage from "./MessageProxyStorage";
import Log from "./../core/Log";
import IStorage from "../storage/IStorage";
import IConversionSettings from "../core/IConversionSettings";
import HttpStorage from "../storage/HttpStorage";
import CreatorToolsHost from "../app/CreatorToolsHost";

export default class VsWebLocalUtilities implements ILocalUtilities {
  readonly userDataPath: string = "";

  readonly localAppDataPath: string = "";
  readonly roamingAppDataPath: string = "";
  readonly localReleaseServerLogPath: string = "";
  readonly localPreviewServerLogPath: string = "";

  readonly minecraftPath: string = "";
  readonly minecraftPreviewPath: string = "";

  readonly minecraftUwpPath: string = "";
  readonly minecraftPreviewUwpPath: string = "";

  private extensionStorage: MessageProxyStorage;

  get platform() {
    return Platform.unsupported;
  }

  constructor() {
    this.extensionStorage = new MessageProxyStorage("extension", "");

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

  generateCryptoRandomNumber(toVal: number) {
    // Use rejection sampling to avoid modulo bias when generating random numbers
    // from a cryptographically secure source
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % toVal);
    let randomValue: number;
    do {
      // @ts-ignore
      randomValue = window.crypto.getRandomValues(new Uint32Array(1))[0];
    } while (randomValue >= limit);
    return randomValue % toVal;
  }

  generateUuid(): string {
    // @ts-ignore
    if (window.crypto.randomUUID) {
      // @ts-ignore
      return window.crypto.randomUUID();
    }
    // Fallback for older browsers using crypto.getRandomValues
    // @ts-ignore
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    // Set version 4 (random) UUID bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  createStorage(path: string): IStorage | null {
    // Check if this is a path to bundled extension data (relative paths like "data/forms/")
    // vs workspace paths (absolute paths, URLs like "vscode-test-web://", etc.)
    const isExtensionDataPath =
      path.startsWith("data/") ||
      path.startsWith("res/") ||
      path.startsWith("schemas/") ||
      (!path.includes("://") && !path.startsWith("/"));

    if (isExtensionDataPath) {
      // Use HTTP storage to load from the extension's bundled files via contentWebRoot
      const root = this.ensureEndsWithSlash(CreatorToolsHost.contentWebRoot);
      return HttpStorage.get(root + path);
    } else {
      // Use MessageProxyStorage for workspace file operations (read/write)
      // The channel ID must match the workspace folder path that StorageProxy uses
      // CreatorToolsHost.projectPath is set to the workspace folder URI (e.g., "vscode-test-web://mount/...")
      const channelId = CreatorToolsHost.projectPath || path;
      return new MessageProxyStorage(channelId, path);
    }
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
      Log.debugAlert("Content load fail: " + e);
    }

    return null;
  }

  async processConversion(conversionSettings: IConversionSettings): Promise<boolean> {
    return true;
  }

  // Image codec methods - not available in web context, returns undefined to use browser fallback
  decodePng(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } | undefined {
    return undefined;
  }

  encodeToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    return undefined;
  }
}
