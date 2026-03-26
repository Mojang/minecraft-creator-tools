import ElectronFolder from "./ElectronFolder";
import StorageBase from "./../storage/StorageBase";
import IStorage from "./../storage/IStorage";
import Log from "../core/Log";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import StorageUtilities from "../storage/StorageUtilities";

export default class ElectronStorage extends StorageBase implements IStorage {
  path: string;
  name: string;

  rootFolder: ElectronFolder;

  static folderDelimiter = "/";

  static electronStorages: { [path: string]: ElectronStorage } = {};

  constructor(path: string, name: string) {
    super();

    this.path = path;

    Log.assert(this.path.length > 4 && this.path.startsWith("<"), "Path is not expected:" + path);

    ElectronStorage.electronStorages[this.path] = this;
    this.name = name;

    this.rootFolder = new ElectronFolder(this, null, path, name);
  }

  public static async processLocalFileUpdate(path: string) {
    for (const esPath in ElectronStorage.electronStorages) {
      if (StorageUtilities.canonicalizePath(path).startsWith(StorageUtilities.canonicalizePath(esPath))) {
        const es = ElectronStorage.electronStorages[esPath];

        if (es) {
          await es.notifyPathWasUpdatedExternal(path);
        }
      }
    }
  }

  /**
   * Called when a new file is detected by the Electron file watcher.
   * Routes to the appropriate ElectronStorage instance.
   */
  public static async processLocalFileAdded(path: string) {
    for (const esPath in ElectronStorage.electronStorages) {
      if (StorageUtilities.canonicalizePath(path).startsWith(StorageUtilities.canonicalizePath(esPath))) {
        const es = ElectronStorage.electronStorages[esPath];

        if (es) {
          await es.notifyPathWasAddedExternal(path);
        }
      }
    }
  }

  /**
   * Called when a file is removed by the Electron file watcher.
   * Routes to the appropriate ElectronStorage instance.
   */
  public static async processLocalFileRemoved(path: string) {
    for (const esPath in ElectronStorage.electronStorages) {
      if (StorageUtilities.canonicalizePath(path).startsWith(StorageUtilities.canonicalizePath(esPath))) {
        const es = ElectronStorage.electronStorages[esPath];

        if (es) {
          await es.notifyPathWasRemovedExternal(path);
        }
      }
    }
  }

  async getAvailable(): Promise<boolean> {
    if (this.available === undefined) {
      const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.fsRootStorageExists, this.path);
      this.available = result === "true";
    }

    return this.available;
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(ElectronStorage.folderDelimiter)) {
      fullPath += ElectronStorage.folderDelimiter;
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
