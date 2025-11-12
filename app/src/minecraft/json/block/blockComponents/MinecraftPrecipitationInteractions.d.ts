// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:precipitation_interactions
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Precipitation Interactions 
 * (minecraft:precipitation_interactions)
 * Component that determines how the block will interact with rain
 * and snow
Experimental toggles required: Upcoming Creator Features (in
 * format versions before 1.21.120).
 */
export default interface MinecraftPrecipitationInteractions {

  /**
   * @remarks
   * What behavior should the block have. Three possible values: obrain,
   * obstruct_rain_accumulate_snow and none
   */
  precipitation_behavior?: string;

}