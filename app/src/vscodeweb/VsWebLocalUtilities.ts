import ILocalUtilities from "../local/ILocalUtilities";
import MessageProxyStorage from "./MessageProxyStorage";
import Log from "./../core/Log";
import IStorage from "../storage/IStorage";

export default class VsWebLocalUtilities implements ILocalUtilities {
  readonly userDataPath: string = "";

  readonly localAppDataPath: string = "";
  readonly localServerLogPath: string = "";

  readonly minecraftPath: string = "";
  readonly minecraftPreviewPath: string = "";

  private extensionStorage: MessageProxyStorage;

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

  async createStorage(path: string): Promise<IStorage | null> {
    return new MessageProxyStorage(path, "");
  }

  async readJsonFile(path: string): Promise<object | null> {
    path = this.ensureStartsWithSlash(path);

    try {
      const catFile = await this.extensionStorage.rootFolder.ensureFileFromRelativePath(path);

      await catFile.loadContent();

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
}
