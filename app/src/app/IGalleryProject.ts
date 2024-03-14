// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum GalleryProjectType {
  project = 0,
  chunk = 1,
  blockType = 2,
  codeSample = 3,
  entityType = 4,
}

export interface LogoLocation {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default interface IGalleryProject {
  gitHubOwner: string;
  gitHubRepoName: string;
  gitHubFolder?: string;
  gitHubBranch?: string;
  thumbnailImage: string;
  logoImage?: string;
  localLogo?: string;
  logoLocation?: LogoLocation;
  title: string;
  description: string;
  containsStructures?: boolean;
  containsGameTests?: boolean;
  itemImages?: string[];
  fileList?: string[];
  type: GalleryProjectType;
  id: string;
}
