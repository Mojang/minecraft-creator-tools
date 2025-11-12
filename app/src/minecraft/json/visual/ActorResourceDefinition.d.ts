// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:actor_resource_definition.v1.8.0
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface ActorResourceDefinition {

  format_version: string | number[];

  "minecraft:client_entityattachable": ActorResourceDefinitionMinecraftClientEntityattachable;

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachable {

  description: ActorResourceDefinitionMinecraftClientEntityattachableDescription;

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescription {

  animation_controllers?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionAnimationControllers[];

  animations?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionAnimations;

  enable_attachables?: boolean;

  geometry?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionGeometry;

  held_item_ignores_lighting?: boolean;

  hide_armor?: boolean;

  identifier: string;

  materials?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionMaterials;

  min_engine_version?: string | number[];

  particle_effects?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionParticleEffects;

  particle_emitters?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionParticleEmitters;

  render_controllers?: string[];

  scripts?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionScripts;

  sound_effects?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionSoundEffects;

  spawn_egg?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionSpawnEgg;

  textures?: ActorResourceDefinitionMinecraftClientEntityattachableDescriptionTextures;

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionAnimationControllers {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionAnimations {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionGeometry {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionMaterials {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionParticleEffects {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionParticleEmitters {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionScripts {

  parent_setup?: string;

  pre_animation?: string[];

  scale?: string;

  scalexX?: string;

  scaleyY?: string;

  scalezZ?: string;

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionSoundEffects {

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionSpawnEgg {

  base_color?: string;

  overlay_color?: string;

  texture?: string;

  texture_index?: number;

}


/**
 */
export interface ActorResourceDefinitionMinecraftClientEntityattachableDescriptionTextures {

}