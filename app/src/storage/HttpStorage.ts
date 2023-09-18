import HttpFolder from "./HttpFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";

export default class HttpStorage extends StorageBase implements IStorage {
  rootFolder: HttpFolder;

  baseUrl: string;

  static readonly folderDelimiter = "/";

  constructor(newUrl: string) {
    super();

    this.baseUrl = newUrl;

    if (!this.baseUrl.endsWith(HttpStorage.folderDelimiter)) {
      this.baseUrl += HttpStorage.folderDelimiter;
    }

    this.rootFolder = new HttpFolder(this, null, "");
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(HttpStorage.folderDelimiter)) {
      fullPath += HttpStorage.folderDelimiter;
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
