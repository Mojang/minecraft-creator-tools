// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Rule Documentation - minecraft:feature_rule_definition
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Feature Rule Definition
 * Feature Rule Definition.
 */
export default interface FeatureRuleDefinition {

  /**
   * @remarks
   * Parameters to control where and when the feature will be
   * placed.
   */
  conditions?: object;

  /**
   * @remarks
   * Identifier for the Feature Rule and Feture to place.
   */
  description?: object;

  /**
   * @remarks
   * Parameters controlling the initial scatter of the feature.
   */
  distribution?: FeatureRuleDefinitionDistribution;

}


/**
 * Distribution
 * Controls the scatter distribution of a particular object.
 */
export interface FeatureRuleDefinitionDistribution {

  /**
   * @remarks
   * The order in which coordinates will be evaluated. Should be
   * used when a coordinate depends on another. If omitted, defaults to
   * "xzy". Supported orders are defined by "Coordinate Evaluation 
   * Order".
   */
  coordinate_eval_order?: string;

  /**
   * @remarks
   * Number of scattered positions to generate.
   */
  iterations?: FeatureRuleDefinitionDistributionIterations;

  /**
   * @remarks
   * Probability that this scatter will occur. Not evaluated each
   * iteration; either no iterations will run, or all will.
   */
  scatter_chance?: FeatureRuleDefinitionDistributionScatterChance;

  /**
   * @remarks
   * Distribution for the coordinate (evaluated each iteration).
   */
  x?: FeatureRuleDefinitionDistributionx;

  /**
   * @remarks
   * Distribution for the coordinate (evaluated each iteration).
   */
  y?: FeatureRuleDefinitionDistributiony;

  /**
   * @remarks
   * Distribution for the coordinate (evaluated each iteration).
   */
  z?: FeatureRuleDefinitionDistributionz;

}


/**
 * Iterations
 * Iterations
 */
export interface FeatureRuleDefinitionDistributionIterations {

}


/**
 * Scatter Chance
 * Scatter probability represented by an expression or an object with
 * a numerator and denominator.
 */
export interface FeatureRuleDefinitionDistributionScatterChance {

}


/**
 * X
 * Represents the scatter distrubution over a coordinate (x/y/z), can
 * also be built by an expression.
 */
export interface FeatureRuleDefinitionDistributionx {

}


/**
 * Y
 * Represents the scatter distrubution over a coordinate (x/y/z), can
 * also be built by an expression.
 */
export interface FeatureRuleDefinitionDistributiony {

}


/**
 * Z
 * Represents the scatter distrubution over a coordinate (x/y/z), can
 * also be built by an expression.
 */
export interface FeatureRuleDefinitionDistributionz {

}