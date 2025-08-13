// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:trigger
 * 
 * minecraft:trigger Samples
""sample:spawn_adult": {
			// add adult component groups
		},
		"sample:spawn_baby": {
			// add baby component groups
		},
		"minecraft:entity_spawned": {
			"randomize": [
				{
					"weight": 50.0,
					"trigger": "sample:spawn_adult"
				},
				{
					"weight": 50.0,
					"trigger": "sample:spawn_baby"
				}
			]
		}
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Trigger (trigger)
 * Triggers additional entity events when hit. For example, you
 * could use a randomize node in minecraft:entity_spawned to
 * choose either an adult or baby event for adding component 
 * groups.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface Trigger {

}