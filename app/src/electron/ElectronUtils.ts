import * as fs from "fs";
import StorageUtilities from "../storage/StorageUtilities";
import * as path from "path";
import Utilities from "../core/Utilities";
import { app } from "electron";
import LocalEnvironment from "../local/LocalEnvironment";
import Log from "../core/Log";

const allowedExtensions = [
  "js",
  "ts",
  "mjs",
  "json",
  "md",
  "png",
  "jpg",
  "jpeg",
  "lang",
  "fsb",
  "map",
  "ogg",
  "flac",
  "hdr",
  "psd",
  "env",
  "gif",
  "wav",
  "tga",
  "env",
  "properties",
  "cartobackup",
  "mctbackup",
  "wlist",
  "brarchive",
  "nbt",
  "webm",
  "svg",
  "otf",
  "ttf",
  "bin",
  "obj",
  "pdn",
  "zip",
  "h",
  "py",
  "fontdata",
  "",
  "mcstructure",
  "mcworld",
  "mcproject",
  "map",
  "js.map",
  "mctemplate",
  "material",
  "vertex",
  "md",
  "geometry",
  "fragment",
  "mcfunction",
  "mcaddon",
  "mcpack",
  "html",
  "dat",
  "dat_old",
  "txt",
  "ldb",
  "log",
  "in",
  "cmake",
];

const allowedExecutableExtensions = ["mcstructure", "mcworld", "mctemplate", "mcaddon"];

export default class ElectronUtils {
  // Static set to track tokens we've already warned about across all instances
  private static _warnedMissingTokens: Set<string> = new Set();

  _minecraftPreviewPath: string | undefined;
  _minecraftReleasePath: string | undefined;
  _minecraftEducationPreviewPath: string | undefined;
  _minecraftEducationReleasePath: string | undefined;
  _minecraftPEPath: string | undefined;
  _uniqueIdToPathMappings: { [key: string]: string };
  _pathToUniqueIdMappings: { [key: string]: string };
  _env;
  _docFolderEnsured: boolean = false;

  constructor(env: LocalEnvironment) {
    this._env = env;

    this._minecraftPreviewPath = undefined;
    this._minecraftReleasePath = undefined;
    this._uniqueIdToPathMappings = {};

    if (this._env.pathMappings) {
      this._pathToUniqueIdMappings = this._env.pathMappings;

      for (const path in this._pathToUniqueIdMappings) {
        const uniqueId = this._pathToUniqueIdMappings[path];

        this._uniqueIdToPathMappings[uniqueId] = path;
      }
    } else {
      this._pathToUniqueIdMappings = {};
    }
  }

  ensureMappingForPath(path: string) {
    path = path.replace(/\\/g, "/");

    let pathCanon = StorageUtilities.canonicalizePath(path);

    if (pathCanon.indexOf("/") >= 0 && !pathCanon.endsWith("/")) {
      pathCanon += "/";
    }

    if (this._pathToUniqueIdMappings[pathCanon]) {
      return this._pathToUniqueIdMappings[pathCanon];
    } else {
      const uniqueId = StorageUtilities.getLeafName(path) + "-" + Utilities.createRandomLowerId(6);

      this._pathToUniqueIdMappings[pathCanon] = uniqueId;
      this._uniqueIdToPathMappings[uniqueId] = pathCanon;

      this._env.pathMappings = this._pathToUniqueIdMappings;
      this._env.save();

      return uniqueId;
    }
  }

  hasMappingForPath(path: string) {
    const pathCanon = StorageUtilities.canonicalizePath(path);

    if (this._pathToUniqueIdMappings[pathCanon]) {
      return true;
    }

    return false;
  }

