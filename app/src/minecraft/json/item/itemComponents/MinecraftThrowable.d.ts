// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:throwable
 * 
 * minecraft:throwable Samples

Wind Charge - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wind_charge.json

"minecraft:throwable": {
  "do_swing_animation": true,
  "launch_power_scale": 1.5,
  "max_launch_power": 1.5
}


My Sword Chuck - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_chuck.json

"minecraft:throwable": {
  "do_swing_animation": true,
  "launch_power_scale": 1,
  "max_draw_duration": 0,
  "max_launch_power": 1,
  "min_draw_duration": 0,
  "scale_power_by_draw_duration": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Throwable Item (minecraft:throwable)
 * Sets the throwable item component.
 */
export default interface MinecraftThrowable {

  /**
   * @remarks
   * Determines whether the item should use the swing animation when
   * thrown. Default is set to false.
   * 
   * Sample Values:
   * Wind Charge: true
   *
   *
   */
  do_swing_animation: boolean;

  /**
   * @remarks
   * The scale at which the power of the throw increases. Default is
   * set to 1.0.
   * 
   * Sample Values:
   * Wind Charge: 1.5
   *
   * My Sword Chuck: 1
   *
   */
  launch_power_scale: number;

  /**
   * @remarks
   * The maximum duration to draw a throwable item. Default is set to
   * 0.0.
   */
  max_draw_duration: number;

  /**
   * @remarks
   * The maximum power to launch the throwable item. Default is set
   * to 1.0.
   * 
   * Sample Values:
   * Wind Charge: 1.5
   *
   * My Sword Chuck: 1
   *
   */
  max_launch_power: number;

  /**
   * @remarks
   * The minimum duration to draw a throwable item. Default is set to
   * 0.0.
   */
  min_draw_duration: number;

  /**
   * @remarks
   * Whether or not the power of the throw increases with duration
   * charged. Default is set to false.
   */
  scale_power_by_draw_duration: boolean;

}