// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:actor_animation_controller.v1.10.0
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface ActorAnimationController {

  animation_controllers: { [key: string]: any };

  format_version: string | number[];

}


/**
 */
export interface ActorAnimationControllerAnimationControllers {

  initial_state?: string;

  states: { [key: string]: any };

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStates {

  animations?: ActorAnimationControllerAnimationControllersStatesAnimations[];

  /**
   * @remarks
   * Specifies the cross-fade time in seconds when transitioning to
   * another state
   */
  blend_transition?: ActorAnimationControllerAnimationControllersStatesBlendTransition;

  /**
   * @remarks
   * When blending a transition to another state, animate each euler
   * axis through the shortest rotation, instead of by value
   */
  blend_via_shortest_path?: boolean;

  on_entry?: string[];

  on_exit?: string[];

  particle_effects?: ActorAnimationControllerAnimationControllersStatesParticleEffects[];

  sound_effects?: ActorAnimationControllerAnimationControllersStatesSoundEffects[];

  transitions?: ActorAnimationControllerAnimationControllersStatesTransitions[];

  variables?: { [key: string]: any };

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesAnimations {

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesBlendTransition {

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesParticleEffects {

  /**
   * @remarks
   * Set to false to have the effect spawned in the world without being
   * bound to an actor (by default an effect is bound to the 
   * actor).
   */
  bind_to_actor?: boolean;

  /**
   * @remarks
   * The name of a particle effect that should be played
   */
  effect: string;

  /**
   * @remarks
   * The name of a locator on the actor where the effect should be
   * located
   */
  locator?: string;

  /**
   * @remarks
   * A Molang script that will be run when the particle emitter is
   * initialized
   */
  pre_effect_script?: string;

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesSoundEffects {

  /**
   * @remarks
   * Valid sound effect names should be listed in the entity's
   * resource_definition json file.
   */
  effect: string;

  /**
   * @remarks
   * The name of a locator on the actor where the sound should originate
   * from
   */
  locator?: string;

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesTransitions {

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesVariables {

  input: string;

  remap_curve?: ActorAnimationControllerAnimationControllersStatesVariablesRemapCurve;

}


/**
 */
export interface ActorAnimationControllerAnimationControllersStatesVariablesRemapCurve {

}