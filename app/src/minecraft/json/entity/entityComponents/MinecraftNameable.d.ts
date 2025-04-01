// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:nameable
 * 
 * minecraft:nameable Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:nameable": {}


Npc - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/npc.json

"minecraft:nameable": {
  "always_show": false,
  "allow_name_tag_renaming": false
}


Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:nameable": {
  "always_show": true,
  "allow_name_tag_renaming": false
}


Vindicator - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vindicator.json

"minecraft:nameable": {
  "default_trigger": {
    "event": "minecraft:stop_johnny",
    "target": "self"
  },
  "name_actions": [
    {
      "name_filter": "Johnny",
      "on_named": {
        "event": "minecraft:start_johnny",
        "target": "self"
      }
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Nameable (minecraft:nameable)
 * Allows this entity to be named (e.g. using a name tag).
 */
export default interface MinecraftNameable {

  /**
   * @remarks
   * If true, this entity can be renamed with name tags
   */
  allow_name_tag_renaming: boolean;

  /**
   * @remarks
   * If true, the name will always be shown
   * 
   * Sample Values:
   * Player: true
   *
   */
  always_show: boolean;

  /**
   * @remarks
   * Trigger to run when the entity gets named
   * 
   * Sample Values:
   * Vindicator: {"event":"minecraft:stop_johnny","target":"self"}
   *
   */
  default_trigger: string;

  /**
   * @remarks
   * Describes the special names for this entity and the events to
   * call when the entity acquires those names
   * 
   * Sample Values:
   * Vindicator: [{"name_filter":"Johnny","on_named":{"event":"minecraft:start_johnny","target":"self"}}]
   *
   */
  name_actions: MinecraftNameableNameActions[];

}


/**
 * Describes the special names for this entity and the events to
 * call when the entity acquires those names.
 */
export interface MinecraftNameableNameActions {

  /**
   * @remarks
   * List of special names that will cause the events defined in
   * 'on_named' to fire
   */
  name_filter: string;

  /**
   * @remarks
   * Event to be called when this entity acquires the name specified in
   * 'name_filter'
   */
  on_named: jsoncommon.MinecraftEventTrigger;

}