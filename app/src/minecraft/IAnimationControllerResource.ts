// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IAnimationControllerResourceDefinition {
  format_version: string;
  __comment__?: string;
  animation_controllers: IAnimationControllerResourceSet;
}

export interface IAnimationControllerResourceSet {
  [identifier: string]: IAnimationControllerResource;
}

export interface IAnimationControllerResource {
  initial_state: string;
  states: IAnimationControllerResourceStateSet;
}

export interface IAnimationControllerResourceStateSet {
  [identifier: string]: IAnimationControllerResourceState;
}

export interface IAnimationControllerResourceState {
  animations: string[];
  transitions: IAnimationControllerResourceStateTransitionSet[];
  blend_transition: number;
}

export interface IAnimationControllerResourceStateTransitionSet {
  [identifier: string]: IAnimationControllerResourceStateTransition;
}

export interface IAnimationControllerResourceStateTransition {
  [identifier: string]: string;
}
