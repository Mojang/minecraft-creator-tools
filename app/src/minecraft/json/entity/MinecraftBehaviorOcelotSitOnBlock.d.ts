// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.ocelot_sit_on_block
 * 
 * minecraft:behavior.ocelot_sit_on_block Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.ocelot_sit_on_block": {
  "priority": 7,
  "speed_multiplier": 1
}


Ocelot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ocelot.json

"minecraft:behavior.ocelot_sit_on_block": {
  "priority": 6,
  "speed_multiplier": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Ocelot Sit On Block Behavior 
 * (minecraft:behavior.ocelot_sit_on_block)
 * Allows to mob to be able to sit in place like the ocelot.
 */
export default interface MinecraftBehaviorOcelotSitOnBlock {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 7
   *
   * Ocelot: 6
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Cat: 1
   *
   *
   */
  speed_multiplier: number;

}