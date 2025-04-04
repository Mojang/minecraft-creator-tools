// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:dash
 * 
 * minecraft:dash Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:dash": {
  "cooldown_time": 2.75,
  "horizontal_momentum": 20,
  "vertical_momentum": 0.6
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Dash (minecraft:dash)
 * Ability for a rideable entity to dash.
 */
export default interface MinecraftDash {

  /**
   * @remarks
   * The dash cooldown in seconds. Default value is 1.000000.
   * 
   * Sample Values:
   * Camel: 2.75
   *
   */
  cooldown_time: number;

  /**
   * @remarks
   * Horizontal momentum of the dash.
   * 
   * Sample Values:
   * Camel: 20
   *
   */
  horizontal_momentum: number;

  /**
   * @remarks
   * Vertical momentum of the dash.
   * 
   * Sample Values:
   * Camel: 0.6
   *
   */
  vertical_momentum: number;

}