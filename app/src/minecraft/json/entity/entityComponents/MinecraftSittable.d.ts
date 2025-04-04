// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:sittable
 * 
 * minecraft:sittable Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:sittable": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Sittable (minecraft:sittable)
 * Defines the entity's 'sit' state.
 */
export default interface MinecraftSittable {

  /**
   * @remarks
   * Event to run when the entity enters the 'sit' state
   */
  sit_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when the entity exits the 'sit' state
   */
  stand_event: jsoncommon.MinecraftEventTrigger;

}