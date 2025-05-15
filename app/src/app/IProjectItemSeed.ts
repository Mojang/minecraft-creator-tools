// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { ProjectItemType } from "./IProjectItemData";
import ProjectItem from "./ProjectItem";

export enum ProjectItemSeedAction {
  defaultAction = 0,
  overwriteFile = 1,
  fileOrFolder = 2,
}

export default interface IProjectItemSeed {
  name?: string;
  itemType: ProjectItemType;
  folder?: IFolder;
  targetedItem?: ProjectItem;
  contentTemplateName?: string;
  fileSource?: File;
  fileContent?: Uint8Array | string | undefined;
  action?: ProjectItemSeedAction;
}
