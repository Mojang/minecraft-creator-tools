// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:scale
 * 
 * minecraft:scale Samples

Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/1_hello_world/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:scale": {
  "value": 0.5
}


Nardolphle - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/nardolphle.behavior.json

"minecraft:scale": {
  "value": 0.16
}


Eliza - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/custom_cat_eliza/behavior_packs/mike_eliz/entities/eliza.json

 * At /minecraft:entity/component_groups/mike_eliz:eliza_baby/minecraft:scale/: 
"minecraft:scale": {
  "value": 0.4
}

 * At /minecraft:entity/component_groups/mike_eliz:eliza_adult/minecraft:scale/: 
"minecraft:scale": {
  "value": 0.8
}


Gray Zombie Leader - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/gray_zombie_leader.behavior.json

"minecraft:scale": {
  "value": 1.3
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Scale (minecraft:scale)
 * Sets the entity's visual size.
 */
export default interface MinecraftScale {

  /**
   * @remarks
   * The value of the scale. 1.0 means the entity will appear at the
   * scale they are defined in their model. Higher numbers make the
   * entity bigger.
   * 
   * Sample Values:
   * Sheepomelon: 0.5
   *
   *
   * Nardolphle: 0.16
   *
   *
   * Eliza: 0.4, 0.8
   *
   */
  value?: number;

}