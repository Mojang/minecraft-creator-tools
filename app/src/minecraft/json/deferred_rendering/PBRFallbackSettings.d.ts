// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:pbrfallbackconfig_pbrfallbackconfigsettings
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * PBR Fallback Settings
 * Struct PBRFallbackConfig PBRFallbackConfigSettings Client Deferred
 * Rendering.
 */
export default interface PBRFallbackSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:pbr_fallback_settings
   */
  "minecraft:pbr_fallback_settings": PBRFallbackSettingsMinecraftPbrFallbackSettings;

}


/**
 * PBRFallbackConfig PBRFallbackConfigSettings 
 * PBRFallbackSettings
 * PBRFallbackConfig PBRFallbackConfigSettings 
 * PBRFallbackSettings.
 */
export interface PBRFallbackSettingsMinecraftPbrFallbackSettings {

  /**
   * @remarks
   * actors
   */
  actors: PBRFallbackSettingsMinecraftPbrFallbackSettingsActors;

  /**
   * @remarks
   * blocks
   */
  blocks: PBRFallbackSettingsMinecraftPbrFallbackSettingsBlocks;

  /**
   * @remarks
   * items
   */
  items: PBRFallbackSettingsMinecraftPbrFallbackSettingsItems;

  /**
   * @remarks
   * particles
   */
  particles: PBRFallbackSettingsMinecraftPbrFallbackSettingsParticles;

}


/**
 * Actors
 * Actors
 */
export interface PBRFallbackSettingsMinecraftPbrFallbackSettingsActors {

  /**
   * @remarks
   * global_metalness_emissive_roughness
   */
  global_metalness_emissive_roughness: string;

}


/**
 * Blocks
 * Blocks
 */
export interface PBRFallbackSettingsMinecraftPbrFallbackSettingsBlocks {

  /**
   * @remarks
   * global_metalness_emissive_roughness
   */
  global_metalness_emissive_roughness: string;

}


/**
 * Items
 * Items
 */
export interface PBRFallbackSettingsMinecraftPbrFallbackSettingsItems {

  /**
   * @remarks
   * global_metalness_emissive_roughness
   */
  global_metalness_emissive_roughness: string;

}


/**
 * Particles
 * Particles
 */
export interface PBRFallbackSettingsMinecraftPbrFallbackSettingsParticles {

  /**
   * @remarks
   * global_metalness_emissive_roughness
   */
  global_metalness_emissive_roughness: string;

}