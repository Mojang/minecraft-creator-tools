// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:color_grading_identifier
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Color Grading Identifier Client Biome
 * (minecraft:color_grading_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the color_grading settings used
 * during deferred rendering. Biomes without this component will
 * have default color_grading settings.
 */
export default interface MinecraftColorGradingIdentifier {

  /**
   * @remarks
   * Identifier of color_grading definition to use
   */
  color_grading_identifier: string;

}