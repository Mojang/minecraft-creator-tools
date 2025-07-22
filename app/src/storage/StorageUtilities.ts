// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import DifferenceSet from "./DifferenceSet";
import { FolderDifferenceType } from "./IFolderDifference";
import { FileDifferenceType } from "./IFileDifference";
import Utilities from "../core/Utilities";
import ZipStorage from "./ZipStorage";
import Log from "../core/Log";
import IStorage, { StorageErrorStatus } from "./IStorage";
import Storage from "./Storage";
import { BasicValidators } from "./BasicValidators";

export const MaxShareableContentStringLength = 65536;

// part of security/reliability and defense in depth is to only allow our file functions to work with files from an allow list
// this list is also replicated in /public/preload.js
export const AllowedExtensionsSet = new Set([
  "js",
  "ts",
  "json",
  "md",
  "png",
  "css",
  "woff",
  "ttf",
  "woff2",
  "jpg",
  "gitignore",
  "jpeg",
  "gif",
  "lang",
  "fsb",
  "map",
  "yml",
  "ico",
  "ogg",
  "flac",
  "psd",
  "nojekyll",
  "mjs",
  "env",
  "wav",
  "tga",
  "old",
  "mc",
  "",
  "zip",
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
  "hdr",
  "h",
  "fontdata",
  "mcstructure",
  "mcworld",
  "mcproject",
  "material",
  "vertex",
  "geometry",
  "fragment",
  "map",
  "js.map",
  "mctemplate",
  "mcfunction",
  "mcaddon",
  "mcpack",
  "html",
  "dat",
  "dat_old",
  "txt",
  "ldb",
  "log",
]);

const IgnoreExtensionsSet = new Set(["ds_store", "brarchive"]);

const IgnoreFolders = ["__MACOSX", "credits", "shaders", "hbui", "ray_tracing", "node_modules", "test", "__brarchive"];

const _minecraftProjectFolderNames = [
  "behavior_packs",
  "resource_packs",
  "worlds",
  "world",
  "world_template",
  "skin_pack",
  "scripts",
  "content",
  "marketing art",
  "store art",
  "db",
  "texts",
  "animation_controllers",
  "blocks",
  "structures",
  "entities",
  "functions",
  "items",
  "dialogue",
  "animations",
  "entity",
  "materials",
  "models",
  "textures",
  "fogs",
  "materials",
  "particles",
  "ui",
];

export enum EncodingType {
  ByteBuffer,
  Utf8String,
}

export default class StorageUtilities {
  public static standardFolderDelimiter = "/";
  private static textEncoder = new TextEncoder();

  public static isUsableFile(path: string) {
    const extension = StorageUtilities.getTypeFromName(path);

    return AllowedExtensionsSet.has(extension);
  }

  public static canIgnoreFileExtension(extension: string) {
    return IgnoreExtensionsSet.has(extension);
  }

  public static isIgnorableFolder(folderName: string) {
    const folderNameLower = folderName.toLowerCase();
    return (
      (folderNameLower.startsWith(".") && folderNameLower !== ".mcp" && folderNameLower !== ".vscode") ||
      IgnoreFolders.includes(folderNameLower)
    );
  }

  public static getEncodingByFileName(name: string): EncodingType {
    const fileType = this.getTypeFromName(name);
    const nameLow = name.toLowerCase();

    switch (fileType) {
      case "mcstructure":
      case "zip":
      case "dat":
      case "dat_old":
      case "ldb":
      case "ico":
      case "tga":
      case "ogg":
      case "flac":
      case "wav":
      case "gif":
      case "jpeg":
      case "jpg":
      case "png":
      case "psd":
      case "mp3":
      case "fsb":
      case "woff":
      case "woff2":
      case "ttf":
      case "pdb":
      case "exe":
      case "nbt":
      case "mcworld":
      case "mcproject":
      case "mctemplate":
      case "mcpack":
      case "mcaddon":
        return EncodingType.ByteBuffer;
    }

    if (fileType === "" && nameLow.startsWith("manifest-")) {
      return EncodingType.ByteBuffer;
    }

    if (nameLow.startsWith("0") && fileType === "log") {
      return EncodingType.ByteBuffer;
    }

    return EncodingType.Utf8String;
  }

  public static absolutize(path: string) {
    if (!path.startsWith(StorageUtilities.standardFolderDelimiter)) {
      path = StorageUtilities.standardFolderDelimiter + path;
    }

    return path;
  }

  public static getUniqueChildFolderName(name: string, folder: IFolder) {
    let num = 1;
    let nameCand = name;
    let isUnique = false;

    while (!isUnique) {
      isUnique = true;
      for (const childFolderName in folder.folders) {
        if (StorageUtilities.canonicalizeName(childFolderName) === StorageUtilities.canonicalizeName(nameCand)) {
          isUnique = false;
        }
      }

      if (!isUnique) {
        nameCand = name + " " + num;
        num++;
      }
    }

    return nameCand;
  }

  public static ensureEndsDelimited(path: string) {
    if (!path.endsWith(StorageUtilities.standardFolderDelimiter)) {
      path = path + StorageUtilities.standardFolderDelimiter;
    }

    if (path.startsWith("." + StorageUtilities.standardFolderDelimiter)) {
      path = path.substring(1);
    } else if (!path.startsWith(StorageUtilities.standardFolderDelimiter)) {
      path = StorageUtilities.standardFolderDelimiter + path;
    }

    return path;
  }

