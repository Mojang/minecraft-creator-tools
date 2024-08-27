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

// part of security/reliability and defense in depth is to only allow our file functions to work with files from an allow list
// this list is also replicated in /public/preload.js
const _allowedExtensions = [
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
  "nojekyll",
  "env",
  "wav",
  "tga",
  "",
  "zip",
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
];

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

  public static isUsableFile(path: string) {
    const extension = StorageUtilities.getTypeFromName(path);

    return _allowedExtensions.includes(extension);
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
      case "wav":
      case "gif":
      case "jpeg":
      case "jpg":
      case "png":
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

  public static async getFileStorageFolder(file: IFile) {
    let zipStorage = file.fileContainerStorage as ZipStorage;

    if (!zipStorage) {
      await file.loadContent();

      if (!file.content || !(file.content instanceof Uint8Array)) {
        return undefined;
      }

      zipStorage = new ZipStorage();

      await zipStorage.loadFromUint8Array(file.content, file.name);

      file.fileContainerStorage = zipStorage;
      file.fileContainerStorage.storagePath = file.storageRelativePath + "#";
    }

    return zipStorage.rootFolder;
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

    return name;
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

  public static async getDifferences(original: IFolder, updated: IFolder, includeDeletions: boolean) {
    const data = new DifferenceSet();

    await this.addDifferences(data, original, updated, includeDeletions);

    return data;
  }

  public static shouldProcessFile(fileName: string) {
    fileName = fileName.toLowerCase();

    const ext = StorageUtilities.getTypeFromName(fileName);

    if (ext !== "ts" && ext !== "js" && ext !== "json") {
      return false;
    }

    if (
      fileName.startsWith(".") ||
      fileName.startsWith("just.config") ||
      fileName.endsWith(".config.ts") ||
      fileName.endsWith(".config.js") ||
      (fileName.startsWith("manifest") && fileName.endsWith("json")) ||
      (fileName.startsWith("package") && fileName.endsWith("json"))
    ) {
      return false;
    }

    return true;
  }

  public static shouldProcessFolder(folderName: string) {
    if (
      folderName.startsWith(".") ||
      folderName === "lib" ||
      folderName === "node_modules" ||
      folderName === "dist" ||
      folderName === "build"
    ) {
      return false;
    }

    return true;
  }

  public static async addDifferences(
    differences: DifferenceSet,
    original: IFolder,
    updated: IFolder,
    includeDeletions: boolean
  ): Promise<FolderDifferenceType> {
    await original.load(false);

    await updated.load(false);

    let result: FolderDifferenceType = FolderDifferenceType.none;

    // get a list of existing files and folders in the target
    const updatedFilesToConsider: { [id: string]: boolean } = {};
    const updatedFoldersToConsider: { [id: string]: boolean } = {};

    for (const updatedFileName in updated.files) {
      if (StorageUtilities.shouldProcessFile(updatedFileName)) {
        updatedFilesToConsider[updatedFileName] = true;
      }
    }

    for (const updatedFolderName in updated.folders) {
      if (StorageUtilities.shouldProcessFolder(updatedFolderName)) {
        updatedFoldersToConsider[updatedFolderName] = true;
      }
    }

    for (const originalFileName in original.files) {
      if (StorageUtilities.shouldProcessFile(originalFileName)) {
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
      if (StorageUtilities.shouldProcessFolder(originalFolderName)) {
        const originalChildFolder = original.folders[originalFolderName];

        if (originalChildFolder !== undefined) {
          updatedFoldersToConsider[originalFolderName] = false;

          if (updated.folderExists(originalFolderName)) {
            const updatedChildFolder = updated.folders[originalFolderName];

            if (updatedChildFolder !== undefined) {
              const childResult = await StorageUtilities.addDifferences(
                differences,
                originalChildFolder,
                updatedChildFolder,
                includeDeletions
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

  public static getJsonObject(file: IFile): any | undefined {
    if (!file.content) {
      return undefined;
    }

    if (!(typeof file.content === "string")) {
      return undefined;
    }

    let jsonObject = undefined;

    let contents = file.content;

    contents = Utilities.fixJsonContent(contents);

    try {
      jsonObject = JSON.parse(contents);
    } catch (e: any) {
      Log.fail("Could not parse JSON from '" + file.fullPath + "': " + e.message);
    }

    return jsonObject;
  }

  public static isIgnorableFolder(folderName: string) {
    return folderName.startsWith(".") && !folderName.toLowerCase().startsWith(".vscode");
  }

  public static async syncFolderTo(
    source: IFolder,
    target: IFolder,
    forceFolders: boolean,
    forceFileUpdates: boolean,
    removeOnTarget: boolean,
    exclude?: string[],
    include?: string[],
    messageUpdater?: (message: string) => Promise<void>
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

          const wasUpdated = await this.syncFileTo(sourceFile, targetFile, forceFileUpdates, messageUpdater);

          if (wasUpdated) {
            modifiedFileCount++;
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
              messageUpdater
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

  public static sanitizePath(path: string) {
    if (Utilities.isAlphaNumeric(path)) {
      return path;
    }

    let utf8Encode = new TextEncoder();

    const base64 = Utilities.arrayBufferToBase64(utf8Encode.encode(path)).replace(/\//gi, " ").replace(/=/gi, "_");

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
