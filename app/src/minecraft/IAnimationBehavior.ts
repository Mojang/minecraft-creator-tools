// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IAnimationBehaviorWrapper {
  format_version: string;
  __comment__?: string;
  animations: IAnimationBehaviorSet;
}

export interface IAnimationBehaviorSet {
  [identifier: string]: IAnimationBehavior;
}

export interface IAnimationBehavior {
  animation_length: number;
  loop?: boolean;
  timeline?: IAnimationBehaviorTimeline;
}

export interface IAnimationBehaviorTimeline {
  [timeStamp: string]: string[];
}

export interface IAnimationBehaviorTimelineWrapper {
  animationId: string;
  timestamp: string;
  timeline: string[];
}
