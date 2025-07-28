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
 * PBR Fallback Settings (minecraft:pbr_fallback_settings)
 * Struct PBRFallbackConfig PBRFallbackConfigSettings Client Deferred
 * Rendering.
 */
export default interface MinecraftPbrFallbackSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:pbr_fallback_settings
   */
  "minecraft:pbr_fallback_settings": MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettings;

}


/**
 * PBRFallbackConfig PBRFallbackConfigSettings 
 * PBRFallbackSettings
 * PBRFallbackConfig PBRFallbackConfigSettings 
 * PBRFallbackSettings.
 */
export interface MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettings {

  /**
   * @remarks
   * actors
   */
  actors: MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsActors;

  /**
   * @remarks
   * blocks
   */
  blocks: MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsBlocks;

  /**
   * @remarks
   * items
   */
  items: MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsItems;

  /**
   * @remarks
   * particles
   */
  particles: MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsParticles;

}


/**
 * Actors
 * Actors
 */
export interface MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsActors {

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
export interface MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsBlocks {

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
export interface MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsItems {

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
export interface MinecraftPbrFallbackSettingsMinecraftPbrFallbackSettingsParticles {

  /**
   * @remarks
   * global_metalness_emissive_roughness
   */
  global_metalness_emissive_roughness: string;

}