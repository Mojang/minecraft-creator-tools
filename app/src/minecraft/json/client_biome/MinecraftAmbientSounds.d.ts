// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:ambient_sounds
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Ambient Sounds (minecraft:ambient_sounds)
 * Sets the ambient sounds for the biome. These sounds must be in
 * the 'individual_named_sounds' in a 'sounds.json' file.
 */
export default interface MinecraftAmbientSounds {

  /**
   * @remarks
   * Named sound that occasionally plays at the listener position
   */
  addition?: object;

  /**
   * @remarks
   * Named sound that loops while the listener position is inside the
   * biome
   */
  loop?: object;

  /**
   * @remarks
   * Named sound that rarely plays at a nearby air block position when
   * the light level is low. Biomes without an ambient mood sound will
   * use the 'ambient.cave' sound.
   */
  mood?: object;

}