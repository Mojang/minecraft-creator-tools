// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as os from "os";
import * as crypto from "crypto";
import NodeStorage from "./NodeStorage";
import IStorage from "./../storage/IStorage";
import ILocalUtilities from "./ILocalUtilities";
import Log from "../core/Log";
import IConversionSettings from "../core/IConversionSettings";

export default class LocalUtilities implements ILocalUtilities {
  #productNameSeed = "mctools";

  #basePathAdjust: string | undefined = undefined;

  get basePathAdjust() {
    return this.#basePathAdjust;
  }

  set basePathAdjust(pathAdjust: string | undefined) {
    this.#basePathAdjust = pathAdjust;
  }

  get isWindows() {
    return os.platform() === "win32";
  }

  get productNameSeed() {
    return this.#productNameSeed;
  }

  setProductNameSeed(newSeed: string) {
    this.#productNameSeed = newSeed;
  }

  get userDataPath() {
    return os.homedir();
  }

  get localAppDataPath() {
    if (this.isWindows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Local" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return this.userDataPath;
    }
  }

  get localServerLogPath() {
    if (this.isWindows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Roaming" +
        NodeStorage.platformFolderDelimiter +
        "logs" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return "." + NodeStorage.platformFolderDelimiter;
    }
  }

  get minecraftPath() {
    return (
      this.localAppDataPath +
      "Packages" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft.MinecraftUWP_8wekyb3d8bbwe" +
      NodeStorage.platformFolderDelimiter +
      "LocalState" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get minecraftPreviewPath() {
    return (
      this.localAppDataPath +
      "Packages" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe" +
      NodeStorage.platformFolderDelimiter +
      "LocalState" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get testWorkingPath() {
    let path = this.localAppDataPath;

    path =
      NodeStorage.ensureEndsWithDelimiter(path) +
      (this.isWindows ? "" : ".") +
      this.#productNameSeed +
      "_test" +
      NodeStorage.platformFolderDelimiter;

    return path;
  }

  get cliWorkingPath() {
    let path = this.localAppDataPath;

    path =
      NodeStorage.ensureEndsWithDelimiter(path) +
      (this.isWindows ? "" : ".") +
      this.#productNameSeed +
      "_cli" +
      NodeStorage.platformFolderDelimiter;

    return path;
  }

  get serverWorkingPath() {
    let path = this.localAppDataPath;

    path =
      NodeStorage.ensureEndsWithDelimiter(path) +
      (this.isWindows ? "" : ".") +
      this.#productNameSeed +
      "_server" +
      NodeStorage.platformFolderDelimiter;

    return path;
  }

  get worldsWorkingPath() {
    let path = this.localAppDataPath;

    path =
      NodeStorage.ensureEndsWithDelimiter(path) +
      (this.isWindows ? "" : ".") +
      this.#productNameSeed +
      "_worlds" +
      NodeStorage.platformFolderDelimiter;

    return path;
  }

  get serversPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "servers" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get sourceServersPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "serverSources" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get packCachePath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "packCache" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get envPrefsPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "envprefs" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  generateCryptoRandomNumber(toVal: number) {
    Log.assert(
      toVal === 2 || toVal === 4 || toVal === 8 || toVal === 16 || toVal === 32 || toVal === 64 || toVal === 256
    );

    return new Uint32Array(crypto.randomBytes(1))[0] % toVal;
  }

  validateFolderPath(path: string) {
    // banned character combos
    if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
      throw new Error("Unsupported path combinations: " + path);
    }

    if (path.lastIndexOf(":") >= 3) {
      throw new Error("Unsupported drive location: " + path);
    }

    const count = this.countChar(path, "\\") + this.countChar(path, "/");

    if (count < 3) {
      throw new Error("Unsupported base path: " + path);
    }
  }

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

  getFullPath(path: string) {
    let fullPath = __dirname;

    const lastSlash = Math.max(
      fullPath.lastIndexOf("\\", fullPath.length - 2),
      fullPath.lastIndexOf("/", fullPath.length - 2)
    );

    if (lastSlash >= 0) {
      fullPath = fullPath.substring(0, lastSlash + 1);
    }

    if (this.#basePathAdjust) {
      fullPath += this.#basePathAdjust;
    }

    if (this.isWindows) {
      fullPath += path.replace(/\//g, "\\");
    } else {
      fullPath += path.replace(/\\/g, NodeStorage.platformFolderDelimiter);
    }

    return fullPath;
  }

  async createStorage(path: string): Promise<IStorage | null> {
    const fullPath = this.getFullPath(path);

    return new NodeStorage(fullPath, "");
  }

  async readJsonFile(path: string): Promise<object | null> {
    const fs = require("fs");

    const fullPath = this.getFullPath(path);

    const rawData = fs.readFileSync(fullPath);

    if (!rawData) {
      return null;
    }

    const jsonData = JSON.parse(rawData);

    return jsonData;
  }

  async processConversion(conversionSettings: IConversionSettings): Promise<boolean> {
    console.log("Converting!");

    return true;
  }
}
