// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProjectItemType } from "./IProjectItemData";
import ILocalizable from "../core/ILocalizable";

export enum GalleryItemType {
  project = 0,
  chunk = 1,
  blockType = 2,
  codeSample = 3,
  entityType = 4,
  editorCodeSample = 5,
  editorProject = 6,
  itemType = 7,
  actionSet = 8,
  modelDesign = 9, // Model design template (IMcpModelDesign JSON)
  spawnLootRecipes = 21,
  worldGen = 22,
  visuals = 23,
  entityItemBlockSingleFiles = 41,
  worldGenSingleFiles = 42,
  visualSingleFiles = 43,
  catalogSingleFiles = 44,
}

export interface LogoLocation {
  x: number;
  y: number;
  width: number;
  height: number;
  imageHeight: number;
  imageWidth: number;
}

export default interface IGalleryItem extends ILocalizable {
  gitHubOwner: string;
  gitHubRepoName: string;
  gitHubFolder?: string;
  gitHubBranch?: string;
  thumbnailImage: string;
  logoImage?: string;
  localLogo?: string;
  snapshotImage?: string;
  sampleSet?: string;
  topics?: string[];
  logoLocation?: LogoLocation;
  title: string;
  targetType?: ProjectItemType;
  description: string;
  targetRuntimeIdentifier?: string;
  containsStructures?: boolean;
  containsGameTests?: boolean;
  itemImages?: string[];
  creationData?: object | any;
  codeLineStart?: number;
  fileList?: string[];
  tags?: string[];
  type: GalleryItemType;
  nameReplacers?: string[];
  id: string;
  /** Difficulty level shown as a badge on template cards. */
  difficulty?: "beginner" | "intermediate" | "advanced";
  /** When true, this gallery item was synthesized from an existing ProjectItem, not from a gallery catalog. */
  isProjectItem?: boolean;
}
