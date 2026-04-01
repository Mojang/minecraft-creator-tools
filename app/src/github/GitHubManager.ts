// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

//import { GitCreateBlobResponse, GitCreateTreeParamsTree } from '@octokit/git';

import { Octokit } from "@octokit/rest";
import GitCreateBlobResponse from "./GitCreateBlobResponse";
import GitCreateTreeParamsTree from "./GitCreateTreeParamsTree";
import IFile from "./../storage/IFile";
import { Endpoints } from "@octokit/types";
import IGitHubClient from "./IGitHubClient";
import DifferenceSet from "../storage/DifferenceSet";
import { FileDifferenceType } from "../storage/IFileDifference";
import Utilities from "../core/Utilities";
import { constants } from "../core/Constants";

type GitHubReposResponse = Endpoints["GET /user/repos"]["response"];
type GitHubUserResponse = Endpoints["GET /user"]["response"];

export default class GitHubManager {
  private _octokit: Octokit;
  private _prefsFile?: IFile;
  private _isUserStateLoaded: boolean = false;

  private _data: IGitHubClient | undefined;

  private _reposResponse?: GitHubReposResponse;
  private _userResponse?: GitHubUserResponse;

  public get repos() {
    if (this._reposResponse === undefined) {
      return undefined;
    }

    return this._reposResponse.data;
  }

  public get authenticatedUser() {
    if (this._userResponse === undefined) {
      return undefined;
    }

    return this._userResponse.data;
  }

  public get octokit() {
    return this._octokit;
  }

  constructor(prefsStorageFile?: IFile) {
    this._octokit = new Octokit({
      userAgent: constants.name + " " + constants.version,
    });

    this._prefsFile = prefsStorageFile;
  }

  async _loadPrefs() {
    if (this._prefsFile === undefined) {
      return;
    }

    if (!this._prefsFile.isContentLoaded) {
      await this._prefsFile.loadContent();
    }

    if (this._prefsFile.content !== undefined && typeof this._prefsFile.content === "string") {
      this._data = JSON.parse(this._prefsFile.content);
    }

    if (this._data !== undefined && this._data.authToken !== undefined) {
      this._octokit = new Octokit({
        auth: this._data.authToken,
        userAgent: constants.name + " " + constants.version,
      });
    }
  }

  async _savePrefs() {
    if (this._prefsFile === undefined) {
      return;
    }

    if (this._data === undefined) {
      this._data = {};
    }

    if (this.authenticatedUser !== undefined && this.authenticatedUser.name !== null) {
      this._data.userName = this.authenticatedUser.name;
    }

    this._prefsFile.setContent(JSON.stringify(this._data));

    await this._prefsFile.saveContent();
  }

  async ensureUserStateLoaded() {
    if (this._isUserStateLoaded) {
      return;
    }

    await this._loadPrefs();

    const userResponse = await this._octokit.rest.users.getAuthenticated();
    this._userResponse = userResponse;

    const response = await this._octokit.rest.repos.listForAuthenticatedUser();
    this._reposResponse = response;

    this._isUserStateLoaded = true;
  }

  async createRepo(name: string, description: string) {
    const result = await this._octokit.repos.createForAuthenticatedUser({
      name: name,
      description: description,
      auto_init: true,
    });

    return result.data;
  }

  async commitToRepo(
    owner: string,
    repo: string,
    branch: string = "main",
    folderName: string = "",
    commitMessage: string,
    differences: DifferenceSet
  ) {
    // gets commit's AND its tree's SHA
    const currentCommit = await this.getCurrentCommit(owner, repo, branch);

    const filesBlobs: GitCreateBlobResponse[] = [];
    const pathsForBlobs: string[] = [];

    for (let i = 0; i < differences.fileDifferences.length; i++) {
      const diff = differences.fileDifferences[i];

      if (
        (diff.type === FileDifferenceType.contentsDifferent || diff.type === FileDifferenceType.fileAdded) &&
        diff.updated !== undefined
      ) {
        const updatedFile = diff.updated;

        if (!updatedFile.isContentLoaded) {
          await updatedFile.loadContent();
        }

        if (updatedFile.content !== null) {
          let targetPath = diff.path;

          targetPath = folderName + targetPath;

          if (targetPath.startsWith("/")) {
            targetPath = targetPath.substring(1, targetPath.length);
          }

          const file = await this.createBlobForFile(owner, repo, updatedFile.content);

          filesBlobs.push(file);
          pathsForBlobs.push(targetPath);
        }
      }
    }

    const newTree = await this.createNewTree(owner, repo, filesBlobs, pathsForBlobs, currentCommit.treeSha);

    const newCommit = await this.createNewCommit(owner, repo, commitMessage, newTree.sha, currentCommit.commitSha);

    this.setBranchToCommit(owner, repo, branch, newCommit.sha);
  }

  async createBlobForFile(owner: string, repo: string, content: Uint8Array | string) {
    let encoding = "utf-8";

    if (content instanceof Uint8Array) {
      content = Utilities.uint8ArrayToBase64(content);
      encoding = "base64";
    }

    const blobData = await this._octokit.git.createBlob({
      owner: owner,
      repo,
      content,
      encoding: encoding,
    });

    return blobData.data as GitCreateBlobResponse;
  }

  async getCurrentCommit(owner: string, repo: string, branch: string = "main") {
    const { data: refData } = await this._octokit.git.getRef({
      owner: owner,
      repo,
      ref: "heads/" + branch,
    });

    const commitSha = refData.object.sha;

    const { data: commitData } = await this._octokit.git.getCommit({
      owner: owner,
      repo,
      commit_sha: commitSha,
    });

    return {
      commitSha,
      treeSha: commitData.tree.sha,
    };
  }

  async createNewTree(
    owner: string,
    repo: string,
    blobs: GitCreateBlobResponse[],
    paths: string[],
    parentTreeSha: string
  ) {
    // My custom config. Could be taken as parameters
    const tree = blobs.map(({ sha }, index) => ({
      path: paths[index],
      mode: `100644`,
      type: `blob`,
      sha,
    })) as GitCreateTreeParamsTree[];

    const { data } = await this._octokit.git.createTree({
      owner,
      repo,
      tree,
      base_tree: parentTreeSha,
    });

    return data;
  }

  async createNewCommit(
    owner: string,
    repo: string,
    message: string,
    currentTreeSha: string,
    currentCommitSha: string
  ) {
    const result = await this._octokit.git.createCommit({
      owner: owner,
      repo,
      message,
      tree: currentTreeSha,
      parents: [currentCommitSha],
    });

    return result.data;
  }

  setBranchToCommit(owner: string, repo: string, branch: string = `main`, commitSha: string) {
    this._octokit.git.updateRef({
      owner: owner,
      repo,
      ref: `heads/${branch}`,
      sha: commitSha,
    });
  }
}
