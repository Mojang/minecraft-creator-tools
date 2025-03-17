// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum GalleryItemType {
  project = 0,
  chunk = 1,
  blockType = 2,
  codeSample = 3,
  entityType = 4,
  editorCodeSample = 5,
  editorProject = 6,
  itemType = 7,
}

export interface LogoLocation {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
}

export default interface IGalleryItem {
  gitHubOwner: string;
  gitHubRepoName: string;
  gitHubFolder?: string;
  gitHubBranch?: string;
  thumbnailImage: string;
  logoImage?: string;
  localLogo?: string;
  sampleSet?: string;
  topics?: string[];
  logoLocation?: LogoLocation;
  title: string;
  description: string;
  targetRuntimeIdentifier?: string;
  containsStructures?: boolean;
  containsGameTests?: boolean;
  itemImages?: string[];
  codeLineStart?: number;
  fileList?: string[];
  tags?: string[];
  type: GalleryItemType;
  nameReplacers?: string[];
  id: string;
}