  public static ensureEndsWithDelimiter(path: string) {
    if (!path.endsWith(StorageUtilities.standardFolderDelimiter)) {
      path = path + StorageUtilities.standardFolderDelimiter;
    }

    return path;
  }

  /***
   * returns true if IFile argument is a .json file
   */
  public static isJsonFile(file?: IFile | null): file is IFile {
    return !!file && file.fullPath.endsWith(".json");
  }

  /***
   * Checks binary file contents for a UTF8 Byte Order Mark
   *
   * falsey contents will return false
   */
  public static hasUTF8ByteOrderMark(bytes?: Uint8Array | null) {
    if (!bytes) {
      return false;
    }

    return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  }

  /***
   * Normalizes file contents by converting non-binary contents into binary
   *
   * falsey content will return as null
   */
  public static getContentsAsBinary(file: IFile): Uint8Array | null {
    if (!file || !file.content) return null;
    if (typeof file.content === "string") {
      return StorageUtilities.textEncoder.encode(file.content);
    }

    return file.content as Uint8Array;
  }

  public static ensureStartsWithDelimiter(path: string) {
    if (!path.startsWith(StorageUtilities.standardFolderDelimiter)) {
      path = StorageUtilities.standardFolderDelimiter + path;
    }

    return path;
  }

  public static ensureNotStartsWithDelimiter(path: string) {
    if (path.startsWith(StorageUtilities.standardFolderDelimiter)) {
      path = path.substring(1);
    }

    return path;
  }

