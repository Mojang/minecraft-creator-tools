// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:randomize_node
 * 
 * minecraft:randomize_node Samples
""randomize": [
			{
				"weight": <float>
				// actions like 'add' or 'remove'
			}
		]
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Randomize Node (randomize_node)
 * The 'randomize' node is an array node that will pick one entry to
 * execute, based on a weight.
		If no weight is specified, a
 * node will have a weight of 1.0.
		If you add a weight of 4.0 in
 * one node, and 8.0 in another, then those nodes will have a
 * 33.33% (4 / (4 + 8)) and 66.66% (8 / (4 + 8)) chance of
 * executing, respectively.
 */
export default interface RandomizeNode {

}