  getMinecraftReleasePath() {
    if (this._minecraftReleasePath) {
      return this._minecraftReleasePath;
    }

    this._minecraftReleasePath =
      this.getRoamingPath() +
      "Microsoft Bedrock" +
      path.sep +
      "Users" +
      path.sep +
      "Shared" +
      path.sep +
      "games" +
      path.sep +
      "com.mojang" +
      path.sep;

    // fall back to older UWP path
    if (!fs.existsSync(this._minecraftReleasePath)) {
      this._minecraftReleasePath =
        this.getUserLocalPath() +
        "Packages" +
        path.sep +
        "Microsoft.MinecraftUWP_8wekyb3d8bbwe" +
        path.sep +
        "LocalState" +
        path.sep +
        "games" +
        path.sep +
        "com.mojang" +
        path.sep;

      if (!fs.existsSync(this._minecraftReleasePath)) {
        this._minecraftReleasePath = undefined;
      }
    }

    return this._minecraftReleasePath;
  }

  getMinecraftPreviewPath() {
    if (this._minecraftPreviewPath) {
      return this._minecraftPreviewPath;
    }

    this._minecraftPreviewPath =
      this.getRoamingPath() +
      "Microsoft Bedrock Preview" +
      path.sep +
      "Users" +
      path.sep +
      "Shared" +
      path.sep +
      "games" +
      path.sep +
      "com.mojang" +
      path.sep;

    // fall back to older UWP path
    if (!fs.existsSync(this._minecraftPreviewPath)) {
      this._minecraftPreviewPath =
        this.getUserLocalPath() +
        "Packages" +
        path.sep +
        "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe" +
        path.sep +
        "LocalState" +
        path.sep +
        "games" +
        path.sep +
        "com.mojang" +
        path.sep;

      if (!fs.existsSync(this._minecraftPreviewPath)) {
        this._minecraftPreviewPath = undefined;
      }
    }

    return this._minecraftPreviewPath;
  }

  getMinecraftEducationReleasePath() {
    if (this._minecraftEducationReleasePath) {
      return this._minecraftEducationReleasePath;
    }

    this._minecraftEducationReleasePath =
      this.getUserLocalPath() +
      "Packages" +
      path.sep +
      "Microsoft.MinecraftEducationEdition_8wekyb3d8bbwe" +
      path.sep +
      "LocalState" +
      path.sep +
      "games" +
      path.sep +
      "com.mojang" +
      path.sep;

    return this._minecraftEducationReleasePath;
  }

  getMinecraftEducationPreviewPath() {
    if (this._minecraftEducationPreviewPath) {
      return this._minecraftEducationPreviewPath;
    }

    this._minecraftEducationPreviewPath =
      this.getUserLocalPath() +
      "Packages" +
      path.sep +
      "Microsoft.MinecraftEducationPreview_8wekyb3d8bbwe" +
      path.sep +
      "LocalState" +
      path.sep +
      "games" +
      path.sep +
      "com.mojang" +
      path.sep;

    return this._minecraftEducationPreviewPath;
  }

  getMinecraftPEPath() {
    if (this._minecraftPEPath) {
      return this._minecraftPEPath;
    }

    this._minecraftPEPath =
      this.getRoamingPath() + "MicrosoftPE" + path.sep + "games" + path.sep + "com.mojang" + path.sep;

    return this._minecraftPEPath;
  }

