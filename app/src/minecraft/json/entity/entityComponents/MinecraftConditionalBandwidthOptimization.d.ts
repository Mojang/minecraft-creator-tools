// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:conditional_bandwidth_optimization
 * 
 * minecraft:conditional_bandwidth_optimization Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:conditional_bandwidth_optimization": {}


Arrow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/arrow.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 80,
    "max_dropped_ticks": 7,
    "use_motion_prediction_hints": true
  }
}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 60,
    "max_dropped_ticks": 20,
    "use_motion_prediction_hints": true
  },
  "conditional_values": [
    {
      "max_optimized_distance": 0,
      "max_dropped_ticks": 0,
      "use_motion_prediction_hints": true,
      "conditional_values": [
        {
          "test": "is_moving",
          "subject": "self"
        }
      ]
    }
  ]
}


Chest Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chest_minecart.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 60,
    "max_dropped_ticks": 20,
    "use_motion_prediction_hints": true
  },
  "conditional_values": [
    {
      "max_optimized_distance": 0,
      "max_dropped_ticks": 0,
      "conditional_values": [
        {
          "test": "is_moving",
          "subject": "self",
          "operator": "==",
          "value": true
        }
      ]
    }
  ]
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 80,
    "max_dropped_ticks": 10,
    "use_motion_prediction_hints": true
  }
}


Lingering Potion - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/lingering_potion.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 80,
    "max_dropped_ticks": 5,
    "use_motion_prediction_hints": true
  }
}


Snowball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snowball.json

"minecraft:conditional_bandwidth_optimization": {
  "default_values": {
    "max_optimized_distance": 100,
    "max_dropped_ticks": 7,
    "use_motion_prediction_hints": true
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Conditional Bandwidth Optimization
 * (minecraft:conditional_bandwidth_optimization)
 * Defines the Conditional Spatial Update Bandwidth Optimizations of
 * this entity.
 */
export default interface MinecraftConditionalBandwidthOptimization {

  /**
   * @remarks
   * The object containing the conditional bandwidth optimization 
   * values.
   * 
   * Sample Values:
   * Boat: [{"max_optimized_distance":0,"max_dropped_ticks":0,"use_motion_prediction_hints":true,"conditional_values":[{"test":"is_moving","subject":"self"}]}]
   *
   */
  conditional_values?: MinecraftConditionalBandwidthOptimizationConditionalValues[];

  /**
   * @remarks
   * The object containing the default bandwidth optimization 
   * values.
   */
  default_values?: MinecraftConditionalBandwidthOptimizationDefaultValues[];

}


/**
 * The object containing the conditional bandwidth optimization 
 * values.
 */
export interface MinecraftConditionalBandwidthOptimizationConditionalValues {

  /**
   * @remarks
   * Conditions that must be met for these optimization values to be
   * used.
   */
  conditional_values?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * In relation to the optimization value, determines the maximum ticks
   * spatial update packets can be not sent.
   */
  max_dropped_ticks?: number;

  /**
   * @remarks
   * The maximum distance considered during bandwidth optimizations. Any
   * value below the max is interpolated to find optimization, and
   * any value greater than or equal to this max results in max
   * optimization.
   */
  max_optimized_distance?: number;

  /**
   * @remarks
   * When set to true, smaller motion packets will be sent during drop
   * packet intervals, resulting in the same amount of packets being
   * sent as without optimizations but with much less data being sent.
   * This should be used when actors are travelling very quickly or
   * teleporting to prevent visual oddities.
   */
  use_motion_prediction_hints?: boolean;

}


/**
 * The object containing the default bandwidth optimization 
 * values.
 */
export interface MinecraftConditionalBandwidthOptimizationDefaultValues {

  /**
   * @remarks
   * In relation to the optimization value, determines the maximum ticks
   * spatial update packets can be not sent.
   */
  max_dropped_ticks?: number;

  /**
   * @remarks
   * The maximum distance considered during bandwidth optimizations. Any
   * value below the max is interpolated to find optimization, and
   * any value greater than or equal to this max results in max
   * optimization.
   */
  max_optimized_distance?: number;

  /**
   * @remarks
   * When set to true, smaller motion packets will be sent during drop
   * packet intervals, resulting in the same amount of packets being
   * sent as without optimizations but with much less data being sent.
   * This should be used when actors are travelling very quickly or
   * teleporting to prevent visual oddities.
   */
  use_motion_prediction_hints?: boolean;

}