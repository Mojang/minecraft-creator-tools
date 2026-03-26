// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { MinecraftTrack } from "./ICreatorToolsData";
import IGalleryItem from "./IGalleryItem";
import { IMinecraftContentDefinition } from "../minecraft/IContentMetaSchema";

/** Action to perform automatically after project creation (e.g., open the Add Mob dialog). */
export type PostCreateAction = "addMob" | "addBlock" | "addItem";

export default interface IProjectSeed {
  name?: string;
  shortName?: string;
  creator?: string;
  description?: string;
  path?: string;
  track?: MinecraftTrack;
  galleryProject?: IGalleryItem;
  targetFolder?: IFolder;
  targetFolderTitle?: string;
  /** If set, the editor will automatically trigger this action after the project opens. */
  postCreateAction?: PostCreateAction;
  /** If set, content will be generated from this definition after project creation. */
  contentDefinition?: IMinecraftContentDefinition;
}