  deTokenizePath(untrustedPath: string) {
    let resultPath = undefined;

    if (untrustedPath.startsWith("<BDPV>")) {
      let udPath = this.getMinecraftPreviewPath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<BDRK>")) {
      let udPath = this.getMinecraftReleasePath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<EDUR>")) {
      let udPath = this.getMinecraftEducationReleasePath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<EDUP>")) {
      let udPath = this.getMinecraftEducationPreviewPath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<MCPE>")) {
      let udPath = this.getMinecraftPEPath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<DOCP>")) {
      // Check if test storage override is set (for automated tests)
      const testStorageRoot = process.env.MCT_TEST_STORAGE_ROOT;
      let docPBasePath: string;

      if (testStorageRoot) {
        // Use test storage root instead of user's Documents folder
        docPBasePath = testStorageRoot.endsWith(path.sep) ? testStorageRoot : testStorageRoot + path.sep;
      } else {
        // Default: use Documents folder
        docPBasePath = app.getPath("documents") + path.sep + "Minecraft Creator Tools" + path.sep;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      if (!this._docFolderEnsured) {
        this._docFolderEnsured = true;

        if (!fs.existsSync(docPBasePath)) {
          fs.mkdirSync(docPBasePath, { recursive: true });
        }
      }

      resultPath = docPBasePath + segment;
    } else if (untrustedPath.startsWith("<pt_")) {
      resultPath = this.fixupTokenPath(untrustedPath);
    }

    if (resultPath) {
      return resultPath.replace(/\//g, path.sep);
    }

    return undefined;
  }

  fixupTokenPath(path: string) {
    path = path.replace(/\\/g, "/");

    if (path.startsWith("<pt_")) {
      let nextGreater = path.indexOf(">");

      if (nextGreater >= 0) {
        const tok = path.substring(4, nextGreater);

        let tokenPath = this.getTokenPath(tok);

        if (tokenPath) {
          let nextSeg = path.substring(nextGreater + 1);

          if (tokenPath.indexOf("/") >= 0 && !tokenPath.endsWith("/")) {
            tokenPath += "/";
          }

          if (tokenPath.endsWith("/") && nextSeg.startsWith("/")) {
            nextSeg = nextSeg.substring(1);
          }

          return tokenPath + nextSeg;
        } else {
          // Only warn once per missing token to reduce log noise (use static to dedupe across instances)
          if (!ElectronUtils._warnedMissingTokens.has(tok)) {
            ElectronUtils._warnedMissingTokens.add(tok);
            Log.debugAlert(
              "Could not find path mapping for token '" +
                tok +
                "'. Project may reference a folder from a previous session."
            );
          }
        }
      }
    }

    return undefined;
  }

  getTokenPath(token: string) {
    return this._uniqueIdToPathMappings[token];
  }

  validateFolderPath(path: string) {
    // banned character combos
    if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
      throw new Error("Unsupported path combinations: " + path);
    }

    if (path.lastIndexOf(":") >= 2) {
      throw new Error("Unsupported drive location: " + path);
    }

    let count = this.countChar(path, "\\") + this.countChar(path, "/");

    if (!path.endsWith("\\") && !path.endsWith("/")) {
      count++;
    }

    if (count < 2) {
      throw new Error("Unsupported base path: " + path);
    }
  }

  validateFilePath(path: string) {
    this.validateFolderPath(path);

    const extension = this.getTypeFromName(path);

    if (!allowedExtensions.includes(extension)) {
      throw new Error("Unsupported file type: " + path);
    }
  }

  validateExecutableFilePath(path: string) {
    this.validateFolderPath(path);

    const extension = this.getTypeFromName(path);

    if (!allowedExecutableExtensions.includes(extension)) {
      throw new Error("Unsupported executable file type: " + path);
    }
  }

  getTypeFromName(name: string) {
    const nameW = name.trim().toLowerCase();

    const lastBackslash = nameW.lastIndexOf("\\");
    const lastSlash = nameW.lastIndexOf("/");

    const lastPeriod = nameW.lastIndexOf(".");

    if (lastPeriod < 0 || lastPeriod < lastSlash || lastPeriod < lastBackslash) {
      return "";
    }

    return nameW.substring(lastPeriod + 1, nameW.length);
  }

  arrayBufferToBase64(buffer: NonSharedBuffer) {
    var binary = "";
    const bytes = new Uint8Array(buffer);

    const len = bytes.byteLength;

    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  base64ToArrayBuffer(base64buffer: string) {
    const binary = atob(base64buffer);

    const arrayBuffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(arrayBuffer);

    const len = binary.length;

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return arrayBuffer;
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

  getRoamingPath() {
    let udPath = app.getPath("userData");

    const lastSlash = udPath.lastIndexOf(path.sep);
    if (lastSlash >= 0) {
      udPath = udPath.substring(0, lastSlash + 1);
    }

    return udPath;
  }

  getUserLocalPath() {
    let udPath = this.getRoamingPath();

    udPath = udPath.replace("\\Roaming\\", "\\Local\\");

    return udPath;
  }
}
