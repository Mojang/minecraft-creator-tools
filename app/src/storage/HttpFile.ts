import FileBase from "./FileBase";
import HttpFolder from "./HttpFolder";
import IFile from "./IFile";
import StorageUtilities, { EncodingType } from "./StorageUtilities";
import axios from "axios";
import Log from "../core/Log";

export default class HttpFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: HttpFolder;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return true;
  }

  get parentFolder(): HttpFolder {
    return this._parentFolder;
  }

  get fullPath() {
    return this._parentFolder.fullPath + this.name;
  }

  constructor(parentFolder: HttpFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async exists() {
    await this.loadContent(false);

    return this._content === null;
  }

  async loadContent(force?: boolean): Promise<Date> {
    //        Log.assert(this.fullPath.startsWith("/"), "Expecting a full absolute path");

    if (force || !this.lastLoadedOrSaved) {
      this.lastLoadedOrSaved = new Date();

      this._content = null;

      const path = this.fullPath;

      /*      if (this.fullPath.startsWith("/")) {
        path = this.fullPath.substring(1, this.fullPath.length);
      }*/

      if (StorageUtilities.getEncodingByFileName(this.name) === EncodingType.ByteBuffer) {
        try {
          const response = await axios.get(path, {
            responseType: "arraybuffer",
            headers: {},
          });

          this._content = new Uint8Array(response.data);
        } catch (e) {}
      } else {
        let result = null;

        try {
          const response = await axios.get(path, {
            headers: {},
          });

          result = response.data;

          if (typeof result === "object") {
            try {
              result = JSON.stringify(result);
            } catch (e) {
              Log.fail("Could not convert file to JSON");
            }
          }

          if (response.status !== 200) {
            Log.fail("Could retrieve file from '" + path + "' - response code is " + response.status);
            Log.verbose("Could retrieve file from '" + path + "' - response code is " + response.status);
          }

          if (result === null || result === "null") {
            Log.fail("Could retrieve file from '" + path + "' - result is null.");
            Log.verbose("Could retrieve file from '" + path + "' - result is null.");
          }
        } catch (e) {
          Log.fail("Could retrieve file from '" + path + "' - " + e);
        }

        this._content = result;
      }
    }

    return this.lastLoadedOrSaved;
  }

  async deleteFile(): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  setContent(newContent: string | Uint8Array | null) {
    throw new Error("HttpFile is read-only.");
  }

  async saveContent(): Promise<Date> {
    throw new Error("HttpFile is read-only.");
  }
}
