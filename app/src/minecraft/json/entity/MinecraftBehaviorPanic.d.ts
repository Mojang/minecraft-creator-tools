// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.panic
 * 
 * minecraft:behavior.panic Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 2
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.panic": {
  "priority": 1,
  "ignore_mob_damage": true,
  "speed_multiplier": 2
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/escape_fire/minecraft:behavior.panic/: 
"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 1.25,
  "force": true
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 4
}


Camel Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel_husk.json

"minecraft:behavior.panic": {
  "priority": 2,
  "speed_multiplier": 4
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 1.25
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 1.5
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:behavior.panic": {
  "priority": 2,
  "speed_multiplier": 1.5
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 1.2
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:defending_fox/minecraft:behavior.panic/: 
"minecraft:behavior.panic": {
  "priority": 2,
  "speed_multiplier": 1.25
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:behavior.panic": {
  "priority": 1,
  "speed_multiplier": 1
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:behavior.panic": {
  "priority": 2,
  "speed_multiplier": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Panic Behavior (minecraft:behavior.panic)
 * Allows the mob to enter the panic state, which makes it run
 * around and away from the damage source that made it enter this
 * state.
 */
export default interface MinecraftBehaviorPanic {

  /**
   * @remarks
   * The list of Entity Damage Sources that will cause this mob to
   * panic
   * 
   * Sample Values:
   * Polar Bear: ["campfire","fire","fire_tick","freezing","lightning","lava","magma","temperature","soul_campfire"]
   *
   * Zombie Horse: ["campfire","fire","freezing","lava","lightning","magma","soul_campfire","temperature","entity_attack","entity_explosion","fireworks","magic","projectile","ram_attack","sonic_boom","wither","mace_smash"]
   *
   */
  damage_sources?: string[];

  /**
   * @remarks
   * If true, this mob will not stop panicking until it can't move
   * anymore or the goal is removed from it
   * 
   * Sample Values:
   * Bee: true
   *
   */
  force?: boolean;

  /**
   * @remarks
   * If true, the mob will not panic in response to damage from other
   * mobs. This overrides the damage types in "damage_sources"
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  ignore_mob_damage?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Strider: "panic"
   *
   */
  panic_sound?: string;

  /**
   * @remarks
   * If true, the mob will prefer water over land
   * 
   * Sample Values:
   * Turtle: true
   *
   *
   */
  prefer_water?: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 1
   *
   *
   * Camel Husk: 2
   *
   *
   * Horse: 3
   *
   */
  priority?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Strider: {"range_min":1,"range_max":3}
   *
   */
  sound_interval?: MinecraftBehaviorPanicSoundInterval;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Allay: 2
   *
   *
   * Bee: 1.25
   *
   * Camel: 4
   *
   */
  speed_multiplier?: number;

}


/**
 * Sound interval (sound_interval)
 */
export interface MinecraftBehaviorPanicSoundInterval {

  /**
   * @remarks
   * 
   * Sample Values:
   * Strider: 3
   *
   */
  range_max?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Strider: 1
   *
   */
  range_min?: number;

}