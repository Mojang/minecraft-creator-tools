// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { ProjectItemType } from "./IProjectItemData";
import ProjectItem from "./ProjectItem";

export enum ProjectItemSeedAction {
  defaultAction = 0,
  overwriteFile = 1,
  fileOrFolder = 2,
  overrwriteVanillaPath = 3,
}

export default interface IProjectItemSeed {
  name?: string;
  itemType: ProjectItemType;
  folder?: IFolder;
  targetedItem?: ProjectItem;
  contentTemplateName?: string;
  creationData?: object;
  fileSource?: File;
  fileContent?: Uint8Array | string | undefined;
  replacePath?: string | undefined;
  action?: ProjectItemSeedAction;
}
