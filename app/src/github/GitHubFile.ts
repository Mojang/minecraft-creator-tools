// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import FileBase from "../storage/FileBase";
import GitHubFolder from "./GitHubFolder";
import IFile, { FileUpdateType } from "../storage/IFile";
import Utilities from "../core/Utilities";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import GitHubStorage from "./GitHubStorage";
import CreatorToolsHost from "../app/CreatorToolsHost";
import axios from "axios";
import Log from "../core/Log";

// import { Endpoints } from '@octokit/types';
// type getContentReposResponse = Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"];

export default class GitHubFile extends FileBase implements IFile {
  private _name: string;
  private _parentFolder: GitHubFolder;

  public sha: string | undefined;

  get name() {
    return this._name;
  }

  get isContentLoaded() {
    return this.lastLoadedOrSaved !== null;
  }

  get parentFolder(): GitHubFolder {
    return this._parentFolder;
  }

  get fullPath() {
    let path = this._parentFolder.fullPath;

    if (!path.endsWith(GitHubStorage.slashFolderDelimiter)) {
      path += GitHubStorage.slashFolderDelimiter;
    }

    path += this._name;

    return path;
  }

  constructor(parentFolder: GitHubFolder, folderName: string) {
    super();

    this._parentFolder = parentFolder;
    this._name = folderName;
  }

  async deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async scanForChanges(): Promise<void> {
    // No-op for GitHub storage
  }

  async loadContent(force?: boolean): Promise<Date> {
    if (force || !this.lastLoadedOrSaved) {
      this._content = null;

      const storage = this._parentFolder.storage;

      // on web sources, use GH APIs to retrieve content because that should work from a web/CORS/permissions perspective to retrieve binary files
      // on non-web sources, just retrieve the binary directly from raw.githubusercontent.com
      if (CreatorToolsHost.isWeb) {
        const octo = storage.manager.octokit;

        let fullPathMinusSlash = this.fullPath;

        if (fullPathMinusSlash.startsWith("/")) {
          fullPathMinusSlash = fullPathMinusSlash.substring(1, fullPathMinusSlash.length);
        }

        let file = undefined;

        try {
          file = await octo.rest.repos.getContent({
            owner: storage.ownerName,
            repo: storage.repoName,
            ref: storage.branch,
            path: fullPathMinusSlash,
          });
        } catch (e: any) {
          if (e.name && e.name === "HttpError" && e.message.indexOf("rate limit") >= 0) {
            throw new Error(e.message);
          } else {
            Log.debugAlert("Could not get content for GitHub file: '" + e.toString() + "'");
          }
        }

        if (file) {
          const fileData = file.data as {
            encoding?: string;
            content?: string;
          };

          if (fileData.content !== undefined && fileData.encoding !== undefined) {
            if (fileData.encoding === "base64") {
              let contentA = fileData.content;

              if (contentA && typeof contentA === "string") {
                contentA = contentA.replace(/\n/gi, "");
              }

              this._content = new Uint8Array(Utilities.base64ToArrayBuffer(contentA));

              const preferredEncoding = StorageUtilities.getEncodingByFileName(this.name);

              if (preferredEncoding === EncodingType.Utf8String) {
                const result = Utilities.readStringUTF8(new DataView(this._content.buffer), 0, this._content.length);

                this._content = result.str;
              }
            } else {
              this._content = fileData.content;
            }
          }
        }
      } else {
        this._content = null;

        /*      if (this.fullPath.startsWith("/")) {
        path = this.fullPath.substring(1, this.fullPath.length);
      }*/

        const ghs = this._parentFolder.storage as GitHubStorage;
        const path =
          "https://raw.githubusercontent.com/" +
          ghs.ownerName +
          "/" +
          ghs.repoName +
          "/" +
          (ghs.branch ? ghs.branch : "main") +
          Utilities.ensureStartsWithSlash(this.fullPath);

        if (StorageUtilities.getEncodingByFileName(this.name) === EncodingType.ByteBuffer) {
          let response = undefined;

          try {
            response = await axios.get(path, {
              responseType: "arraybuffer",
              headers: {},
            });
          } catch (e: any) {
            Log.error("Could not retrieve file '" + this.fullPath + "' from '" + path + "' - " + e.toString());
            this.lastLoadedOrSaved = new Date();
            return this.lastLoadedOrSaved;
          }

          this._content = new Uint8Array(response.data);
        } else {
          let response = undefined;

          try {
            response = await axios.get(path, {
              headers: {},
            });
          } catch (e: any) {
            Log.error("Could not retrieve file '" + this.fullPath + "' - " + e.toString(), path);

            this.lastLoadedOrSaved = new Date();
            return this.lastLoadedOrSaved;
          }

          let result = response.data;

          if (typeof result === "object") {
            try {
              result = JSON.stringify(result, null, 2);
            } catch (e) {
              Log.fail("Could not convert file to JSON");
            }
          }

          if (response.status !== 200) {
            Log.fail("Could not retrieve file from '" + path + "' - response code is " + response.status);
            Log.verbose("Could not retrieve file from '" + path + "' - response code is " + response.status);
          }

          if (result === null || result === "null") {
            Log.fail("Could not retrieve file from '" + path + "' - result is null.");
            Log.verbose("Could not retrieve file from '" + path + "' - result is null.");
          }

          this._content = result;
        }
      }

      this.lastLoadedOrSaved = new Date();
    }

    return this.lastLoadedOrSaved;
  }

  setContent(newContent: string | Uint8Array | null, updateType?: FileUpdateType) {
    const areEqual = StorageUtilities.contentsAreEqual(this._content, newContent);

    if (areEqual) {
      return false;
    }

    let oldContent = this._content;
    this._content = newContent;

    this.contentWasModified(oldContent, updateType);

    return true;
  }

  async saveContent(): Promise<Date> {
    if (this.parentFolder.storage.readOnly) {
      throw new Error("Can't save read-only file.");
    }

    this.lastLoadedOrSaved = new Date();

    return this.lastLoadedOrSaved;
  }
}
