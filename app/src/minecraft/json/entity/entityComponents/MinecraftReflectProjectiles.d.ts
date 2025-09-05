// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:reflect_projectiles
 * 
 * minecraft:reflect_projectiles Samples

Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:reflect_projectiles": {
  "reflected_projectiles": [
    "xp_bottle",
    "thrown_trident",
    "shulker_bullet",
    "dragon_fireball",
    "arrow",
    "snowball",
    "egg",
    "fireball",
    "splash_potion",
    "ender_pearl",
    "wither_skull",
    "wither_skull_dangerous",
    "small_fireball",
    "lingering_potion",
    "llama_spit",
    "fireworks_rocket",
    "fishing_hook"
  ],
  "azimuth_angle": "180.0 + Math.random(-20.0, 20.0)",
  "reflection_scale": "0.5"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Reflect Projectiles (minecraft:reflect_projectiles)
 * [EXPERIMENTAL] Allows an entity to reflect projectiles.
 */
export default interface MinecraftReflectProjectiles {

  /**
   * @remarks
   * [EXPERIMENTAL] A Molang expression defining the angle in
   * degrees to add to the projectile's y axis rotation.
   * 
   * Sample Values:
   * Breeze: "180.0 + Math.random(-20.0, 20.0)"
   *
   */
  azimuth_angle?: string;

  /**
   * @remarks
   * [EXPERIMENTAL] A Molang expression defining the angle in
   * degrees to add to the projectile's x axis rotation.
   */
  elevation_angle?: string;

  /**
   * @remarks
   * [EXPERIMENTAL] An array of strings defining the types of
   * projectiles that are reflected when they hit the entity.
   * 
   * Sample Values:
   * Breeze: ["xp_bottle","thrown_trident","shulker_bullet","dragon_fireball","arrow","snowball","egg","fireball","splash_potion","ender_pearl","wither_skull","wither_skull_dangerous","small_fireball","lingering_potion","llama_spit","fireworks_rocket","fishing_hook"]
   *
   */
  reflected_projectiles?: string[];

  /**
   * @remarks
   * [EXPERIMENTAL] A Molang expression defining the velocity scaling of
   * the reflected projectile. Values below 1 decrease the
   * projectile's velocity, and values above 1 increase it.
   * 
   * Sample Values:
   * Breeze: "0.5"
   *
   */
  reflection_scale?: string;

  /**
   * @remarks
   * [EXPERIMENTAL] A string defining the name of the sound event to
   * be played when a projectile is reflected. "reflect" unless
   * specified.
   */
  reflection_sound?: string;

}