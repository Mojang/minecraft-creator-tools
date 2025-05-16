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
  animation_length?: number;
  loop?: boolean;
  bones: IAnimationResourceBoneSet;
}

export interface IAnimationResourceBoneSet {
  [identifier: string]: IAnimationResourceBone;
}

export interface IAnimationResourceBone {
  rotation?: { [timeCode: string]: (number | string)[] | IAnimationResourceBoneKeyframeOffset } | (number | string)[];
  position?: { [timeCode: string]: (number | string)[] | IAnimationResourceBoneKeyframeOffset } | (number | string)[];
  scale?: { [timeCode: string]: (number | string)[] } | (number | string)[];
}

export interface IAnimationResourceBoneKeyframeOffset {
  lerp_mode: "linear" | "catmullrom";
  post: number[];
  pre?: number[];
}
