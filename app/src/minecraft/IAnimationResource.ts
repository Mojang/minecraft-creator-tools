// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IAnimationResourceWrapper {
  format_version: string;
  __comment__?: string;
  animations: IAnimationResourceSet;
}

export interface IAnimationResourceSet {
  [identifier: string]: IAnimationResource;
}

export interface IAnimationResource {
  animation_length: number;
  bones: IAnimationResourceBoneSet;
}

export interface IAnimationResourceBoneSet {
  [identifier: string]: IAnimationResourceBone;
}

export interface IAnimationResourceBone {
  rotation: number[] | string;
  position: number[] | string;
  scale: number[] | string;
}
