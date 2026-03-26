import StorageBase from "../app/storage/StorageBase";
import IStorage from "../app/storage/IStorage";
import StorageUtilities from "../app/storage/StorageUtilities";
import PackFolder from "./PackFolder";
import PackFile from "./PackFile";

export default class PackStorage extends StorageBase implements IStorage {
  rootFolder: PackFolder;

  static current = new PackStorage();
  static readonly folderDelimiter = "/";

  constructor() {
    super();

    this.rootFolder = new PackFolder(this, null, "");
  }

  async getAvailable(): Promise<boolean> {
    return true;
  }

  ensureFolder(folderPath: string) {
    return this.rootFolder.ensureFolder(folderPath);
  }

  ensure(filePath: string, content: object) {
    const folderPath = StorageUtilities.getFolderPath(filePath);
    const fileName = StorageUtilities.getLeafName(filePath);

    const folder = folderPath === "/" ? this.rootFolder : this.rootFolder.ensureFolder(folderPath);

    const file = folder.ensureFile(fileName);

    (file as PackFile).setJsonObject(content);

    return file;
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(PackStorage.folderDelimiter)) {
      fullPath += PackStorage.folderDelimiter;
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
