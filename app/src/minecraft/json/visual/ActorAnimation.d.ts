// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:actor_animation.v1.8.0
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface ActorAnimation {

  animations: { [key: string]: any };

  format_version: string | number[];

}


/**
 */
export interface ActorAnimationAnimations {

  /**
   * @remarks
   * how does time pass when playing the animation.  Defaults to
   * "query.anim_time + query.delta_time" which means advance in
   * seconds.
   */
  anim_time_update: string;

  blend_weight: string;

  bones: { [key: string]: any };

  /**
   * @remarks
   * should this animation stop, loop, or stay on the last frame when
   * finished (true, false, "hold_on_last_frame"
   */
  loop: boolean;

  /**
   * @remarks
   * How long to wait in seconds before looping this animation. 
   * Note that this expression is evaluated after each loop and on
   * looping animation only.
   */
  loop_delay: string;

  /**
   * @remarks
   * should this animation stop, loop, or stay on the last frame when
   * finished (true, false, "hold_on_last_frame"
   */
  loopLessThanhold_on_last_frame: string;

  /**
   * @remarks
   * reset bones in this animation to the default pose before applying
   * this animation
   */
  override_previous_animation: boolean;

  particle_effects: { [key: string]: any };

  /**
   * @remarks
   * sound effects to trigger as this animation plays, keyed by 
   * time
   */
  sound_effects: { [key: string]: any };

  /**
   * @remarks
   * How long to wait in seconds before playing this animation. 
   * Note that this expression is evaluated once before playing, and
   * only re-evaluated if asked to play from the beginning again. 
   * A looping animation should use 'loop_delay' if it wants a
   * delay between loops.
   */
  start_delay: string;

  timeline: { [key: string]: any };

}


/**
 */
export interface ActorAnimationAnimationsBones {

  position: { [key: string]: any };

  relative_to: ActorAnimationAnimationsBonesRelativeTo;

  rotation: { [key: string]: any };

  scale: { [key: string]: any };

}


/**
 */
export interface ActorAnimationAnimationsBonesPosition {

  lerp_modeLessThanlinearcatmullrom: string;

  post: string[];

  pre: string[];

}


/**
 */
export interface ActorAnimationAnimationsBonesRelativeTo {

  /**
   * @remarks
   * if set, makes the bone rotation relative to the entity instead of
   * the bone's parent
   */
  rotationLessThanentity: string;

}


/**
 */
export interface ActorAnimationAnimationsBonesRotation {

  lerp_modeLessThanlinearcatmullrom: string;

  post: string[];

  pre: string[];

}


/**
 */
export interface ActorAnimationAnimationsBonesScale {

  lerp_modeLessThanlinearcatmullrom: string;

  post: string[];

  pre: string[];

}


/**
 */
export interface ActorAnimationAnimationsParticleEffects {

  /**
   * @remarks
   * Set to false to have the effect spawned in the world without being
   * bound to an actor (by default an effect is bound to the 
   * actor).
   */
  bind_to_actor: boolean;

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
  locator: string;

  /**
   * @remarks
   * A Molang script that will be run when the particle emitter is
   * initialized
   */
  pre_effect_script: string;

}


/**
 */
export interface ActorAnimationAnimationsSoundEffects {

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
  locator: string;

}


/**
 */
export interface ActorAnimationAnimationsTimeline {

}