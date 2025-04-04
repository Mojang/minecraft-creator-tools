// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:skin_id
 * 
 * minecraft:skin_id Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/villager_skin_0/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 0
}

 * At /minecraft:entity/component_groups/villager_skin_1/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 1
}

 * At /minecraft:entity/component_groups/villager_skin_2/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 2
}

 * At /minecraft:entity/component_groups/villager_skin_3/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 3
}

 * At /minecraft:entity/component_groups/villager_skin_4/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 4
}

 * At /minecraft:entity/component_groups/villager_skin_5/minecraft:skin_id/: 
"minecraft:skin_id": {
  "value": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Skin Id (minecraft:skin_id)
 * Skin ID value. Can be used to differentiate skins, such as base
 * skins for villagers.
 * Note: Requires multiple texture sets to be set up for the
 * entity.
 */
export default interface MinecraftSkinId {

  /**
   * @remarks
   * The ID of the skin. By convention, 0 is the ID of the base 
   * skin.
   * 
   * Sample Values:
   * Villager V2: 1, 2, 3, 4, 5
   *
   */
  value: number;

}