// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:entity_armor_equipment_slot_mapping
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Armor Equipment Slot Mapping
 * (minecraft:entity_armor_equipment_slot_mapping)
 * It defines to which armor slot an item equipped to
 * 'minecraft:equippable''s second slot should be equipped to. It
 * is automatically applied to all entities for worlds with a
 * version greater than or equal to 1.21.10. For older worlds,
 * 'slot.armor.torso' will be used. It is strongly advised not to
 * explicitly use this component, as no backwards compatibility for
 * it will be provided.
 */
export default interface MinecraftEntityArmorEquipmentSlotMapping {

  /**
   * @remarks
   * The armor slot an item equipped to 'minecraft:equippable''s second
   * slot should be equipped to. It defaults to 'slot.armor.torso' for
   * entities with a format version prior to 1.21.10, and to
   * 'slot.armor.body' otherwise.
   */
  armor_slot?: string;

}