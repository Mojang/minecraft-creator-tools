// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileSystemFolder from "./FileSystemFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";

export default class FileSystemStorage extends StorageBase implements IStorage {
  rootFolder: FileSystemFolder;

  static readonly folderDelimiter = "/";

  constructor(handle: FileSystemDirectoryHandle) {
    super();

    this.rootFolder = new FileSystemFolder(this, null, "", "root", handle);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(FileSystemStorage.folderDelimiter)) {
      fullPath += FileSystemStorage.folderDelimiter;
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
