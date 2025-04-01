// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.rise_to_liquid_level
 * 
 * minecraft:behavior.rise_to_liquid_level Samples

Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:behavior.rise_to_liquid_level": {
  "priority": 0,
  "liquid_y_offset": 0.25,
  "rise_delta": 0.01,
  "sink_delta": 0.01
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Rise To Liquid Level Behavior
 * (minecraft:behavior.rise_to_liquid_level)
 * Allows the mob to stay at a certain level when in liquid.
 */
export default interface MinecraftBehaviorRiseToLiquidLevel {

  /**
   * @remarks
   * Target distance down from the liquid surface. i.e. Positive values
   * move the target Y down.
   * 
   * Sample Values:
   * Strider: 0.25
   *
   */
  liquid_y_offset: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

  /**
   * @remarks
   * Movement up in Y per tick when below the liquid surface.
   * 
   * Sample Values:
   * Strider: 0.01
   *
   */
  rise_delta: number;

  /**
   * @remarks
   * Movement down in Y per tick when above the liquid surface.
   * 
   * Sample Values:
   * Strider: 0.01
   *
   */
  sink_delta: number;

}