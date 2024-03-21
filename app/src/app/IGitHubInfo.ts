// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IGitHubInfo {
  owner: string;
  repoName: string;
  branch?: string;
  folder?: string;
  title?: string;
  commit?: string;
}
