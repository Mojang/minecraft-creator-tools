// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IResourceAnimationWrapper {
  format_version: string;
  __comment__?: string;
  animations: IResourceAnimationSet;
}

export interface IResourceAnimationSet {
  [identifier: string]: IResourceAnimation;
}

export interface IResourceAnimation {
  animation_length: number;
  bones: IResourceAnimationBoneSet;
}

export interface IResourceAnimationBoneSet {
  [identifier: string]: IResourceAnimationBone;
}

export interface IResourceAnimationBone {
  rotation: number[];
  position: number[];
}
