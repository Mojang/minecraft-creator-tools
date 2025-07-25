// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:home
 * 
 * minecraft:home Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:home": {
  "restriction_type": "random_movement",
  "restriction_radius": 22,
  "home_block_list": [
    "minecraft:bee_nest",
    "minecraft:beehive"
  ]
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:home": {
  "restriction_type": "all_movement",
  "restriction_radius": 32
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:home": {
  "restriction_type": "random_movement",
  "restriction_radius": 16
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:baby/minecraft:home/: 
"minecraft:home": {
  "restriction_radius": 32,
  "restriction_type": "random_movement"
}

 * At /minecraft:entity/component_groups/minecraft:adult_unharnessed/minecraft:home/: 
"minecraft:home": {
  "restriction_radius": 64,
  "restriction_type": "random_movement"
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:home": {}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:home": {
  "restriction_radius": 16
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Home (minecraft:home)
 * Saves a home position for when the the entity is spawned.
 */
export default interface MinecraftHome {

  /**
   * @remarks
   * Optional list of blocks that can be considered a valid home. If
   * no such block longer exists at that position,
											the home
   * restriction is removed. Example syntax: minecraft:sand. Not
   * supported: minecraft:sand:1.
   * 
   * Sample Values:
   * Bee: ["minecraft:bee_nest","minecraft:beehive"]
   *
   */
  home_block_list: string[];

  /**
   * @remarks
   * Optional radius that the entity will be restricted to in
   * relation to its home.
   * 
   * Sample Values:
   * Bee: 22
   *
   * Creaking: 32
   *
   * Elder Guardian: 16
   *
   */
  restriction_radius: number;

  /**
   * @remarks
   * Defines how the the entity will be restricted to its home
   * position. The possible values are:
												\n- "none", which
   * poses no restriction.
												\n- "random_movement", which
   * restricts randomized movement to be around the home
   * position.
												\n- "all_movement", which restricts any
   * kind of movement to be around the home
   * position.
													However, entities that somehow got too
   * far away from their home will always be able to move closer to
   * it, if prompted to do so.
   * 
   * Sample Values:
   * Bee: "random_movement"
   *
   * Creaking: "all_movement"
   *
   *
   */
  restriction_type: string;

}