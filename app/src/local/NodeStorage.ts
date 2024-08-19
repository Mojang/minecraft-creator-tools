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

  static folderDelimiter = path.sep;

  constructor(incomingPath: string, name: string) {
    super();

    if (NodeStorage.folderDelimiter === "\\") {
      incomingPath = incomingPath.replace(/\//gi, NodeStorage.folderDelimiter);
      incomingPath = incomingPath.replace(/\\\\/gi, "\\");
    } else if (NodeStorage.folderDelimiter === "/") {
      incomingPath = incomingPath.replace(/\\/gi, NodeStorage.folderDelimiter);
      incomingPath = incomingPath.replace(/\/\//gi, NodeStorage.folderDelimiter);
    }

    this.rootPath = incomingPath;
    this.name = name;

    this.rootFolder = new NodeFolder(this, null, incomingPath, name);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(NodeStorage.folderDelimiter)) {
      fullPath += NodeStorage.folderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(parentPath: string) {
    const lastDelim = parentPath.lastIndexOf(this.folderDelimiter);

    if (lastDelim < 0) {
      return parentPath;
    }

    return parentPath.substring(0, lastDelim);
  }

  public static ensureEndsWithDelimiter(pth: string) {
    if (!pth.endsWith(NodeStorage.folderDelimiter)) {
      pth = pth + NodeStorage.folderDelimiter;
    }

    return pth;
  }

  public static ensureStartsWithDelimiter(pth: string) {
    if (!pth.startsWith(NodeStorage.folderDelimiter)) {
      pth = NodeStorage.folderDelimiter + pth;
    }

    return pth;
  }
}
