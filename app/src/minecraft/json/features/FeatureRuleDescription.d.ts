// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Rule Documentation - minecraft:feature_rule_description
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Feature Rule Description
 * Feature Rule Description.
 */
export default interface FeatureRuleDescription {

  /**
   * @remarks
   * The name of this feature rule in the format
   * 'namespace_name:rule_name'. 'rule_name' must match the 
   * filename.
   */
  identifier: string;

  /**
   * @remarks
   * Named reference to the feature controlled by this rule.
   */
  places_feature: string;

}