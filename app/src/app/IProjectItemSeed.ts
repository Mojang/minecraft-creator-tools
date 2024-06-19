// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { ProjectItemType } from "./IProjectItemData";

export default interface IProjectItemSeed {
  name?: string;
  itemType: ProjectItemType;
  folder?: IFolder;
}
