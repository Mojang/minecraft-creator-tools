// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.player_ride_tamed
 * 
 * minecraft:behavior.player_ride_tamed Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.player_ride_tamed": {}


Camel Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel_husk.json

"minecraft:behavior.player_ride_tamed": {
  "priority": 1
}


Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/nautilus.json

"minecraft:behavior.player_ride_tamed": {
  "priority": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Player Ride Tamed Behavior 
 * (minecraft:behavior.player_ride_tamed)
 * Allows the mob to be ridden by the player after being tamed.
 */
export default interface MinecraftBehaviorPlayerRideTamed {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Camel Husk: 1
   *
   *
   */
  priority?: number;

}