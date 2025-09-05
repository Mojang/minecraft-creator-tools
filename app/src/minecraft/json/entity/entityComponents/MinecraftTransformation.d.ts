// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:transformation
 * 
 * minecraft:transformation Samples

Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:transformation": {
  "into": "minecraft:zoglin",
  "transformation_sound": "mob.hoglin.converted_to_zombified",
  "keep_level": true
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

 * At /minecraft:entity/component_groups/minecraft:convert_to_zombie/minecraft:transformation/: 
"minecraft:transformation": {
  "into": "minecraft:zombie<minecraft:as_adult>",
  "transformation_sound": "mob.husk.convert_to_zombie",
  "drop_equipment": true,
  "delay": {
    "value": 15
  }
}

 * At /minecraft:entity/component_groups/minecraft:convert_to_baby_zombie/minecraft:transformation/: 
"minecraft:transformation": {
  "into": "minecraft:zombie<minecraft:as_baby>",
  "transformation_sound": "mob.husk.convert_to_zombie",
  "drop_equipment": true,
  "delay": {
    "value": 15
  }
}


Mooshroom - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/mooshroom.json

"minecraft:transformation": {
  "into": "minecraft:cow"
}


Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:transformation": {
  "into": "minecraft:pig_zombie",
  "transformation_sound": "mob.pig.death",
  "delay": 0.5
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:transformation": {
  "into": "minecraft:zombie_pigman",
  "transformation_sound": "converted_to_zombified",
  "keep_level": true,
  "drop_inventory": true,
  "preserve_equipment": true
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:transformation": {
  "into": "minecraft:zombie_pigman",
  "transformation_sound": "converted_to_zombified",
  "keep_level": true,
  "preserve_equipment": true
}


Skeleton - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton.json

"minecraft:transformation": {
  "into": "minecraft:stray",
  "transformation_sound": "convert_to_stray",
  "keep_level": true,
  "drop_inventory": true,
  "preserve_equipment": true
}


Stray - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/stray.json

"minecraft:transformation": {
  "into": "minecraft:skeleton",
  "delay": 0.5
}


Tadpole - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/tadpole.json

"minecraft:transformation": {
  "into": "minecraft:frog",
  "transformation_sound": "convert_to_frog"
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

 * At /minecraft:entity/component_groups/become_witch/minecraft:transformation/: 
"minecraft:transformation": {
  "into": "minecraft:witch",
  "delay": 0.5
}

 * At /minecraft:entity/component_groups/become_villager_v2/minecraft:transformation/: 
"minecraft:transformation": {
  "into": "minecraft:villager_v2",
  "keep_level": true
}

 * At /minecraft:entity/component_groups/become_zombie/minecraft:transformation/: 
"minecraft:transformation": {
  "into": "minecraft:zombie_villager"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Transformation (minecraft:transformation)
 * Defines an entity's transformation from the current definition into
 * another.
 */
export default interface MinecraftTransformation {

  /**
   * @remarks
   * List of components to add to the entity after the 
   * transformation
   */
  add?: MinecraftTransformationAdd[];

  /**
   * @remarks
   * Sound to play when the transformation starts
   * 
   * Sample Values:
   * Zombie Villager: "remedy"
   *
   *
   */
  begin_transform_sound?: string;

  /**
   * @remarks
   * Defines the properties of the delay for the transformation
   * 
   * Sample Values:
   * Husk: {"value":15}
   *
   * Pig: 0.5
   *
   *
   * Zombie Villager: {"value":100,"block_assist_chance":0.01,"block_radius":4,"block_chance":0.3,"block_types":["minecraft:bed","minecraft:iron_bars"]}
   *
   */
  delay?: MinecraftTransformationDelay[];

  /**
   * @remarks
   * Cause the entity to drop all equipment upon transformation
   * 
   * Sample Values:
   * Husk: true
   *
   */
  drop_equipment?: boolean;

  /**
   * @remarks
   * Cause the entity to drop all items in inventory upon
   * transformation
   * 
   * Sample Values:
   * Piglin: true
   *
   *
   */
  drop_inventory?: boolean;

  /**
   * @remarks
   * Entity Definition that this entity will transform into
   * 
   * Sample Values:
   * Hoglin: "minecraft:zoglin"
   *
   * Husk: "minecraft:zombie<minecraft:as_adult>", "minecraft:zombie<minecraft:as_baby>"
   *
   */
  into?: string;

  /**
   * @remarks
   * If this entity has trades and has leveled up, it should maintain that
   * level after transformation.
   * 
   * Sample Values:
   * Hoglin: true
   *
   *
   */
  keep_level?: boolean;

  /**
   * @remarks
   * If this entity is owned by another entity, it should remain owned
   * after transformation.
   */
  keep_owner?: boolean;

  /**
   * @remarks
   * Cause the entity to keep equipment after going through
   * transformation
   * 
   * Sample Values:
   * Piglin: true
   *
   *
   */
  preserve_equipment?: boolean;

  /**
   * @remarks
   * Sound to play when the entity is done transforming
   * 
   * Sample Values:
   * Hoglin: "mob.hoglin.converted_to_zombified"
   *
   * Husk: "mob.husk.convert_to_zombie"
   *
   * Pig: "mob.pig.death"
   *
   */
  transformation_sound?: string;

}


/**
 * List of components to add to the entity after the
 * transformation.
 */
export interface MinecraftTransformationAdd {

  /**
   * @remarks
   * Names of component groups to add
   */
  component_groups?: string[];

}


/**
 * Defines the properties of the delay for the transformation.
 */
export interface MinecraftTransformationDelay {

  /**
   * @remarks
   * Chance that the entity will look for nearby blocks that can
   * speed up the transformation. Value must be between 0.0 and 
   * 1.0
   */
  block_assist_chance?: number;

  /**
   * @remarks
   * Chance that, once a block is found, will help speed up the
   * transformation
   */
  block_chance?: number;

  /**
   * @remarks
   * Maximum number of blocks the entity will look for to aid in the
   * transformation. If not defined or set to 0, it will be set to
   * the block radius
   */
  block_max?: number;

  /**
   * @remarks
   * Distance in Blocks that the entity will search for blocks that
   * can help the transformation
   */
  block_radius?: number;

  /**
   * @remarks
   * List of blocks that can help the transformation of this 
   * entity
   */
  block_types?: string[];

  /**
   * @remarks
   * Time in seconds to be added to value to have the maximum random
   * time range value until the entity transforms (if non-zero then
   * the time in seconds before the entity transforms will be random
   * between value+range_min and value+range_max)
   */
  range_max?: number;

  /**
   * @remarks
   * Time in seconds to be added to value to have the minimum random
   * time range value until the entity transforms (if non-zero then
   * the time in seconds before the entity transforms will be random
   * between value+range_min and value+range_max)
   */
  range_min?: number;

  /**
   * @remarks
   * Time in seconds before the entity transforms
   */
  value?: number;

}