// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.tempt
 * 
 * minecraft:behavior.tempt Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.tempt": {
  "priority": 3,
  "speed_multiplier": 1.25,
  "can_tempt_vertically": true,
  "items": [
    "spider_eye"
  ]
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.tempt": {
  "priority": 2,
  "speed_multiplier": 1.1,
  "can_tempt_vertically": true,
  "items": [
    "tropical_fish_bucket"
  ]
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.tempt": {
  "priority": 5,
  "speed_multiplier": 1.25,
  "within_radius": 8,
  "can_tempt_vertically": true,
  "items": [
    "minecraft:poppy",
    "minecraft:blue_orchid",
    "minecraft:allium",
    "minecraft:azure_bluet",
    "minecraft:red_tulip",
    "minecraft:orange_tulip",
    "minecraft:white_tulip",
    "minecraft:pink_tulip",
    "minecraft:oxeye_daisy",
    "minecraft:cornflower",
    "minecraft:lily_of_the_valley",
    "minecraft:dandelion",
    "minecraft:wither_rose",
    "minecraft:sunflower",
    "minecraft:lilac",
    "minecraft:rose_bush",
    "minecraft:peony",
    "minecraft:flowering_azalea",
    "minecraft:azalea_leaves_flowered",
    "minecraft:mangrove_propagule",
    "minecraft:pitcher_plant",
    "minecraft:torchflower",
    "minecraft:cherry_leaves",
    "minecraft:pink_petals",
    "minecraft:open_eyeblossom",
    "minecraft:wildflowers",
    "minecraft:cactus_flower"
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.tempt": {
  "priority": 3,
  "speed_multiplier": 2.5,
  "can_tempt_vertically": true,
  "items": [
    "cactus"
  ]
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

 * At /minecraft:entity/component_groups/minecraft:cat_wild/minecraft:behavior.tempt/: 
"minecraft:behavior.tempt": {
  "priority": 5,
  "speed_multiplier": 0.5,
  "within_radius": 16,
  "can_get_scared": true,
  "tempt_sound": "tempt",
  "sound_interval": [
    0,
    100
  ],
  "items": [
    "fish",
    "salmon"
  ]
}

 * At /minecraft:entity/component_groups/minecraft:cat_tame/minecraft:behavior.tempt/: 
"minecraft:behavior.tempt": {
  "priority": 5,
  "speed_multiplier": 0.5,
  "within_radius": 16,
  "items": [
    "fish",
    "salmon"
  ]
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:behavior.tempt": {
  "priority": 4,
  "speed_multiplier": 1,
  "items": [
    "wheat_seeds",
    "beetroot_seeds",
    "melon_seeds",
    "pumpkin_seeds",
    "pitcher_pod",
    "torchflower_seeds"
  ]
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:behavior.tempt": {
  "priority": 4,
  "speed_multiplier": 1.25,
  "items": [
    "wheat"
  ]
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:behavior.tempt": {
  "priority": 5,
  "speed_multiplier": 1.2,
  "items": [
    "golden_apple",
    "appleEnchanted",
    "golden_carrot"
  ]
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.tempt": {
  "priority": 3,
  "speed_multiplier": 0.5,
  "within_radius": 16,
  "can_get_scared": true,
  "items": [
    "sweet_berries",
    "glow_berries"
  ]
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.tempt": {
  "priority": 5,
  "speed_multiplier": 1.25,
  "can_tempt_vertically": true,
  "items": [
    "slime_ball"
  ]
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:behavior.tempt": {
  "priority": 4,
  "speed_multiplier": 0.75,
  "items": [
    "wheat"
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Tempt Behavior (minecraft:behavior.tempt)
 * Allows a mob to be tempted by a player holding a specific item.
 * Uses pathfinding for movement.
 */
export default interface MinecraftBehaviorTempt {

  /**
   * @remarks
   * If true, the mob can stop being tempted if the player moves too
   * fast while close to this mob.
   * 
   * Sample Values:
   * Cat: true
   *
   *
   */
  can_get_scared?: boolean;

  /**
   * @remarks
   * If true, vertical distance to the player will be considered when
   * tempting.
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  can_tempt_vertically?: boolean;

  /**
   * @remarks
   * If true, the mob can be tempted even if it has a passenger (i.e.
   * if being ridden).
   * 
   * Sample Values:
   * Strider: true
   *
   */
  can_tempt_while_ridden?: boolean;

  /**
   * @remarks
   * List of items that can tempt the mob.
   * 
   * Sample Values:
   * Armadillo: ["spider_eye"]
   *
   * Axolotl: ["tropical_fish_bucket"]
   *
   * Bee: ["minecraft:poppy","minecraft:blue_orchid","minecraft:allium","minecraft:azure_bluet","minecraft:red_tulip","minecraft:orange_tulip","minecraft:white_tulip","minecraft:pink_tulip","minecraft:oxeye_daisy","minecraft:cornflower","minecraft:lily_of_the_valley","minecraft:dandelion","minecraft:wither_rose","minecraft:sunflower","minecraft:lilac","minecraft:rose_bush","minecraft:peony","minecraft:flowering_azalea","minecraft:azalea_leaves_flowered","minecraft:mangrove_propagule","minecraft:pitcher_plant","minecraft:torchflower","minecraft:cherry_leaves","minecraft:pink_petals","minecraft:open_eyeblossom","minecraft:wildflowers","minecraft:cactus_flower"]
   *
   */
  items?: string[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Happy Ghast: {"event":"minecraft:on_stop_tempting"}
   *
   */
  on_tempt_end?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Armadillo: 3
   *
   * Axolotl: 2
   *
   * Bee: 5
   *
   */
  priority?: number;

  /**
   * @remarks
   * Range of random ticks to wait between tempt sounds.
   * 
   * Sample Values:
   * Cat: [0,100]
   *
   * Strider: {"range_min":2,"range_max":5}
   *
   *
   */
  sound_interval?: number[];

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Armadillo: 1.25
   *
   * Axolotl: 1.1
   *
   *
   * Camel: 2.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The distance at which the mob will stop following the 
   * player.
   */
  stop_distance?: number;

  /**
   * @remarks
   * Sound to play while the mob is being tempted.
   * 
   * Sample Values:
   * Cat: "tempt"
   *
   *
   */
  tempt_sound?: string;

  /**
   * @remarks
   * Distance in blocks this mob can get tempted by a player holding an
   * item they like.
   * 
   * Sample Values:
   * Bee: 8
   *
   * Cat: 16
   *
   * Robot: 7
   *
   */
  within_radius?: number;

}