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

  /**
   * Number of fetch attempts for `loadContent`. A transient network blip or
   * intermittent 5xx from the content origin used to be swallowed silently
   * (see `} catch (e) {}` in the binary branch below), leaving `_content`
   * null while `lastLoadedOrSaved` was still set. Callers like
   * `StorageUtilities.syncFileTo` then bail with no copy, and downstream
   * `FileSystemFile.saveContent` skips writing because content is null —
   * producing a project save that is missing a different random subset of
   * files on each run. Retrying transient failures here is the cheapest fix.
   */
  private static readonly MAX_LOAD_ATTEMPTS = 3;

  private static isRetryableLoadError(e: unknown): boolean {
    const err = e as { response?: { status?: number }; code?: string };
    const status = err?.response?.status;
    // No HTTP response (network / DNS / abort) — retry.
    if (status === undefined) {
      return true;
    }
    // Retry on 5xx, 408 (Request Timeout), and 429 (Too Many Requests).
    return status >= 500 || status === 408 || status === 429;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        // Mark in-flight BEFORE the await so concurrent callers wait via
        // `_pendingLoadRequests` instead of issuing duplicate HTTP requests
        // for the same file. Without this, the dedupe branch above was
        // unreachable in practice.
        this._isLoading = true;
        this._content = null;

        const path = this.fullPath;
        const isBinary = StorageUtilities.getEncodingByFileName(this.name) === EncodingType.ByteBuffer;

        const headers: Record<string, string> = {};
        if (this._parentFolder.storage.authToken) {
          headers["Authorization"] = `Bearer mctauth=${this._parentFolder.storage.authToken}`;
        }

        let lastError: unknown = undefined;

        for (let attempt = 1; attempt <= HttpFile.MAX_LOAD_ATTEMPTS; attempt++) {
          try {
            if (isBinary) {
              const response = await axios.get(path, {
                responseType: "arraybuffer",
                headers,
              });

              this._content = new Uint8Array(response.data);
            } else {
              const response = await axios.get(path, {
                headers,
              });

              let result = response.data;

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
                result = null;
              }

              this._content = result;
            }

            lastError = undefined;
            break;
          } catch (e) {
            lastError = e;

            if (attempt < HttpFile.MAX_LOAD_ATTEMPTS && HttpFile.isRetryableLoadError(e)) {
              // Exponential backoff: 100ms, 200ms, 400ms ...
              const backoffMs = 100 * Math.pow(2, attempt - 1);
              Log.verbose(
                "Transient failure loading '" +
                  path +
                  "' (attempt " +
                  attempt +
                  "/" +
                  HttpFile.MAX_LOAD_ATTEMPTS +
                  "). Retrying in " +
                  backoffMs +
                  "ms. " +
                  e
              );
              await HttpFile.delay(backoffMs);
              continue;
            }

            // Non-retryable or out of attempts. Stop retrying.
            break;
          }
        }

        if (lastError !== undefined) {
          // Surface the failure clearly so callers (and developers reading
          // logs) can see why a project save came up short. The original
          // code silently swallowed this for binary files.
          Log.error(
            "Failed to retrieve file from '" +
              path +
              "' after " +
              HttpFile.MAX_LOAD_ATTEMPTS +
              " attempt(s): " +
              lastError
          );
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
    if (this._parentFolder.storage.readOnly) {
      throw new Error("HttpFile is read-only.");
    }

    try {
      const path = this.fullPath;
      const headers: Record<string, string> = {};
      if (this._parentFolder.storage.authToken) {
        headers["Authorization"] = `Bearer mctauth=${this._parentFolder.storage.authToken}`;
      }

      await axios.delete(path, { headers });

      if (!skipRemoveFromParent) {
        this._parentFolder.removeFile(this.name);
      }

      return true;
    } catch (e) {
      Log.debug("Failed to delete file: " + e);
      return false;
    }
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("HttpFile does not support move operations.");
  }

  setContent(newContent: string | Uint8Array | null): boolean {
    if (this._parentFolder.storage.readOnly) {
      throw new Error("HttpFile is read-only.");
    }

    this._content = newContent;
    this.modified = new Date();
    return true;
  }

  async saveContent(): Promise<Date> {
    if (this._parentFolder.storage.readOnly) {
      throw new Error("HttpFile is read-only.");
    }

    if (this._content === null) {
      throw new Error("Cannot save file with null content");
    }

    try {
      const path = this.fullPath;
      const headers: Record<string, string> = {};
      if (this._parentFolder.storage.authToken) {
        headers["Authorization"] = `Bearer mctauth=${this._parentFolder.storage.authToken}`;
      }

      // Determine content type based on file type
      const encoding = StorageUtilities.getEncodingByFileName(this.name);
      if (encoding === EncodingType.ByteBuffer) {
        headers["Content-Type"] = "application/octet-stream";
      } else {
        headers["Content-Type"] = "text/plain; charset=utf-8";
      }

      await axios.put(path, this._content, { headers });

      this.lastLoadedOrSaved = new Date();
      this.modified = null;

      return this.lastLoadedOrSaved;
    } catch (e) {
      Log.debug("Failed to save file: " + e);
      throw new Error("Failed to save file: " + e);
    }
  }
}
