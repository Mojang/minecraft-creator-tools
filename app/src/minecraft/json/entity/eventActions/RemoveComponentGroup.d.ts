// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:remove_component_group
 * 
 * minecraft:remove_component_group Samples
""sequence": [
			{
				"remove": { "component_groups": [ "one" ] }
			},
			{
				"remove": { "component_groups": [ "two", "five", "etc.." ] }
			}
		]
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Remove Component Group (remove_component_group)
 * Removes component groups from the current entity. This can be
 * any group you have defined in the 'component_groups' section of
 * the file.
 */
export default interface RemoveComponentGroup {

}