// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.summon_entity
 * 
 * minecraft:behavior.summon_entity Samples

Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.summon_entity": {
  "priority": 2,
  "summon_choices": [
    {
      "min_activation_range": 0,
      "max_activation_range": 3,
      "cooldown_time": 5,
      "weight": 3,
      "cast_duration": 2,
      "particle_color": "#FF664D59",
      "start_sound_event": "cast.spell",
      "sequence": [
        {
          "shape": "circle",
          "target": "self",
          "base_delay": 1,
          "delay_per_summon": 0,
          "num_entities_spawned": 5,
          "entity_type": "minecraft:evocation_fang",
          "size": 1.5,
          "entity_lifespan": 1.1,
          "sound_event": "prepare.attack"
        },
        {
          "shape": "circle",
          "target": "self",
          "base_delay": 0.15,
          "delay_per_summon": 0,
          "num_entities_spawned": 8,
          "entity_type": "minecraft:evocation_fang",
          "size": 2.5,
          "entity_lifespan": 1.1
        }
      ]
    },
    {
      "min_activation_range": 3,
      "weight": 3,
      "cooldown_time": 5,
      "cast_duration": 2,
      "particle_color": "#FF664D59",
      "start_sound_event": "cast.spell",
      "sequence": [
        {
          "shape": "line",
          "target": "self",
          "base_delay": 1,
          "delay_per_summon": 0.05,
          "num_entities_spawned": 16,
          "entity_type": "minecraft:evocation_fang",
          "size": 20,
          "entity_lifespan": 1.1
        }
      ]
    },
    {
      "weight": 1,
      "cooldown_time": 17,
      "cast_duration": 5,
      "particle_color": "#FFB3B3CC",
      "sequence": [
        {
          "shape": "circle",
          "target": "self",
          "base_delay": 5,
          "num_entities_spawned": 3,
          "entity_type": "minecraft:vex",
          "summon_cap": 8,
          "summon_cap_radius": 16,
          "size": 1,
          "sound_event": "prepare.summon",
          "summon_event": "minecraft:add_damage_timer"
        }
      ]
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Summon Entity Behavior (minecraft:behavior.summon_entity)
 * Allows the mob to attack the player by summoning other 
 * entities.
 */
export default interface MinecraftBehaviorSummonEntity {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Evocation Illager: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * List of spells for the mob to use to summon entities. Each spell
   * has the following parameters:
   * 
   * Sample Values:
   * Evocation Illager: [{"min_activation_range":0,"max_activation_range":3,"cooldown_time":5,"weight":3,"cast_duration":2,"particle_color":"#FF664D59","start_sound_event":"cast.spell","sequence":[{"shape":"circle","target":"self","base_delay":1,"delay_per_summon":0,"num_entities_spawned":5,"entity_type":"minecraft:evocation_fang","size":1.5,"entity_lifespan":1.1,"sound_event":"prepare.attack"},{"shape":"circle","target":"self","base_delay":0.15,"delay_per_summon":0,"num_entities_spawned":8,"entity_type":"minecraft:evocation_fang","size":2.5,"entity_lifespan":1.1}]},{"min_activation_range":3,"weight":3,"cooldown_time":5,"cast_duration":2,"particle_color":"#FF664D59","start_sound_event":"cast.spell","sequence":[{"shape":"line","target":"self","base_delay":1,"delay_per_summon":0.05,"num_entities_spawned":16,"entity_type":"minecraft:evocation_fang","size":20,"entity_lifespan":1.1}]},{"weight":1,"cooldown_time":17,"cast_duration":5,"particle_color":"#FFB3B3CC","sequence":[{"shape":"circle","target":"self","base_delay":5,"num_entities_spawned":3,"entity_type":"minecraft:vex","summon_cap":8,"summon_cap_radius":16,"size":1,"sound_event":"prepare.summon","summon_event":"minecraft:add_damage_timer"}]}]
   *
   */
  summon_choices: MinecraftBehaviorSummonEntitySummonChoices[];

}


/**
 * List of spells for the mob to use to summon entities. Each spell
 * has the following parameters:
 */
export interface MinecraftBehaviorSummonEntitySummonChoices {

  /**
   * @remarks
   * Time in seconds the spell casting will take
   */
  cast_duration: number;

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the spell 
   * again
   */
  cooldown_time: number;

  /**
   * @remarks
   * If true, the mob will do the casting animations and render spell
   * particles
   */
  do_casting: boolean;

  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Upper bound of the activation distance in blocks for this spell,
   * must not be negative.
   */
  max_activation_range: number;

  /**
   * @remarks
   * Lower bound of the activation distance in blocks for this spell,
   * must not be negative.
   */
  min_activation_range: number;

  /**
   * @remarks
   * The color of the particles for this spell
   */
  particle_color: number;

  /**
   * @remarks
   * List of steps for the spell. Each step has the following 
   * parameters:
   */
  sequence: MinecraftBehaviorSummonEntitySummonChoicesSequence[];

  /**
   * @remarks
   * The sound event to play when using this spell
   */
  start_sound_event: string;

  /**
   * @remarks
   * The weight of this spell. Controls how likely the mob is to
   * choose this spell when casting one
   */
  weight: number;

}


/**
 * List of steps for the spell. Each step has the following 
 * parameters:
 */
export interface MinecraftBehaviorSummonEntitySummonChoicesSequence {

  /**
   * @remarks
   * Amount of time in seconds to wait before this step starts
   */
  base_delay: number;

  /**
   * @remarks
   * Amount of time in seconds before each entity is summoned in
   * this step
   */
  delay_per_summon: number;

  /**
   * @remarks
   * Amount of time in seconds that the spawned entity will be alive
   * for. A value of -1.0 means it will remain alive for as long as
   * it can
   */
  entity_lifespan: number;

  /**
   * @remarks
   * The entity type of the entities we will spawn in this step
   */
  entity_type: string;

  /**
   * @remarks
   * Number of entities that will be spawned in this step
   */
  num_entities_spawned: number;

  /**
   * @remarks
   * The base shape of this step. Valid values are circle and 
   * line
   */
  shape: string;

  /**
   * @remarks
   * The base size of the entity
   */
  size: number;

  /**
   * @remarks
   * The sound event to play for this step
   */
  sound_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Maximum number of summoned entities at any given time
   */
  summon_cap: number;

  summon_cap_radius: number;

  /**
   * @remarks
   * Event to invoke on each summoned entity on spawn
   */
  summon_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The target of the spell. This is where the spell will start (line
   * will start here, circle will be centered here)
   */
  target: string;

}