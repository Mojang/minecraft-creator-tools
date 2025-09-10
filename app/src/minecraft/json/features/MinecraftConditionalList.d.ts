// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:conditional_list
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Conditional List (minecraft:conditional_list)
 * IMPORTANT
 * This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content.
 * 
 */
export default interface MinecraftConditionalList {

  conditional_features?: MinecraftConditionalListConditionalFeatures[];

  description: MinecraftConditionalListDescription;

  /**
   * @remarks
   * Denote whether placement should end on first successful placement or
   * first passed condition.
   */
  early_out_schemeLessThancondition_successplacement_success?: string;

  format_version?: string;

}


/**
 */
export interface MinecraftConditionalListConditionalFeatures {

  /**
   * @remarks
   * Condition for placing associated Feature
   */
  condition: string;

}


/**
 */
export interface MinecraftConditionalListDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}