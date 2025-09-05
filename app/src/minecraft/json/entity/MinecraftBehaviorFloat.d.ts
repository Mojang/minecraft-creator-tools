// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.float
 * 
 * minecraft:behavior.float Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.float": {
  "priority": 7
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.float": {
  "priority": 0
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.float": {
  "priority": 19
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.float": {
  "priority": 0,
  "sink_with_passengers": true
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:behavior.float": {
  "priority": 1
}


Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:behavior.float": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Float Behavior (minecraft:behavior.float)
 * Allows the mob to stay afloat while swimming. Passengers will be
 * kicked out the moment the mob's head goes underwater, which may
 * not happen for tall mobs.
 */
export default interface MinecraftBehaviorFloat {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 7
   *
   * Bee: 19
   *
   * Cave Spider: 1
   *
   */
  priority?: number;

  /**
   * @remarks
   * If true, the mob will keep sinking as long as it has 
   * passengers.
   * 
   * Sample Values:
   * Camel: true
   *
   */
  sink_with_passengers?: boolean;

}