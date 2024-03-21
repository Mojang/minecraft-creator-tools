// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IResourceAnimationControllerDefinition {
  format_version: string;
  __comment__?: string;
  animation_controllers: IResourceAnimationControllerSet;
}

export interface IResourceAnimationControllerSet {
  [identifier: string]: IResourceAnimationController;
}

export interface IResourceAnimationController {
  initial_state: string;
  states: IResourceAnimationControllerStateSet;
}

export interface IResourceAnimationControllerStateSet {
  [identifier: string]: IResourceAnimationControllerState;
}

export interface IResourceAnimationControllerState {
  animations: string[];
  transitions: IResourceAnimationControllerStateTransitionSet[];
  blend_transition: number;
}

export interface IResourceAnimationControllerStateTransitionSet {
  [identifier: string]: IResourceAnimationControllerStateTransition;
}

export interface IResourceAnimationControllerStateTransition {
  [identifier: string]: string;
}
