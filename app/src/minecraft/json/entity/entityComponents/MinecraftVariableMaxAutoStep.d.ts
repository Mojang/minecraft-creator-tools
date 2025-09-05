// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:variable_max_auto_step
 * 
 * minecraft:variable_max_auto_step Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:variable_max_auto_step": {
  "base_value": 1.5625,
  "controlled_value": 1.5625,
  "jump_prevented_value": 0.5625
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:variable_max_auto_step": {
  "base_value": 1.0625,
  "jump_prevented_value": 0.5625
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Variable Max Auto Step (minecraft:variable_max_auto_step)
 * Entities with this component will have a maximum auto step height
 * that is different depending on whether they are on a block that
 * prevents jumping. Incompatible with "runtime_identifier": 
 * "minecraft:horse".
 */
export default interface MinecraftVariableMaxAutoStep {

  /**
   * @remarks
   * The maximum auto step height when on any other block.
   * 
   * Sample Values:
   * Camel: 1.5625
   *
   * Creaking: 1.0625
   *
   *
   */
  base_value?: number;

  /**
   * @remarks
   * The maximum auto step height when on any other block and
   * controlled by the player.
   * 
   * Sample Values:
   * Camel: 1.5625
   *
   */
  controlled_value?: number;

  /**
   * @remarks
   * The maximum auto step height when on a block that prevents 
   * jumping.
   * 
   * Sample Values:
   * Camel: 0.5625
   *
   *
   */
  jump_prevented_value?: number;

}