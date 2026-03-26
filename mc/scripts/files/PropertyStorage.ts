import PropertyFolder from "./PropertyFolder";
import StorageBase from "./../app/storage/StorageBase";
import IStorage from "./../app/storage/IStorage";
import FileStorageManager from "./FileStorageManager";

export default class PropertyStorage extends StorageBase implements IStorage {
  rootFolder: PropertyFolder;

  baseName: string;

  static readonly folderDelimiter = "/";

  async getAvailable(): Promise<boolean> {
    return true;
  }

  constructor(fsm: FileStorageManager, newBaseName: string) {
    super();

    this.baseName = newBaseName;

    if (!this.baseName.endsWith(PropertyStorage.folderDelimiter)) {
      this.baseName += PropertyStorage.folderDelimiter;
    }

    this.rootFolder = new PropertyFolder(this, null, "");
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(PropertyStorage.folderDelimiter)) {
      fullPath += PropertyStorage.folderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    let lastDelim = path.lastIndexOf(this.folderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }
}