  public static joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(StorageUtilities.standardFolderDelimiter)) {
      fullPath += StorageUtilities.standardFolderDelimiter;
    }

    if (pathB.startsWith("/")) {
      fullPath += pathB.substring(1, pathB.length);
    } else {
      fullPath += pathB;
    }

    return fullPath;
  }

  static getMimeType(file: IFile) {
    switch (StorageUtilities.getTypeFromName(file.name)) {
      case "js":
        return "application/javascript";

      case "ts":
        return "application/typescript";

      case "json":
        return "application/json";

      case "mcworld":
      case "mctemplate":
      case "mcproject":
      case "mcaddon":
      case "mcpack":
      case "zip":
        return "application/zip";

      case "mcstucture":
        return "application/octet-stream";

      case "mcfunction":
      case "material":
      case "env":
      case "lang":
        return "text/plain";

      case "wav":
        return "audio/wav";

      case "mp3":
        return "audio/mp3";
      case "ogg":
        return "audio/ogg";
      case "flac":
        return "audio/flac";

      case "psd":
        return "image/vnd.adobe.photoshop";

      case "jpg":
      case "jpeg":
        return "image/jpg";

      case "png":
        return "image/png";

      case "tiff":
      case "tga":
        return "image/tiff";

      default:
        return "application/octet-stream";
    }
  }

  public static getContentAsString(file: IFile) {
    if (typeof file.content === "string") {
      return file.content;
    } else if (file.content instanceof Uint8Array) {
      return "data:" + StorageUtilities.getMimeType(file) + ";base64," + Utilities.uint8ArrayToBase64(file.content);
    }

    return undefined;
  }

  public static async getFileStorageFolder(file: IFile): Promise<IFolder | undefined | string> {
    let zipStorage = file.fileContainerStorage as ZipStorage;

    if (!zipStorage) {
      await file.loadContent();

      if (!file.content || !(file.content instanceof Uint8Array)) {
        return undefined;
      }

      zipStorage = new ZipStorage();

      await zipStorage.loadFromUint8Array(file.content, file.name);

      if (zipStorage.errorStatus === StorageErrorStatus.unprocessable) {
        file.errorStateMessage = zipStorage.errorMessage;
        return file.errorStateMessage;
      }

      file.fileContainerStorage = zipStorage;
      file.fileContainerStorage.storagePath = file.storageRelativePath + "#";
    }

    return zipStorage.rootFolder;
  }

  public static getContaineredFileLeafPath(path: string | null | undefined) {
    if (!path) {
      return;
    }
    const lastHash = path.lastIndexOf("#");

    if (lastHash >= 0) {
      path = path.substring(lastHash + 1);
    }

    return path;
  }

  public static isMinecraftInternalFolder(folder: IFolder) {
    const nameCanon = folder.name.toLowerCase();

    return _minecraftProjectFolderNames.includes(nameCanon);
  }

  public static isContainerFile(path: string) {
    const extension = StorageUtilities.getTypeFromName(path);

    if (
      extension === "zip" ||
      extension === "mcworld" ||
      extension === "mcproject" ||
      extension === "mctemplate" ||
      extension === "mcpack" ||
      extension === "mcaddon"
    ) {
      return true;
    }

    return false;
  }

  public static isFileStorageItem(file: IFile) {
    return this.isContainerFile(file.name);
  }

  public static canonicalizeName(name: string): string {
    name = name.trim(); //.toLowerCase();

    if (name.startsWith("/") || name.startsWith("\\")) {
      name = name.substring(1, name.length);
    }

    if (name.endsWith("/") || name.endsWith("\\")) {
      name = name.substring(0, name.length - 1);
    }

    // constructor is a keyword that will cause array existence checks to fail in interesting ways
    if (name === "constructor") {
      name = "__constructor";
    }

    name = name.replace(/%20/g, " ");
    name = name.replace(/%28/g, "(");
    name = name.replace(/%29/g, ")");

    if (!Utilities.isUsableAsObjectKey(name)) {
      name = "named_" + name;
    }

    return name;
  }

  public static isPathEqual(pathA: string, pathB: string) {
    return StorageUtilities.canonicalizePath(pathA) === StorageUtilities.canonicalizePath(pathB);
  }

  public static canonicalizePath(path: string): string {
    path = path.trim(); //  .toLowerCase();
    path = path.replace(/\\/g, "/");
    path = path.replace(/%20/g, " ");
    path = path.replace(/%28/g, "(");
    path = path.replace(/%29/g, ")");

    return path;
  }

  public static canonicalizePathAsFileName(path: string): string {
    let result = path.trim().toLowerCase();

    path = path.replace(/%20/g, " ");
    path = path.replace(/%28/g, "(");
    path = path.replace(/%29/g, ")");

    result = result.replace(/:/g, "_");
    result = result.replace(/\//g, "-");
    result = result.replace(/\\/g, "-");
    result = result.replace(/%/g, "-");
    result = result.replace(/--/g, "-");
    result = result.replace(/--/g, "-");

    result = result.replace(/\?/g, "-");
    result = result.replace(/\|/g, "-");

    return result;
  }

  public static ensureFileNameIsSafe(path: string): string {
    let result = path.trim().toLowerCase();

    path = path.replace(/%20/g, " ");
    path = path.replace(/%28/g, "(");
    path = path.replace(/%29/g, ")");

    result = result.replace(/:/g, "_");
    result = result.replace(/\//g, "-");
    result = result.replace(/\\/g, "-");
    result = result.replace(/%/g, "-");
    result = result.replace(/--/g, "-");
    result = result.replace(/`/g, "-");
    result = result.replace(/'/g, "-");
    result = result.replace(/–/g, "-");

    return result;
  }

  public static hasPathSeparator(path: string): boolean {
    if (!path) {
      return false;
    }
    let lastSlash = path.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0) {
      return true;
    }

    lastSlash = path.lastIndexOf("\\", path.length - 1);

    if (lastSlash >= 0) {
      return true;
    }

    return false;
  }

  public static getLeafName(path: string): string {
    let name = path;

    if (name.endsWith("/")) {
      name = name.substring(0, name.length - 1);
    }

    if (name.endsWith("\\")) {
      name = name.substring(0, name.length - 1);
    }

    let lastSlash = name.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0) {
      name = name.substring(lastSlash + 1, name.length);
    }

    lastSlash = name.lastIndexOf("\\", name.length - 1);

    if (lastSlash >= 0) {
      name = name.substring(lastSlash + 1, name.length);
    }

    return name;
  }

  public static getFolderPath(path: string): string {
    let lastSlash = path.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0 && lastSlash < path.length - 1) {
      path = path.substring(0, lastSlash + 1);
    } else {
      lastSlash = path.lastIndexOf("\\", path.length - 1);

      if (lastSlash >= 0 && lastSlash < path.length - 1) {
        path = path.substring(0, lastSlash + 1);
      }
    }

    return path;
  }

  public static getParentFolderNameFromPath(path: string): string | undefined {
    let lastSlash = path.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0 && lastSlash < path.length - 1) {
      const nextLastSlash = path.lastIndexOf("/", lastSlash - 1);

      return path.substring(nextLastSlash + 1, lastSlash);
    } else {
      lastSlash = path.lastIndexOf("\\", path.length - 1);

      if (lastSlash >= 0 && lastSlash < path.length - 1) {
        const nextLastSlash = path.lastIndexOf("/", lastSlash - 1);

        return path.substring(nextLastSlash + 1, lastSlash);
      }
    }

    return undefined;
  }

  public static removeContainerExtension(name: string): string {
    let nameW = name.trim();

    if (nameW.endsWith(".zip")) {
      nameW = nameW.substring(0, nameW.length - 4);
    }
    return nameW;
  }

  public static getBaseFromName(name: string): string {
    const nameW = name.trim();

    const lastPeriod = nameW.lastIndexOf(".");

    if (lastPeriod < 0) {
      return name;
    }

    return nameW.substring(0, lastPeriod);
  }

  public static convertFolderPlaceholdersComplete(path: string) {
    return this.convertFolderPlaceholders(path, 0);
  }

  public static convertFolderPlaceholders(path: string, startIndex?: number) {
    if (startIndex === undefined) {
      startIndex = 4; // default is to ignore the <pt_ at the start.
    }

    let pathTokenStart = path.indexOf("<pt_", startIndex);

    while (pathTokenStart >= startIndex) {
      let pathTokenEnd = path.indexOf(">", pathTokenStart + 4);

      if (pathTokenEnd > pathTokenStart) {
        path =
          path.substring(0, pathTokenStart) +
          path.substring(pathTokenStart + 4, pathTokenEnd) +
          path.substring(pathTokenEnd + 1);

        pathTokenStart = path.indexOf("<pt_", pathTokenStart);
      } else {
        pathTokenStart = path.indexOf("<pt_", pathTokenStart + 1);
      }
    }

    return path;
  }

  public static getCoreBaseFromName(name: string): string {
    const nameW = name.trim();

    let firstPeriod = nameW.indexOf(".");

    if (firstPeriod < 0) {
      return name;
    }

    return nameW.substring(0, firstPeriod);
  }

  public static getTypeFromName(name: string): string {
    const nameW = name.trim().toLowerCase();

    const lastPeriod = nameW.lastIndexOf(".");

    if (lastPeriod < 0) {
      return "";
    }

    return nameW.substring(lastPeriod + 1, nameW.length);
  }

  public static async folderContentsEqual(
    folderA: IFolder | undefined,
    folderB: IFolder | undefined,
    excludingFiles?: string[],
    whitespaceAgnostic?: boolean,
    ignoreLinesContaining?: string[]
  ): Promise<{ result: boolean; reason: string }> {
    if (folderA === undefined && folderB === undefined) {
      return { result: true, reason: "Both folders are undefined." };
    }

    if (folderA === undefined) {
      return { result: false, reason: "First folder is undefined." };
    }

    if (folderB === undefined) {
      return { result: false, reason: "Second folder is undefined." };
    }

    await folderA.load(false);
    await folderB.load(false);

    if (folderA.fileCount !== folderB.fileCount) {
      return {
        result: false,
        reason:
          "Folder '" +
          folderA.fullPath +
          "' has " +
          folderA.fileCount +
          " files; folder '" +
          folderB.fullPath +
          "' has " +
          folderB.fileCount +
          " files.",
      };
    }

    for (const fileName in folderA.files) {
      const fileA = folderA.files[fileName];
      const fileB = folderB.files[fileName];

      if (fileA === undefined) {
        return { result: false, reason: "Unexpected file '" + fileName + "' undefined." };
      }

      if (fileB === undefined) {
        return { result: false, reason: "File '" + fileName + "' does not exist in '" + folderB.fullPath + "'" };
      }

      if (!excludingFiles || !excludingFiles.includes(fileA.name)) {
        const result = await StorageUtilities.fileContentsEqual(
          fileA,
          fileB,
          whitespaceAgnostic,
          ignoreLinesContaining
        );

        if (!result) {
          return {
            result: false,
            reason:
              "File '" +
              fileA.fullPath +
              "' (size: " +
              fileA.content?.length +
              (fileA.isBinary ? "B" : "C") +
              ") contents does not match '" +
              fileB.fullPath +
              "' (size: " +
              fileB.content?.length +
              (fileB.isBinary ? "B" : "C") +
              ")",
          };
        }
      }
    }

    for (const folderName in folderA.folders) {
      const childFolderA = folderA.folders[folderName];
      const childFolderB = folderB.folders[folderName];

      if (childFolderA === undefined) {
        return { result: false, reason: "Unexpected folder undefined. " };
      }

      if (childFolderB === undefined) {
        return { result: false, reason: "Folder '" + folderName + "' does not exist in '" + folderB.fullPath + "'" };
      }

      const result = await StorageUtilities.folderContentsEqual(
        childFolderA,
        childFolderB,
        excludingFiles,
        whitespaceAgnostic,
        ignoreLinesContaining
      );

      if (!result.result) {
        return result;
      }
    }

    return { result: true, reason: "Folders are equal" };
  }

  public static async fileContentsEqual(
    fileA: IFile | undefined,
    fileB: IFile | undefined,
    whitespaceAgnostic?: boolean,
    ignoreLinesContaining?: string[]
  ) {
    if (fileA === undefined && fileB === undefined) {
      return true;
    }

    if (fileA === undefined) {
      return false;
    }

    if (fileB === undefined) {
      return false;
    }

    const fileAExists = await fileA.exists();

    if (!fileAExists) {
      return false;
    }

    const fileBExists = await fileB.exists();

    if (fileAExists && !fileBExists) {
      return false;
    }

    await fileA.loadContent(false);
    await fileB.loadContent(false);

    if (fileA.content === undefined && fileB.content === undefined) {
      return true;
    }

    const extA = StorageUtilities.getTypeFromName(fileA.name);
    const extB = StorageUtilities.getTypeFromName(fileB.name);

    let contentA = fileA.content;
    let contentB = fileB.content;

    if (contentA === null && contentB === null) {
      return true;
    }

    if (contentA === null || contentB === null) {
      return false;
    }

    if (ignoreLinesContaining && typeof contentA === "string" && typeof contentB === "string") {
      for (const ignoreLine of ignoreLinesContaining) {
        contentA = Utilities.stripLinesContaining(contentA, ignoreLine);
        contentB = Utilities.stripLinesContaining(contentB, ignoreLine);
      }
    }

    if (extA === "json" && extB === "json" && typeof contentA === "string" && typeof contentB === "string") {
      return this.jsonContentsAreEqualIgnoreWhitespace(contentA, contentB);
    } else if (whitespaceAgnostic) {
      return StorageUtilities.contentsAreEqualIgnoreWhitespace(contentA, contentB);
    }

    return StorageUtilities.contentsAreEqual(contentA, contentB);
  }

  public static jsonContentsAreEqualIgnoreWhitespace(contentA: string, contentB: string) {
    contentA = this.stripWhitespace(contentA);
    contentB = this.stripWhitespace(contentB);

    return contentA === contentB;
  }

  public static stripWhitespace(content: string) {
    content = content.trim();

    content = content.replace(/ /gi, "");
    content = content.replace(/\r/gi, "");
    content = content.replace(/\n/gi, "");
    content = content.replace(/\t/gi, "");

    return content;
  }

  public static contentsAreEqual(contentA: string | Uint8Array | null, contentB: string | Uint8Array | null) {
    if (contentA === null && contentB === null) {
      return true;
    }

    if (typeof contentA === "string" && typeof contentB === "string") {
      return contentA === contentB;
    }

    if (contentA instanceof Uint8Array && contentB instanceof Uint8Array) {
      return Utilities.uint8ArraysAreEqual(contentA, contentB);
    }

    return false;
  }
  public static contentsAreEqualIgnoreWhitespace(
    contentA: string | Uint8Array | null,
    contentB: string | Uint8Array | null
  ) {
    if (contentA === null && contentB === null) {
      return true;
    }

    if (typeof contentA === "string" && typeof contentB === "string") {
      return this.stripWhitespace(contentA) === this.stripWhitespace(contentB);
    }

    if (contentA instanceof Uint8Array && contentB instanceof Uint8Array) {
      return Utilities.uint8ArraysAreEqual(contentA, contentB);
    }

    return false;
  }

  public static async getDifferences(
    original: IFolder,
    updated: IFolder,
    includeDeletions: boolean,
    matchSingleChildFolders: boolean
  ) {
    // matchSingleChildFolders: for project template starters, where they have a structure like:
    //     resource_packs/template_name
    // that gets renamed to
    //     resource_packs/mikesfooproject
    // then -- if there is one folder in the original and one folder in the updated,
    // we want to match them up irrespective of the name

    const data = new DifferenceSet();

    await this.addDifferences(data, original, updated, includeDeletions, matchSingleChildFolders);

    return data;
  }

  public static getFirstFile(folder: IFolder): IFile | undefined {
    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file && !file.canIgnore) {
        return file;
      }
    }

    for (const folderName in folder.folders) {
      const subFolder = folder.folders[folderName];

      if (subFolder) {
        const file = this.getFirstFile(subFolder);

        if (file && !file.canIgnore) {
          return file;
        }
      }
    }

    return undefined;
  }

  public static async addDifferences(
    differences: DifferenceSet,
    original: IFolder,
    updated: IFolder,
    includeDeletions: boolean,
    matchSingleFolders: boolean
  ): Promise<FolderDifferenceType> {
    await original.load(false);

    await updated.load(false);

    let result: FolderDifferenceType = FolderDifferenceType.none;

    // get a list of existing files and folders in the target
    const updatedFilesToConsider: { [id: string]: boolean } = {};
    const updatedFoldersToConsider: { [id: string]: boolean } = {};

    for (const updatedFileName in updated.files) {
      if (BasicValidators.isFileNameOKForSharing(updatedFileName)) {
        updatedFilesToConsider[updatedFileName] = true;
      }
    }

    for (const updatedFolderName in updated.folders) {
      if (BasicValidators.isFolderNameOKForSharing(updatedFolderName)) {
        updatedFoldersToConsider[updatedFolderName] = true;
      }
    }

    for (const originalFileName in original.files) {
      if (BasicValidators.isFileNameOKForSharing(originalFileName)) {
        const originalFile = original.files[originalFileName];

        if (originalFile !== undefined) {
          updatedFilesToConsider[originalFileName] = false;

          if (updated.fileExists(originalFileName)) {
            const updatedFile = updated.files[originalFileName];

            const areEqual = await StorageUtilities.fileContentsEqual(originalFile, updatedFile);

            if (!areEqual) {
              if ((result & FolderDifferenceType.fileContentsDifferent) === 0) {
                result += FolderDifferenceType.fileContentsDifferent;
              }

              differences.fileDifferences.push({
                type: FileDifferenceType.contentsDifferent,
                path: originalFile.storageRelativePath,
                original: originalFile,
                updated: updatedFile,
              });
            }
          } else if (includeDeletions) {
            if ((result & FolderDifferenceType.fileListDifferent) === 0) {
              result += FolderDifferenceType.fileListDifferent;
            }

            differences.fileDifferences.push({
              type: FileDifferenceType.fileDeleted,
              path: originalFile.storageRelativePath,
              original: originalFile,
            });
          }
        }
      }
    }

    for (const originalFolderName in original.folders) {
      if (BasicValidators.isFolderNameOKForSharing(originalFolderName)) {
        const originalChildFolder = original.folders[originalFolderName];

        if (originalChildFolder !== undefined) {
          updatedFoldersToConsider[originalFolderName] = false;

          if (
            updated.folderExists(originalFolderName) ||
            (matchSingleFolders && updated.folderCount === 1 && original.folderCount === 1)
          ) {
            let updatedChildFolder = updated.folders[originalFolderName];

            if (matchSingleFolders && updated.folderCount && original.folderCount && !updatedChildFolder) {
              updatedChildFolder = updated.getFolderByIndex(0);
            }

            if (updatedChildFolder !== undefined) {
              updatedFoldersToConsider[updatedChildFolder.name] = false;

              const childResult = await StorageUtilities.addDifferences(
                differences,
                originalChildFolder,
                updatedChildFolder,
                includeDeletions,
                matchSingleFolders
              );

              if (childResult !== FolderDifferenceType.none) {
                result = result | childResult;
              }
            }
          } else if (includeDeletions) {
            if ((result & FolderDifferenceType.folderDeleted) === 0) {
              result += FolderDifferenceType.folderDeleted;
            }

            this.addDifferencesAsFolderDelete(differences, originalChildFolder);
          }
        }
      }
    }

    for (const updatedFileName in updatedFilesToConsider) {
      if (updatedFilesToConsider[updatedFileName] === true) {
        const updatedFile = updated.files[updatedFileName];

        if (updatedFile !== undefined) {
          if ((result & FolderDifferenceType.fileListDifferent) === 0) {
            result += FolderDifferenceType.fileListDifferent;
          }

          if (updatedFile.content !== undefined && updatedFile.content !== null) {
            differences.fileDifferences.push({
              type: FileDifferenceType.fileAdded,
              path: StorageUtilities.relativizePathToOriginal(original, updated, updatedFile.storageRelativePath),
              updated: updatedFile,
            });
          }
        }
      }
    }

    for (const updatedFolderName in updatedFoldersToConsider) {
      if (updatedFoldersToConsider[updatedFolderName] === true) {
        const updatedFolder = updated.folders[updatedFolderName];

        if (updatedFolder !== undefined) {
          if ((result & FolderDifferenceType.folderAdded) === 0) {
            result += FolderDifferenceType.folderAdded;
          }

          this.addDifferencesAsFolderAdd(differences, updatedFolder, original, updated);
        }
      }
    }

    if (result !== FolderDifferenceType.none) {
      differences.folderDifferences.push({
        type: result,
        path: original.storageRelativePath,
        original: original,
        updated: updated,
      });
    }

    return result;
  }

  public static relativizePathToOriginal(original: IFolder, updated: IFolder, path: string) {
    const folders = original.storageRelativePath.split(StorageUtilities.standardFolderDelimiter);

    for (let i = folders.length - 1; i >= 0; i--) {
      const lastIndexOfInPath = path.lastIndexOf("/" + folders[i] + "/");
      const lastIndexOfInSource = original.storageRelativePath.lastIndexOf("/" + folders[i] + "/");

      if (lastIndexOfInPath >= 0 && lastIndexOfInSource >= 0) {
        return original.storageRelativePath.substring(0, lastIndexOfInSource) + path.substring(lastIndexOfInPath);
      }
    }

    const originalPathLength = original.storageRelativePath.length;
    const updatedPathLength = updated.storageRelativePath.length;

    if (updatedPathLength > originalPathLength) {
      path = path.substring(updatedPathLength - originalPathLength, path.length);
    }

    return path;
  }

  public static async addDifferencesAsFolderAdd(
    differences: DifferenceSet,
    childUpdated: IFolder,
    original: IFolder,
    updated: IFolder
  ) {
    await childUpdated.load(false);

    differences.folderDifferences.push({
      type: FolderDifferenceType.folderAdded,
      path: StorageUtilities.relativizePathToOriginal(original, updated, childUpdated.storageRelativePath),
      updated: childUpdated,
    });

    for (const updatedFileName in childUpdated.files) {
      const updatedFile = childUpdated.files[updatedFileName];

      if (updatedFile !== undefined) {
        differences.fileDifferences.push({
          type: FileDifferenceType.fileAdded,
          path: StorageUtilities.relativizePathToOriginal(original, updated, updatedFile.storageRelativePath),
          updated: updatedFile,
        });
      }
    }

    for (const updatedFolderName in childUpdated.folders) {
      const updatedFolder = childUpdated.folders[updatedFolderName];

      if (updatedFolder !== undefined) {
        this.addDifferencesAsFolderAdd(differences, updatedFolder, original, updated);
      }
    }
  }

  public static async addDifferencesAsFolderDelete(differences: DifferenceSet, original: IFolder) {
    await original.load(false);

    differences.folderDifferences.push({
      type: FolderDifferenceType.folderDeleted,
      path: original.storageRelativePath,
      updated: original,
    });

    for (const originalFileName in original.files) {
      const originalFile = original.files[originalFileName];

      if (originalFile !== undefined) {
        differences.fileDifferences.push({
          type: FileDifferenceType.fileDeleted,
          path: originalFile.storageRelativePath,
          original: originalFile,
        });
      }
    }

    for (const originalFolderName in original.folders) {
      const originalFolder = original.folders[originalFolderName];

      if (originalFolder !== undefined) {
        this.addDifferencesAsFolderDelete(differences, originalFolder);
      }
    }
  }

  public static isPathRiskyForDelete(path: string) {
    path = path.toLowerCase().trim();

    if (path.indexOf("system32") >= 0 || path.indexOf("program files") >= 0 || path.indexOf("programdata") >= 0) {
      return true;
    }

    // a very crude way to ensure this code never removes c:\ or c:\my documents or whatever or something elemental.
    return Utilities.countChar(path, "/") + Utilities.countChar(path, "\\") < 4;
  }

  public static getParentOfParentFolderNamed(folderName: string, folder: IFolder) {
    let ancestorFolder = undefined;

    while (folder.name !== folderName && folder.parentFolder) {
      folder = folder.parentFolder;
    }

    if (folder.parentFolder) {
      ancestorFolder = folder.parentFolder;
    }

    return ancestorFolder;
  }

  public static getJsonObject(file: IFile): any | undefined {
    if (!file.content) {
      return undefined;
    }

    if (!(typeof file.content === "string")) {
      return undefined;
    }

    let jsonObject = undefined;
    let didFailToParse = false;
    let contents = file.content;

    contents = Utilities.fixJsonContent(contents);

    try {
      jsonObject = JSON.parse(contents);
    } catch (e: any) {
      file.isInErrorState = true;
      file.errorStateMessage = e.message;
      didFailToParse = true;
      // Log.fail("Could not parse JSON from '" + file.fullPath + "': " + e.message);
    }

    if (file.isInErrorState && !didFailToParse && contents.length > 0) {
      file.isInErrorState = false;
      file.errorStateMessage = undefined;
    }

    return jsonObject;
  }

  public static async getUniqueFileName(baseName: string, extension: string, folder: IFolder) {
    let candFileName = baseName + "." + extension;

    let exists = folder.fileExists(candFileName);
    let increment = 0;

    while (exists && increment < 99) {
      increment++;

      candFileName = baseName + " " + String(increment) + "." + extension;

      exists = folder.fileExists(candFileName);
    }

    return candFileName;
  }

  static async ensureFilesFromJson(
    storage: IStorage,
    json: string | { [name: string]: object | string }
  ): Promise<string | undefined> {
    if (typeof json === "string") {
      try {
        json = JSON.parse(json);
      } catch (e: any) {
        return e.toString();
      }
    }

    if (typeof json === "object") {
      for (let path in json) {
        let data = json[path];

        if (!path.startsWith(StorageUtilities.standardFolderDelimiter)) {
          path = StorageUtilities.standardFolderDelimiter + path;
        }

        const file = await storage.rootFolder.ensureFileFromRelativePath(path);

        if (!file) {
          return "Could not create file '" + path + "'.";
        }

        if (file.isBinary) {
          return "Could not create file '" + path + "'; it is a binary file.";
        }

        if (typeof data === "object") {
          try {
            data = JSON.stringify(data, null, 2);
          } catch (e: any) {
            return e.toString();
          }
        }

        file.setContent(data);
      }
    }

    return;
  }

  public static async createStorageFromString(content: string): Promise<string | IStorage> {
    let storage: IStorage | undefined = undefined;

    try {
      content = content.trim();

      if (content.length < 1) {
        return "No content provided.";
      }

      if (content.startsWith("{") || content.startsWith("[")) {
        storage = new Storage();

        const result = await StorageUtilities.ensureFilesFromJson(storage, content);

        if (result) {
          return result;
        }
      } else {
        const contentUnbase64 = Utilities.base64ToUint8Array(content);

        if (contentUnbase64.length < 2) {
          return "Invalid base64 content provided.";
        }

        if (contentUnbase64[0] === "{".charCodeAt(0)) {
          const jsonStr = new TextDecoder("utf-8").decode(contentUnbase64);

          storage = new Storage();

          const result = await StorageUtilities.ensureFilesFromJson(storage, jsonStr);

          if (!result && typeof result === "string") {
            return result;
          }
        } else {
          storage = new ZipStorage();

          await (storage as ZipStorage).loadFromBase64(content);
        }
      }

      if (storage.errorStatus) {
        return "Error processing content." + (storage.errorMessage ? "Details: " + storage.errorMessage : "");
      }
    } catch (e: any) {
      return "Unexpected error processing content.";
    }

    return storage;
  }

  public static async createStorageFromUntrustedString(untrustedContent: string): Promise<string | IStorage> {
    if (untrustedContent.length > MaxShareableContentStringLength) {
      return (
        "Shared content are too large to include in the URL (" +
        untrustedContent.length +
        " > " +
        MaxShareableContentStringLength +
        ")."
      );
    }

    const result = await StorageUtilities.createStorageFromString(untrustedContent);

    if (!result || typeof result === "string") {
      return result;
    }

    const valResult = await BasicValidators.isFolderSharingValid(result.rootFolder);

    if (valResult !== undefined) {
      return valResult;
    }

    return result;
  }

  public static async syncFolderTo(
    source: IFolder,
    target: IFolder,
    forceFolders: boolean,
    forceFileUpdates: boolean,
    removeOnTarget: boolean,
    exclude?: string[],
    include?: string[],
    messageUpdater?: (message: string) => Promise<void>,
    dontOverwriteExistingFiles?: boolean,
    skipFilesAtRoot?: boolean
  ): Promise<number> {
    let modifiedFileCount = 0;
    // Log.debug("Syncing folder '" + source.storageRelativePath + "' to '" + target.storageRelativePath + "'");

    if (StorageUtilities.isIgnorableFolder(source.name)) {
      return 0;
    }
    /*
    if (messageUpdater) {
      await messageUpdater(
        "Syncing folder from '" + source.storageRelativePath + "' to '" + target.storageRelativePath + "'."
      );
    }*/

    await source.load(forceFolders);
    await target.load(forceFolders);

    // get a list of existing files and folders in the target
    let targetFiles: { [id: string]: boolean } = {};
    let targetFolders: { [id: string]: boolean } = {};

    for (const targetFileName in target.files) {
      if (target.files[targetFileName] !== undefined) {
        targetFiles[targetFileName] = true;
      }
    }

    if (!skipFilesAtRoot) {
      for (const targetFolderName in target.folders) {
        if (target.folders[targetFolderName] !== undefined && !StorageUtilities.isIgnorableFolder(targetFolderName)) {
          targetFolders[targetFolderName] = true;
        }
      }

      for (const sourceFileName in source.files) {
        const sourceFile = source.files[sourceFileName];

        let process = true;

        if (exclude !== undefined && StorageUtilities.matchesList(sourceFileName, exclude)) {
          process = false;
        }

        if (include !== undefined && !StorageUtilities.matchesList(sourceFileName, include)) {
          process = false;
        }

        if (sourceFile !== undefined) {
          if (process) {
            targetFiles[sourceFileName] = false;

            const targetFile = target.ensureFile(sourceFile.name);

            let updateFile = true;
            if (dontOverwriteExistingFiles) {
              if (await targetFile.exists()) {
                updateFile = false;
                if (messageUpdater) {
                  messageUpdater("Not updating '" + targetFile.fullPath + "' as it already exists.");
                }
              }
            }

            if (updateFile) {
              const wasUpdated = await this.syncFileTo(sourceFile, targetFile, forceFileUpdates, messageUpdater);

              if (wasUpdated) {
                modifiedFileCount++;
              }
            }
          }
        }
      }
    }

    for (const sourceFolderName in source.folders) {
      if (!StorageUtilities.isIgnorableFolder(sourceFolderName)) {
        const sourceChildFolder = source.folders[sourceFolderName];
        let process = true;

        if (exclude !== undefined && StorageUtilities.matchesList("/" + sourceFolderName, exclude)) {
          process = false;
        }

        if (sourceChildFolder !== undefined) {
          if (process) {
            targetFolders[sourceFolderName] = false;

            const targetChildFolder = target.ensureFolder(sourceChildFolder.name);

            await targetChildFolder.ensureExists();

            const subfolderFilesUpdated = await this.syncFolderTo(
              sourceChildFolder,
              targetChildFolder,
              forceFolders,
              forceFileUpdates,
              removeOnTarget,
              exclude,
              include,
              messageUpdater,
              dontOverwriteExistingFiles
            );

            modifiedFileCount += subfolderFilesUpdated;
          }
        }
      }
    }

    if (removeOnTarget) {
      for (const targetFileName in targetFiles) {
        let process = true;

        /*
        If a file matches the exclude list, ignore it, don't remove it. But commenting this out so that excluded files get removed on target.
        if (exclude !== undefined && StorageUtilities.matchesList(targetFileName, exclude)) {
          process = false;
        }*/

        if (process && targetFiles[targetFileName] === true) {
          if (messageUpdater) {
            await messageUpdater("Removing file '" + target.fullPath + "' (" + targetFileName + ")");
          }

          await target.deleteFile(targetFileName);
          modifiedFileCount++;
        }
      }
    }

    return modifiedFileCount;
  }

  public static matchesList(name: string, list: string[]) {
    name = StorageUtilities.canonicalizeName(name);
    let nameMinusSlash = name;

    if (nameMinusSlash.startsWith("/")) {
      nameMinusSlash = nameMinusSlash.substring(1, nameMinusSlash.length);
    }

    for (let i = 0; i < list.length; i++) {
      const listC = StorageUtilities.canonicalizeName(list[i]);

      if (name === listC) {
        return true;
      }

      if (!listC.startsWith("/")) {
        if (nameMinusSlash === listC) {
          return true;
        }
      }

      if (listC.length > 2 && listC.startsWith("*") && listC.endsWith("*")) {
        if (name.indexOf(listC.substring(1, listC.length - 1)) >= 0) {
          return true;
        }
      } else if (listC.length > 2 && listC.startsWith("*") && !listC.endsWith("*")) {
        if (name.endsWith(listC.substring(1))) {
          return true;
        }
      } else if (listC.length > 2 && !listC.startsWith("*") && listC.endsWith("*")) {
        if (name.startsWith(listC.substring(0, listC.length - 1))) {
          return true;
        }
      }
    }

    return false;
  }

  public static sanitizePathBasic(path: string) {
    path = path.replace(/</gi, "_");
    path = path.replace(/>/gi, "_");
    path = path.replace(/ /gi, "_");
    path = path.replace(/"/gi, "_");
    path = path.replace(/'/gi, "_");
    path = path.replace(/::/gi, "_");
    path = path.replace(/,/gi, "_");
    path = path.replace(/:/gi, "_");
    path = path.replace(/\r/gi, "_");
    path = path.replace(/\n/gi, "_");
    path = path.replace(/__/gi, "_");
    path = path.replace(/__/gi, "_");

    while (path.length > 1 && path.startsWith("_")) {
      path = path.substring(1, path.length);
    }

    while (path.length > 1 && path.endsWith("_")) {
      path = path.substring(0, path.length - 1);
    }

    path = path.trim();

    return path;
  }

  public static sanitizePath(path: string) {
    if (Utilities.isAlphaNumeric(path)) {
      return path;
    }

    let utf8Encode = new TextEncoder();

    const base64 = Utilities.arrayBufferToBase64((utf8Encode as any).encode(path))
      .replace(/\//gi, " ")
      .replace(/=/gi, "_");

    return base64;
  }

  public static async syncFileTo(
    source: IFile,
    target: IFile,
    force: boolean,
    messageUpdater?: (message: string) => Promise<void>
  ) {
    // Log.debug("Syncing file content '" + source.fullPath + "'");

    await source.loadContent(true);

    if (source.content == null) {
      Log.debug("No content for file " + source.storageRelativePath);
      return;
    }

    if (!force) {
      if (await target.exists()) {
        await target.loadContent(false);

        if (StorageUtilities.contentsAreEqual(source.content, target.content)) {
          return;
        }
      }
    }

    if (messageUpdater) {
      let targetPath = target.fullPath;

      targetPath = targetPath.replace("fs.mctprojects/root/", "");

      let mess = "Updating file: " + targetPath;

      if (source.content) {
        mess += " (size: " + source.content.length + ")";
      }

      await messageUpdater(mess);
    }

    // Log.debug("Copying file " + source.storageRelativePath + " to " + target.storageRelativePath);

    target.setContent(source.content);
    return true;
  }
}
