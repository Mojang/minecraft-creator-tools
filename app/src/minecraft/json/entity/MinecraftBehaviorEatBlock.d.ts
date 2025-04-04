// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.eat_block
 * 
 * minecraft:behavior.eat_block Samples

Sheep - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sheep.json

"minecraft:behavior.eat_block": {
  "priority": 6,
  "success_chance": "query.is_baby ? 0.02 : 0.001",
  "time_until_eat": 1.8,
  "eat_and_replace_block_pairs": [
    {
      "eat_block": "grass",
      "replace_block": "dirt"
    },
    {
      "eat_block": "tallgrass",
      "replace_block": "air"
    },
    {
      "eat_block": "short_dry_grass",
      "replace_block": "air"
    },
    {
      "eat_block": "tall_dry_grass",
      "replace_block": "air"
    }
  ],
  "on_eat": {
    "event": "minecraft:on_eat_block",
    "target": "self"
  }
}


Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/1_hello_world/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:behavior.eat_block": {
  "priority": 6,
  "success_chance": "query.is_baby ? 0.02 : 0.001",
  "time_until_eat": 1.8,
  "eat_and_replace_block_pairs": [
    {
      "eat_block": "melon_block",
      "replace_block": "air"
    }
  ],
  "on_eat": {
    "event": "minecraft:on_eat_block",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Eat Block Behavior (minecraft:behavior.eat_block)
 * Allows the entity to consume a block, replace the eaten block with
 * another block, and trigger an event as a result.
 */
export default interface MinecraftBehaviorEatBlock {

  /**
   * @remarks
   * A collection of pairs of blocks; the first ("eat_block")is the
   * block the entity should eat, the second ("replace_block") is
   * the block that should replace the eaten block.
   * 
   * Sample Values:
   * Sheep: [{"eat_block":"grass","replace_block":"dirt"},{"eat_block":"tallgrass","replace_block":"air"},{"eat_block":"short_dry_grass","replace_block":"air"},{"eat_block":"tall_dry_grass","replace_block":"air"}]
   *
   * Sheepomelon: [{"eat_block":"melon_block","replace_block":"air"}]
   *
   *
   */
  eat_and_replace_block_pairs: string[];

  /**
   * @remarks
   * The event to trigger when the block eating animation has
   * completed.
   * 
   * Sample Values:
   * Sheep: {"event":"minecraft:on_eat_block","target":"self"}
   *
   *
   */
  on_eat: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Sheep: 6
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * A molang expression defining the success chance the entity has
   * to consume a block.
   * 
   * Sample Values:
   * Sheep: "query.is_baby ? 0.02 : 0.001"
   *
   *
   */
  success_chance: string;

  /**
   * @remarks
   * The amount of time (in seconds) it takes for the block to be
   * eaten upon a successful eat attempt.
   * 
   * Sample Values:
   * Sheep: 1.8
   *
   *
   */
  time_until_eat: number;

}