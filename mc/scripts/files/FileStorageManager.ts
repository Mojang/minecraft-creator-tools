import { world } from "@minecraft/server";
import PropertyStorage from "./PropertyStorage";
import Log from "../app/core/Log";

const FOLDER_DETAIL_BUCKET_COUNT = 50;
const FILE_DETAIL_BUCKET_COUNT = 50;

export default class FileStorageManager {
  private _storages: { [name: string]: PropertyStorage } = {};
  private _folderVals: { [index: number]: { [path: string]: object | undefined } | undefined } = {};
  private _fileVals: { [index: number]: { [path: string]: string | undefined } | undefined } = {};

  private static _current: FileStorageManager = new FileStorageManager();

  private static init() {}

  constructor() {}

  ensureStorage(storageName: string) {
    let storage = this._storages[storageName];

    if (storage === undefined) {
      storage = new PropertyStorage(this, storageName);

      this._storages[storageName] = storage;
    }

    return storage;
  }

  getStorage(storageName: string) {
    return this._storages[storageName];
  }

  setFolderContentForPath(path: string, content: object): void {
    let newVal = undefined;
    let bucketIndex = this.getNumericSummary(path) % FOLDER_DETAIL_BUCKET_COUNT;

    try {
      newVal = JSON.stringify(content);
    } catch (e) {
      Log.debugAlert("Unexpected error serializing properties: " + e);
    }

    let bucket = this.ensureFolderBucket(bucketIndex);

    if (bucket === undefined) {
      return undefined;
    }

    bucket[path] = content;

    world.setDynamicProperty("fs:f" + bucketIndex, JSON.stringify(bucket));
  }

  getFolderContentForPath(path: string): object | undefined {
    let bucketIndex = this.getNumericSummary(path) % FOLDER_DETAIL_BUCKET_COUNT;

    let bucket = this.ensureFolderBucket(bucketIndex);

    if (bucket === undefined) {
      return undefined;
    }

    let val = bucket[path];

    return val;
  }

  ensureFolderBucket(bucketIndex: number) {
    if (this._folderVals[bucketIndex] === undefined) {
      let strProp = world.getDynamicProperty("fs:f" + bucketIndex) as string;

      if (strProp) {
        let storedProperties = undefined;

        try {
          storedProperties = JSON.parse(strProp);
        } catch (e) {
          Log.debugAlert("Unexpected error parsing property buckets: " + e);
        }

        this._folderVals[bucketIndex] = storedProperties;
      }

      if (this._folderVals[bucketIndex] === undefined) {
        this._folderVals[bucketIndex] = {};
      }
    }

    return this._folderVals[bucketIndex];
  }

  setFileContentForPath(path: string, content: string | undefined): void {
    let bucketIndex = this.getNumericSummary(path) % FILE_DETAIL_BUCKET_COUNT;

    let bucket = this.ensureFileBucket(bucketIndex);

    if (bucket === undefined) {
      return undefined;
    }

    bucket[path] = content;

    world.setDynamicProperty("fs:i" + bucketIndex, JSON.stringify(bucket));
  }

  getFileContentForPath(path: string): string | undefined {
    let bucketIndex = this.getNumericSummary(path) % FILE_DETAIL_BUCKET_COUNT;

    let strVal = undefined;

    let bucket = this.ensureFileBucket(bucketIndex);

    if (bucket === undefined) {
      return undefined;
    }

    let val = bucket[path];

    return val;
  }

  ensureFileBucket(bucketIndex: number) {
    if (this._fileVals[bucketIndex] === undefined) {
      let strProp = world.getDynamicProperty("fs:i" + bucketIndex) as string;

      if (strProp) {
        let storedProperties = undefined;

        try {
          storedProperties = JSON.parse(strProp);
        } catch (e) {
          Log.debugAlert("Unexpected error parsing property buckets: " + e);
        }

        this._fileVals[bucketIndex] = storedProperties;
      }

      if (this._fileVals[bucketIndex] === undefined) {
        this._fileVals[bucketIndex] = {};
      }
    }

    return this._fileVals[bucketIndex];
  }

  getNumericSummary(path: string) {
    let index = 0;

    for (let i = 0; i < path.length; i++) {
      index += path.charCodeAt(i);
    }

    return index;
  }
}
