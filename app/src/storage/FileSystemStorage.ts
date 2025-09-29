// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileSystemFolder from "./FileSystemFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";

export default class FileSystemStorage extends StorageBase implements IStorage {
  rootFolder: FileSystemFolder;

  static readonly fileSystemFolderDelimiter = "/";

  get folderDelimiter() {
    return FileSystemStorage.fileSystemFolderDelimiter;
  }

  constructor(handle: FileSystemDirectoryHandle, name?: string) {
    super();

    this.rootFolder = new FileSystemFolder(this, null, "", name ? name : "root", handle);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(FileSystemStorage.fileSystemFolderDelimiter)) {
      fullPath += FileSystemStorage.fileSystemFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    const lastDelim = path.lastIndexOf(this.fileSystemFolderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
