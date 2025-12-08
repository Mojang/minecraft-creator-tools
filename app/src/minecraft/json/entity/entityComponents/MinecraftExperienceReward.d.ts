// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:experience_reward
 * 
 * minecraft:experience_reward Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:experience_reward": {
  "on_bred": "Math.Random(1,7)",
  "on_death": "query.last_hit_by_player ? Math.Random(1,3) : 0"
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? 10 : 0"
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? 5 + (query.equipment_count * Math.Random(1,3)) : 0"
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:experience_reward": {
  "on_bred": "Math.Random(1,7)",
  "on_death": "query.last_hit_by_player ? 10 : 0"
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? 5 : 0"
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? Math.Random(1,3) : 0"
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

 * At /minecraft:entity/component_groups/minecraft:baby_drowned/minecraft:experience_reward/: 
"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? 12 + (query.equipment_count * Math.Random(1,3)) : 0"
}


Endermite - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/endermite.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? 3 : 0"
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:experience_reward": {
  "on_death": "10"
}


Glow Squid - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/glow_squid.json

"minecraft:experience_reward": {
  "on_death": "!query.is_baby && query.last_hit_by_player ? Math.Random(1,3) : 0"
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:experience_reward": {
  "on_bred": "Math.Random(1,7)",
  "on_death": "query.last_hit_by_player ? 5 : 0"
}


Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:experience_reward": {
  "on_death": "query.last_hit_by_player ? query.variant : 0"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Experience Reward (minecraft:experience_reward)
 * .
 */
export default interface MinecraftExperienceReward {

  /**
   * @remarks
   * A Molang expression defining the amount of experience rewarded when
   * this entity is successfully bred.
   * 
   * Sample Values:
   * Armadillo: "Math.Random(1,7)"
   *
   *
   */
  on_bred?: string;

  /**
   * @remarks
   * A Molang expression defining the amount of experience rewarded when
   * this entity dies.
   * 
   * Sample Values:
   * Armadillo: "query.last_hit_by_player ? Math.Random(1,3) : 0"
   *
   *
   * Blaze: "query.last_hit_by_player ? 10 : 0"
   *
   * Bogged: "query.last_hit_by_player ? 5 + (query.equipment_count * Math.Random(1,3)) : 0"
   *
   */
  on_death?: string;

}