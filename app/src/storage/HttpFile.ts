// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileBase from "./FileBase";
import HttpFolder from "./HttpFolder";
import IFile from "./IFile";
import StorageUtilities, { EncodingType } from "./StorageUtilities";
import axios from "axios";
import Log from "../core/Log";

export default class HttpFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: HttpFolder;

  private _pendingLoadRequests: ((value: unknown) => void)[] = [];
  private _isLoading = false;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return this.lastLoadedOrSaved !== null;
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

    return this._content !== null;
  }

  async scanForChanges(): Promise<void> {
    await this.loadContent(true);
  }

  async loadContent(force?: boolean): Promise<Date> {
    //        Log.assert(this.fullPath.startsWith("/"), "Expecting a full absolute path");

    if (force || this.lastLoadedOrSaved === null) {
      if (this._isLoading) {
        const pendingLoad = this._pendingLoadRequests;

        const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
          pendingLoad.push(resolve);
        };

        await new Promise(prom);

        if (this.lastLoadedOrSaved === null) {
          throw new Error();
        }

        return this.lastLoadedOrSaved;
      } else {
        this._content = null;

        const path = this.fullPath;

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
                result = JSON.stringify(result, null, 2);
              } catch (e) {
                Log.fail("Could not convert file to JSON");
              }
            }

            if (response.status !== 200) {
              Log.verbose("Could not retrieve file from '" + path + "' - response code is " + response.status);
            }

            if (result === null || result === "null") {
              Log.verbose("Could not retrieve file from '" + path + "' - result is null.");
            }
          } catch (e) {
            Log.verbose("Could not retrieve file from '" + path + "' - " + e + " - " + (e as any)?.stack);
          }

          this._content = result;
        }

        this.lastLoadedOrSaved = new Date();

        this._isLoading = false;

        const pendingLoad = this._pendingLoadRequests;
        this._pendingLoadRequests = [];

        for (const prom of pendingLoad) {
          prom(undefined);
        }
      }
    }

    return this.lastLoadedOrSaved;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("HttpFile is read-only.");
  }

  setContent(newContent: string | Uint8Array | null): boolean {
    throw new Error("HttpFile is read-only.");
  }

  async saveContent(): Promise<Date> {
    throw new Error("HttpFile is read-only.");
  }
}
