// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BrowserFolder from "./BrowserFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";
import localforage from "localforage";

export default class BrowserStorage extends StorageBase implements IStorage {
  rootFolder: BrowserFolder;
  static isConfigured: boolean = false;

  static readonly folderDelimiter = "/";

  constructor(name: string | null) {
    super();

    if (name == null) {
      name = "";
    } else {
      name = "." + name;
    }

    if (!BrowserStorage.isConfigured) {
      localforage.config({
        name: "Minecraft Creator Tools",
        storeName: "minecraft_creator_tools",
        version: 1.0,
      });

      BrowserStorage.isConfigured = true;
    }

    this.rootFolder = new BrowserFolder(this, null, "fs" + name, "root");
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(BrowserStorage.folderDelimiter)) {
      fullPath += BrowserStorage.folderDelimiter;
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
}
