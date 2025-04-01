// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:boss
 * 
 * minecraft:boss Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:boss": {
  "should_darken_sky": false,
  "hud_range": 125
}


Wither - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither.json

"minecraft:boss": {
  "should_darken_sky": true,
  "hud_range": 55
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Boss (minecraft:boss)
 * Defines the current state of the boss for updating the boss 
 * HUD.
 */
export default interface MinecraftBoss {

  /**
   * @remarks
   * The max distance from the boss at which the boss's health bar is
   * present on the players screen.
   * 
   * Sample Values:
   * Ender Dragon: 125
   *
   * Wither: 55
   *
   */
  hud_range: number;

  /**
   * @remarks
   * The name that will be displayed above the boss's health bar.
   */
  name: string;

  /**
   * @remarks
   * Whether the sky should darken in the presence of the boss.
   * 
   * Sample Values:
   * Wither: true
   *
   */
  should_darken_sky: boolean;

}