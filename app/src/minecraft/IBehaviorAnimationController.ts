// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IBehaviorAnimationControllerWrapper {
  format_version: string;
  __comment__?: string;
  animation_controllers: IBehaviorAnimationControllerSet;
}

export interface IBehaviorAnimationControllerSet {
  [identifier: string]: IBehaviorAnimationController;
}

export interface IBehaviorAnimationController {
  initial_state: string;
  states: IBehaviorAnimationControllerStateSet;
}

export interface IBehaviorAnimationControllerStateSet {
  [identifier: string]: IBehaviorAnimationControllerState;
}

export interface IBehaviorAnimationControllerState {
  animations: string[];
  transitions: IBehaviorAnimationControllerStateTransitionSet[];
  on_entry?: string[];
  on_exit?: string[];
}

export interface IBehaviorAnimationControllerStateWrapper {
  id: string;
  animationControllerId: string;
  state: IBehaviorAnimationControllerState;
}

export interface IBehaviorAnimationControllerStateTransitionSet {
  [identifier: string]: IBehaviorAnimationControllerStateTransition;
}

export interface IBehaviorAnimationControllerStateTransition {
  [identifier: string]: string;
}
