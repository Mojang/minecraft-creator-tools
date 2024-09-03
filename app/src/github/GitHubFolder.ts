// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import GitHubFile from "./GitHubFile";
import GitHubStorage from "./GitHubStorage";
import StorageUtilities from "../storage/StorageUtilities";
import FolderBase from "../storage/FolderBase";
import { Endpoints } from "@octokit/types";
import Log from "../core/Log";

type getContentReposResponse = Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"];

export default class GitHubFolder extends FolderBase implements IFolder {
  private _name: string;
  private _parentPath: string;

  public sha?: string;

  folders: { [name: string]: GitHubFolder | undefined };
  files: { [name: string]: GitHubFile | undefined };

  private _storage: GitHubStorage;
  private _parentFolder: GitHubFolder | null;

  get storage(): GitHubStorage {
    return this._storage;
  }

  get parentFolder(): GitHubFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._parentPath;

    if (!path.endsWith(GitHubStorage.folderDelimiter)) {
      path += GitHubStorage.folderDelimiter;
    }

    path += this.name;

    return path;
  }

  constructor(storage: GitHubStorage, parentFolder: GitHubFolder | null, parentPath: string, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._parentPath = parentPath;
    this._name = folderName;
    this.folders = {};
    this.files = {};
  }

  async exists() {
    return true;
  }

  async ensureExists() {
    return true;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Deletion of this folder " + this.fullPath + " is not supported.");
  }

  ensureFile(name: string): GitHubFile {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new GitHubFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  ensureFolder(name: string): GitHubFolder {
    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new GitHubFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  async deleteFile(name: string): Promise<boolean> {
    throw new Error("Deletion of files not supported");
  }

  async createFile(name: string): Promise<IFile> {
    throw new Error("Creation of files not supported");
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    const repos = this.storage.manager.octokit.rest.repos;
    let pathMinusSlash = this.fullPath;

    if (pathMinusSlash === "/") {
      pathMinusSlash = "";
    } else if (!pathMinusSlash.startsWith("/")) {
      pathMinusSlash = "/" + pathMinusSlash;
    }

    if (pathMinusSlash.endsWith("/")) {
      pathMinusSlash = pathMinusSlash.substring(0, pathMinusSlash.length - 1);
    }

    // Log.debug("Loading GH folder from '" + pathMinusSlash + "'");

    const options = {
      owner: this.storage.ownerName,
      repo: this.storage.repoName,
      path: pathMinusSlash,
    };

    let contentListing = undefined;

    try {
      contentListing = await repos.getContent(options);
    } catch (e) {
      Log.debug("Error retrieving repo information: " + this.storage.ownerName + " " + this.storage.repoName + " " + e);
    }

    if (contentListing === undefined) {
      Log.debug("No data retrieved from repo: " + this.storage.ownerName + " " + this.storage.repoName);

      this.updateLastLoadedOrSaved();

      return this.lastLoadedOrSaved as Date;
    }

    const response: getContentReposResponse = contentListing;

    const fileObjects = response.data as {
      type: string;
      size: number;
      name: string;
      path: string;
      content?: string | undefined;
      sha: string;
      url: string;
      git_url: string | null;
      html_url: string | null;
      download_url: string | null;
      //            _links: {};
    }[];

    // Log.debug("Retrieved '" + fileObjects.length + "' GitHub objects.");

    for (const i in fileObjects) {
      const fso = fileObjects[i];

      if (fso.type === "dir") {
        const childFolder = this.ensureFolder(fso.name);
        childFolder.sha = fso.sha;
      } else if (fso.type === "file") {
        if (StorageUtilities.isUsableFile(fso.name)) {
          const childFile = this.ensureFile(fso.name);
          childFile.sha = fso.sha;
        }
      }
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
