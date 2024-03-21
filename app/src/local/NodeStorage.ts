// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NodeFolder from "./NodeFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";

export default class NodeStorage extends StorageBase implements IStorage {
  path: string;
  name: string;

  rootFolder: NodeFolder;

  static folderDelimiter = "\\";

  static determineDelimiter(path: string) {
    if (path.indexOf("\\") >= 0) {
      NodeStorage.folderDelimiter = "\\";
    } else {
      NodeStorage.folderDelimiter = "/";
    }
  }

  constructor(path: string, name: string) {
    super();

    if (NodeStorage.folderDelimiter === "\\") {
      path = path.replace(/\//gi, NodeStorage.folderDelimiter);
      path = path.replace(/\\\\/gi, "\\");
    } else if (NodeStorage.folderDelimiter === "/") {
      path = path.replace(/\\/gi, NodeStorage.folderDelimiter);
      path = path.replace(/\/\//gi, NodeStorage.folderDelimiter);
    }

    this.path = path;
    this.name = name;

    this.rootFolder = new NodeFolder(this, null, path, name);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(NodeStorage.folderDelimiter)) {
      fullPath += NodeStorage.folderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    const lastDelim = path.lastIndexOf(this.folderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }

  public static ensureEndsWithDelimiter(path: string) {
    if (!path.endsWith(NodeStorage.folderDelimiter)) {
      path = path + NodeStorage.folderDelimiter;
    }

    return path;
  }

  public static ensureStartsWithDelimiter(path: string) {
    if (!path.startsWith(NodeStorage.folderDelimiter)) {
      path = NodeStorage.folderDelimiter + path;
    }

    return path;
  }
}
