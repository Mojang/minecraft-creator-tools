// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Folder from "./Folder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";

export default class Storage extends StorageBase implements IStorage {
  rootFolder: Folder;

  static readonly folderDelimiter = "/";

  constructor() {
    super();

    this.rootFolder = new Folder(this, null, "", "root");
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(Storage.folderDelimiter)) {
      fullPath += Storage.folderDelimiter;
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
