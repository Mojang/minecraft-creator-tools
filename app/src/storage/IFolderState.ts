// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFileState from "./IFileState";
import IFolderSummaryState from "./IFolderSummaryState";

export default interface IFolderState {
  updated: Date;
  files: IFileState[];
  folders: IFolderSummaryState[];
}
