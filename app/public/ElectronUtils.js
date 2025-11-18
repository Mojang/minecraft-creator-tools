const { app } = require("electron");
const path = require("path");
const _fs = require("fs");
const StorageUtilities = require("./../toolbuild/jsn/storage/StorageUtilities");
const Utilities = require("./../toolbuild/jsn/core/Utilities");

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
];

const allowedExecutableExtensions = ["mcstructure", "mcworld", "mctemplate", "mcaddon"];

class ElectronUtils {
  _minecraftPreviewPath;
  _minecraftReleasePath;
  _uniqueIdToPathMappings;
  _pathToUniqueIdMappings;
  _env;

  constructor(env) {
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

  ensureMappingForPath(path) {
    path = path.replace(/\\/g, "/");

    let pathCanon = StorageUtilities.default.canonicalizePath(path);

    if (pathCanon.indexOf("/") >= 0 && !pathCanon.endsWith("/")) {
      pathCanon += "/";
    }

    if (this._pathToUniqueIdMappings[pathCanon]) {
      return this._pathToUniqueIdMappings[pathCanon];
    } else {
      const uniqueId = StorageUtilities.default.getLeafName(path) + "-" + Utilities.default.createRandomLowerId(6);

      this._pathToUniqueIdMappings[pathCanon] = uniqueId;
      this._uniqueIdToPathMappings[uniqueId] = pathCanon;

      this._env.pathMappings = this._pathToUniqueIdMappings;
      this._env.save();

      return uniqueId;
    }
  }

  hasMappingForPath(path) {
    const pathCanon = StorageUtilities.default.canonicalizePath(path);

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

    if (!_fs.existsSync(this._minecraftReleasePath)) {
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

      if (!_fs.existsSync(this._minecraftReleasePath)) {
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

    if (!_fs.existsSync(this._minecraftPreviewPath)) {
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

      if (!_fs.existsSync(this._minecraftPreviewPath)) {
        this._minecraftPreviewPath = undefined;
      }
    }

    return this._minecraftPreviewPath;
  }

  deTokenizePath(untrustedPath) {
    let resultPath = undefined;

    if (untrustedPath.startsWith("<MCPP>")) {
      let udPath = this.getMinecraftPreviewPath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<MCRP>")) {
      let udPath = this.getMinecraftReleasePath();

      if (!udPath) {
        return undefined;
      }

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      resultPath = udPath + segment;
    } else if (untrustedPath.startsWith("<DOCP>")) {
      const docPBasePath =
        app.getPath("documents") +
        path.sep +
        (this._isCompanion ? "Minecraft Companion" : "Minecraft Creator Tools") +
        path.sep;

      let segment = untrustedPath.substring(6);

      if (segment.startsWith(path.sep)) {
        segment = segment.substring(1);
      }

      if (!this._docFolderEnsured) {
        this._docFolderEnsured = true;

        if (!_fs.existsSync(docPBasePath)) {
          _fs.mkdirSync(docPBasePath);
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

  fixupTokenPath(path) {
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
          console.log("Error: Could not find token: |" + tok + "|" + JSON.stringify(this._uniqueIdToPathMappings));
        }
      }
    }

    return undefined;
  }

  getTokenPath(token) {
    return this._uniqueIdToPathMappings[token];
  }

  validateFolderPath(path) {
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

  validateFilePath(path) {
    this.validateFolderPath(path);

    const extension = this.getTypeFromName(path);

    if (!allowedExtensions.includes(extension)) {
      throw new Error("Unsupported file type: " + path);
    }
  }

  validateExecutableFilePath(path) {
    this.validateFolderPath(path);

    const extension = this.getTypeFromName(path);

    if (!allowedExecutableExtensions.includes(extension)) {
      throw new Error("Unsupported executable file type: " + path);
    }
  }

  getTypeFromName(name) {
    const nameW = name.trim().toLowerCase();

    const lastBackslash = nameW.lastIndexOf("\\");
    const lastSlash = nameW.lastIndexOf("/");

    const lastPeriod = nameW.lastIndexOf(".");

    if (lastPeriod < 0 || lastPeriod < lastSlash || lastPeriod < lastBackslash) {
      return "";
    }

    return nameW.substring(lastPeriod + 1, nameW.length);
  }

  arrayBufferToBase64(buffer) {
    var binary = "";
    const bytes = new Uint8Array(buffer);

    const len = bytes.byteLength;

    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  base64ToArrayBuffer(base64buffer) {
    const binary = atob(base64buffer);

    const arrayBuffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(arrayBuffer);

    const len = binary.length;

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return arrayBuffer;
  }

  countChar(source, find) {
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

module.exports = ElectronUtils;
