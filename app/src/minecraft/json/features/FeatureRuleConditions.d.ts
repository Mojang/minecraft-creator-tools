// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Rule Documentation - minecraft:feature_rule_conditions
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Feature Rule Conditions
 * Feature Rule Conditions.
 */
export default interface FeatureRuleConditions {

  /**
   * @remarks
   * List of filter tests to determine which biomes this rule will
   * attach to.
   */
  "minecraft:biome_filter"?: FeatureRuleConditionsMinecraftBiomeFilter;

  /**
   * @remarks
   * When the feature should be placed relative to others. Earlier passes
   * in the list are guaranteed to occur before later passes. Order is
   * not guaranteed within each pass.
   */
  placement_pass?: string;

}


/**
 * Biome Filter
 * Filters allow data objects to specify test criteria which allows
 * their use. Filters can be defined by a single object of type
 * (Filter Test), an array of tests, collection groups, or a
 * combination of these objects.
 */
export interface FeatureRuleConditionsMinecraftBiomeFilter {

}