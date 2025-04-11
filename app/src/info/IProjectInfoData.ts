// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IContextIndexData from "../core/IContentIndexData";
import IInfoItemData from "./IInfoItemData";
import IProjectInfo from "./IProjectInfo";
import IProjectMetaState from "./IProjectMetaState";

export enum ProjectInfoSuite {
  default = 0,
  currentPlatformVersions = 1,
  cooperativeAddOn = 2,
  sharing = 3,
}

export default interface IProjectInfoData {
  info?: IProjectInfo;
  items?: IInfoItemData[];
  sourcePath?: string;
  sourceHash?: string;
  sourceName?: string;
  suite?: number;
  subsetReports?: IProjectMetaState[];
  index?: IContextIndexData;
  generatorName?: string;
  generatorVersion?: string;
}
