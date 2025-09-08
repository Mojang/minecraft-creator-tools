// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.roar
 * 
 * minecraft:behavior.roar Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:behavior.roar": {
  "priority": 2,
  "duration": 4.2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Roar Behavior (minecraft:behavior.roar)
 * Allows this entity to roar at another entity based on data in
 * `minecraft:anger_level`. Once the anger threshold specified in
 * `minecraft:anger_level` has been reached, this entity will roar
 * for the specified amount of time, look at the other entity, apply
 * anger boost towards it, and finally target it.
 */
export default interface MinecraftBehaviorRoar {

  /**
   * @remarks
   * The amount of time to roar for.
   * 
   * Sample Values:
   * Warden: 4.2
   *
   */
  duration?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Warden: 2
   *
   */
  priority?: number;

}