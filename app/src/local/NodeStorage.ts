// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NodeFolder from "./NodeFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import * as path from "path";
import NodeFile from "./NodeFile";
import ZipStorage from "../storage/ZipStorage";
import IFolder from "../storage/IFolder";

export default class NodeStorage extends StorageBase implements IStorage {
  rootPath: string;
  name: string;

  rootFolder: NodeFolder;

  static platformFolderDelimiter = path.sep;

  get folderDelimiter() {
    return path.sep;
  }

  constructor(incomingPath: string, name: string) {
    super();

    if (NodeStorage.platformFolderDelimiter === "\\") {
      incomingPath = incomingPath.replace(/\//gi, NodeStorage.platformFolderDelimiter);
      incomingPath = incomingPath.replace(/\\\\/gi, "\\");
    } else if (NodeStorage.platformFolderDelimiter === "/") {
      incomingPath = incomingPath.replace(/\\/gi, NodeStorage.platformFolderDelimiter);
      incomingPath = incomingPath.replace(/\/\//gi, NodeStorage.platformFolderDelimiter);
    }

    this.rootPath = incomingPath;
    this.name = name;

    this.rootFolder = new NodeFolder(this, null, incomingPath, name);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(NodeStorage.platformFolderDelimiter)) {
      fullPath += NodeStorage.platformFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static async createFromPath(path: string): Promise<NodeFile | NodeFolder> {
    const lastDot = path.lastIndexOf(".");
    let lastSlash = path.lastIndexOf("/");
    let lastBackslash = path.lastIndexOf("\\");

    if (lastBackslash > lastSlash) {
      lastSlash = lastBackslash;
    }

    if (lastDot > lastSlash) {
      const ns = new NodeStorage(path.substring(0, lastSlash), "");

      return (await ns.rootFolder.ensureFileFromRelativePath(path.substring(lastSlash))) as NodeFile;
    } else {
      const ns = new NodeStorage(path, "");

      return ns.rootFolder;
    }
  }

  static async createFromPathIncludingZip(path: string): Promise<IFolder | undefined> {
    const content = await NodeStorage.createFromPath(path);

    if (
      content instanceof NodeFile &&
      (path.endsWith(".mcpack") ||
        path.endsWith(".mcaddon") ||
        path.endsWith(".mcworld") ||
        path.endsWith(".zip") ||
        path.endsWith(".mcproject"))
    ) {
      const zs = await ZipStorage.loadFromFile(content);

      return zs?.rootFolder;
    }

    if (content instanceof NodeFolder) {
      return content;
    }

    return undefined;
  }

  static getParentFolderPath(parentPath: string) {
    const lastDelim = parentPath.lastIndexOf(this.platformFolderDelimiter);

    if (lastDelim < 0) {
      return parentPath;
    }

    return parentPath.substring(0, lastDelim);
  }

  public static ensureEndsWithDelimiter(pth: string) {
    if (!pth.endsWith(NodeStorage.platformFolderDelimiter)) {
      pth = pth + NodeStorage.platformFolderDelimiter;
    }

    return pth;
  }

  public static ensureStartsWithDelimiter(pth: string) {
    if (!pth.startsWith(NodeStorage.platformFolderDelimiter)) {
      pth = NodeStorage.platformFolderDelimiter + pth;
    }

    return pth;
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
