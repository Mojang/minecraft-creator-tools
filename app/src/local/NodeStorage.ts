// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NodeFolder from "./NodeFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import * as path from "path";

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
