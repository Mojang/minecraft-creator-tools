// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.lay_egg
 * 
 * minecraft:behavior.lay_egg Samples

Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.lay_egg": {
  "priority": 2,
  "speed_multiplier": 1,
  "search_range": 10,
  "search_height": 3,
  "goal_radius": 1.7,
  "target_blocks": [
    "minecraft:water"
  ],
  "target_materials_above_block": [
    "Air"
  ],
  "allow_laying_from_below": true,
  "use_default_animation": false,
  "lay_seconds": 2,
  "egg_type": "minecraft:frog_spawn",
  "lay_egg_sound": "lay_spawn",
  "on_lay": {
    "event": "laid_egg",
    "target": "self"
  }
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:behavior.lay_egg": {
  "priority": 1,
  "speed_multiplier": 1,
  "search_range": 16,
  "search_height": 4,
  "goal_radius": 1.5,
  "on_lay": {
    "event": "minecraft:laid_egg",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Lay Egg Behavior (minecraft:behavior.lay_egg)
 * Allows the mob to lay an egg block on certain types of blocks if
 * the mob is pregnant.
 */
export default interface MinecraftBehaviorLayEgg {

  /**
   * @remarks
   * Allows the mob to lay its eggs from below the target if it
   * can't get there. This is useful if the target block is water with
   * air above, since mobs may not be able to get to the air block
   * above water.
   * 
   * Sample Values:
   * Frog: true
   *
   */
  allow_laying_from_below?: boolean;

  /**
   * @remarks
   * Block type for the egg to lay. If this is a turtle egg, the
   * number of eggs in the block is randomly set.
   * 
   * Sample Values:
   * Frog: "minecraft:frog_spawn"
   *
   */
  egg_type?: string;

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Frog: 1.7
   *
   * Turtle: 1.5
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * Name of the sound event played when laying the egg. Defaults to
   * lay_egg, which is used for Turtles.
   * 
   * Sample Values:
   * Frog: "lay_spawn"
   *
   */
  lay_egg_sound?: string;

  /**
   * @remarks
   * Duration of the laying egg process in seconds.
   * 
   * Sample Values:
   * Frog: 2
   *
   */
  lay_seconds?: number;

  /**
   * @remarks
   * Event to run when this mob lays the egg.
   * 
   * Sample Values:
   * Frog: {"event":"laid_egg","target":"self"}
   *
   * Turtle: {"event":"minecraft:laid_egg","target":"self"}
   *
   *
   */
  on_lay?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Frog: 2
   *
   * Turtle: 1
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Height in blocks the mob will look for a target block to move
   * towards
   * 
   * Sample Values:
   * Frog: 3
   *
   * Turtle: 4
   *
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks it will look for a target block to move
   * towards
   * 
   * Sample Values:
   * Frog: 10
   *
   * Turtle: 16
   *
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Frog: 1
   *
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Blocks that the mob can lay its eggs on top of.
   * 
   * Sample Values:
   * Frog: ["minecraft:water"]
   *
   */
  target_blocks?: string[];

  /**
   * @remarks
   * Types of materials that can exist above the target block. Valid
   * types are Air, Water, and Lava.
   * 
   * Sample Values:
   * Frog: ["Air"]
   *
   */
  target_materials_above_block?: string[];

  /**
   * @remarks
   * Specifies if the default lay-egg animation should be played when
   * the egg is placed or not.
   */
  use_default_animation?: boolean;

}