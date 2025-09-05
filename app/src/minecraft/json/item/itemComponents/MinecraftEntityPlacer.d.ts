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
 * Item Entity Placer (minecraft:entity_placer)
 * The entity_placer item component specifies the blocks that the
 * item can be placed on.
 */
export default interface MinecraftEntityPlacer {

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * dispensed on. If left empty, all blocks will be allowed.
   */
  dispense_on?: MinecraftEntityPlacerDispenseOn[];

  /**
   * @remarks
   * The entity to be placed in the world.
   * 
   * Sample Values:
   * Item Axe Turret Kit: "mikeamm_gwve:axe_turret"
   *
   * Item Bow Turret Kit: "mikeamm_gwve:bow_turret"
   *
   * Item Crossbow Turret Kit: "mikeamm_gwve:crossbow_turret"
   *
   */
  entity?: object;

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * used on. If left empty, all blocks will be allowed.
   * 
   * Sample Values:
   * My Sword Turtle: ["minecraft:sand"]
   *
   */
  use_on?: MinecraftEntityPlacerUseOn[];

}


/**
 * Dispense On (dispense_on)
 */
export interface MinecraftEntityPlacerDispenseOn {

  name?: string;

  states?: number;

  tags?: string;

}


/**
 * Use On (use_on)
 */
export interface MinecraftEntityPlacerUseOn {

  name?: string;

  states?: number;

  tags?: string;

}