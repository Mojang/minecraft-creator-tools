// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:entity_placer
 * 
 * minecraft:entity_placer Samples
"minecraft:entity_placer": {
  "entity": "minecraft:spider",
  "dispense_on": [
    "minecraft:web"
  ],
  "use_on": [
    "minecraft:web"
  ]
}


Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:axe_turret"
}


Item Bow Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/bow_turret_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:bow_turret"
}


Item Crossbow Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/crossbow_turret_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:crossbow_turret"
}


Item Gray Wave Generator Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/gray_wave_generator_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:gray_wave_generator"
}


Item Shbullet Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/shbullet_turret_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:shbullet_turret"
}


Item Smfireball Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/smfireball_turret_kit.item.json

"minecraft:entity_placer": {
  "entity": "mikeamm_gwve:smfireball_turret"
}


My Sword Turtle - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_turtle.json

"minecraft:entity_placer": {
  "entity": "minecraft:turtle",
  "use_on": [
    "minecraft:sand"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Placer (minecraft:entity_placer)
 * Allows an item to place entities into the world. Additionally, in
 * version 1.19.80 and above, the component allows the item to set
 * the spawn type of a monster spawner.
 */
export default interface MinecraftEntityPlacer {

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * dispensed on. If left empty, all blocks will be allowed.
   */
  dispense_on: MinecraftEntityPlacerDispenseOn[];

  /**
   * @remarks
   * The entity to be placed in the world.
   * 
   * Sample Values:
   * My Sword Turtle: "minecraft:turtle"
   *
   */
  entity: { [key: string]: string };

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * used on. If left empty, all blocks will be allowed.
   * 
   * Sample Values:
   * My Sword Turtle: ["minecraft:sand"]
   *
   */
  use_on: MinecraftEntityPlacerUseOn[];

}


/**
 * Dispense On
 * Dispense On.
 */
export interface MinecraftEntityPlacerDispenseOn {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}


/**
 * Use On
 * Use On
 */
export interface MinecraftEntityPlacerUseOn {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}