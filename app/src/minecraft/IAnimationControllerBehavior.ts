// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IAnimationControllerBehaviorWrapper {
  format_version: string;
  __comment__?: string;
  animation_controllers: IAnimationControllerBehaviorSet;
}

export interface IAnimationControllerBehaviorSet {
  [identifier: string]: IAnimationControllerBehavior;
}

export interface IAnimationControllerBehavior {
  initial_state: string;
  states: IAnimationControllerBehaviorStateSet;
}

export interface IAnimationControllerBehaviorStateSet {
  [identifier: string]: IAnimationControllerBehaviorState;
}

export interface IAnimationControllerBehaviorState {
  animations: string[];
  transitions: IAnimationControllerBehaviorStateTransitionSet[];
  on_entry?: string[];
  on_exit?: string[];
}

export interface IAnimationControllerBehaviorStateWrapper {
  id: string;
  animationControllerId: string;
  state: IAnimationControllerBehaviorState;
}

export interface IAnimationControllerBehaviorStateTransitionSet {
  [identifier: string]: IAnimationControllerBehaviorStateTransition;
}

export interface IAnimationControllerBehaviorStateTransition {
  [identifier: string]: string;
}
