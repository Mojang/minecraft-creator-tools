// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProjectItemType } from "./IProjectItemData";

export default interface IProjectItemSeed {
  name?: string;
  itemType: ProjectItemType;
}
