// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IMainInfoVersions {
  /**
   * `type` is present on entries in the bedrock-samples preview branch (value "preview").
   * The main branch omits it, so callers must fall back to a version-number heuristic.
   */
  [versionId: string]: { version: string; date: string; type?: string };
}
