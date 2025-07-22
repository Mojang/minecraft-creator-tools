// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:projectile
 * 
 * minecraft:projectile Samples
"minecraft:projectile": {
  "minimum_critical_power": 1.25,
  "projectile_entity": "arrow"
}


Wind Charge - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wind_charge.json

"minecraft:projectile": {
  "projectile_entity": "wind_charge_projectile"
}


My Sword Chuck - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_chuck.json

"minecraft:projectile": {
  "minimum_critical_power": 1.25,
  "projectile_entity": "minecraft:snowball"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Projectile Item (minecraft:projectile)
 * Compels the item to shoot, similarly to an arrow. Items with
 * minecraft:projectile can be shot from dispensers or used as
 * ammunition for items with the minecraft:shooter item component.
 * Additionally, this component sets the entity that is spawned for
 * items that also contain the minecraft:throwable component.
 */
export default interface MinecraftProjectile {

  /**
   * @remarks
   * Specifies how long a player must charge a projectile for it to
   * critically hit.
   * 
   * Sample Values:
   * My Sword Chuck: 1.25
   *
   *
   */
  minimum_critical_power: number;

  /**
   * @remarks
   * Which entity is to be fired as a projectile.
   * 
   * Sample Values:
   * Wind Charge: "wind_charge_projectile"
   *
   * My Sword Chuck: "minecraft:snowball"
   *
   *
   */
  projectile_entity: string;

}