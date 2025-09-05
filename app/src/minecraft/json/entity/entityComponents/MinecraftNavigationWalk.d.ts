// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:navigation.walk
 * 
 * minecraft:navigation.walk Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "avoid_damage_blocks": true,
  "avoid_water": true
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "avoid_water": true,
  "avoid_damage_blocks": true
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:navigation.walk": {
  "is_amphibious": true,
  "avoid_sun": true,
  "avoid_water": true
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:navigation.walk": {
  "blocks_to_avoid": [
    {
      "tags": "query.any_tag('trapdoors')"
    }
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "avoid_damage_blocks": true
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:navigation.walk": {
  "can_float": true,
  "avoid_water": true,
  "avoid_damage_blocks": true
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:navigation.walk": {
  "avoid_water": true,
  "avoid_damage_blocks": true,
  "can_pass_doors": true,
  "can_open_doors": true
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:spawned_by_player/minecraft:navigation.walk/: 
"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "can_path_over_lava": false,
  "avoid_damage_blocks": true
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:navigation.walk/: 
"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "can_path_over_lava": true,
  "avoid_damage_blocks": false
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:navigation.walk": {
  "can_path_over_water": true
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:navigation.walk": {
  "can_path_over_water": false,
  "avoid_water": true
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:navigation.walk": {
  "can_path_over_water": true,
  "can_pass_doors": true,
  "can_open_doors": true,
  "avoid_water": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Walk navigation (minecraft:navigation.walk)
 * Walking style of the mob.
 */
export default interface MinecraftNavigationWalk {

  /**
   * @remarks
   * Tells the pathfinder to avoid blocks that cause damage when
   * finding a path
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  avoid_damage_blocks?: boolean;

  /**
   * @remarks
   * Tells the pathfinder to avoid portals (like nether portals) when
   * finding a path
   * 
   * Sample Values:
   * Zombie Pigman: true
   *
   */
  avoid_portals?: boolean;

  /**
   * @remarks
   * Whether or not the pathfinder should avoid tiles that are
   * exposed to the sun when creating paths
   * 
   * Sample Values:
   * Bogged: true
   *
   *
   */
  avoid_sun?: boolean;

  /**
   * @remarks
   * Tells the pathfinder to avoid water when creating a path
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  avoid_water?: boolean;

  /**
   * @remarks
   * Tells the pathfinder which blocks to avoid when creating a
   * path
   * 
   * Sample Values:
   * Breeze: [{"tags":"query.any_tag('trapdoors')"}]
   *
   * Goat: [{"name":"minecraft:powder_snow"}]
   *
   */
  blocks_to_avoid?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can jump out of water (like
   * a dolphin)
   */
  can_breach?: boolean;

  /**
   * @remarks
   * Tells the pathfinder that it can path through a closed door and
   * break it
   * 
   * Sample Values:
   * Husk: true
   *
   *
   */
  can_break_doors?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Cat: true
   *
   *
   */
  can_float?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can jump up blocks
   */
  can_jump?: boolean;

  /**
   * @remarks
   * Tells the pathfinder that it can path through a closed door
   * assuming the AI will open the door
   * 
   * Sample Values:
   * Copper Golem: true
   *
   *
   */
  can_open_doors?: boolean;

  /**
   * @remarks
   * Tells the pathfinder that it can path through a closed iron door
   * assuming the AI will open the door
   */
  can_open_iron_doors?: boolean;

  /**
   * @remarks
   * Whether a path can be created through a door
   * 
   * Sample Values:
   * Copper Golem: true
   *
   *
   */
  can_pass_doors?: boolean;

  /**
   * @remarks
   * Tells the pathfinder that it can start pathing when in the 
   * air
   */
  can_path_from_air?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can travel on the surface of
   * the lava
   * 
   * Sample Values:
   * Creaking: true
   *
   *
   */
  can_path_over_lava?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can travel on the surface of
   * the water
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  can_path_over_water?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it will be pulled down by
   * gravity while in water
   */
  can_sink?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can path anywhere through
   * water and plays swimming animation along that path
   */
  can_swim?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can walk on the ground
   * outside water
   * 
   * Sample Values:
   * Villager: true
   *
   *
   */
  can_walk?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can travel in lava like
   * walking on ground
   * 
   * Sample Values:
   * Strider: true
   *
   */
  can_walk_in_lava?: boolean;

  /**
   * @remarks
   * Tells the pathfinder whether or not it can walk on the ground
   * underwater
   * 
   * Sample Values:
   * Bogged: true
   *
   *
   */
  is_amphibious?: boolean;

}