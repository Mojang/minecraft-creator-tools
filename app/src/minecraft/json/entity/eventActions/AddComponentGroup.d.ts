// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:add_component_group
 * 
 * minecraft:add_component_group Samples
""sequence": [
			{
				"add": { "component_groups": [ "one" ] }
			},
			{
				"add": { "component_groups": [ "two", "five", "etc.." ] }
			}
		]
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Add Component Group (add_component_group)
 * Adds component groups to the current entity. These groups must be
 * defined in the 'component_groups' section of the file. As
 * entities can only have one component of each type active, any
 * components in a group that is being added will replace previously added
 * components. Additionally, adding a component group that is
 * already active will cause those components to be
 * re-initialized. For some types of components like
 * minecraft:is_baby, re-initializing an already active component has
 * no effect, but for other component types the associated logic will
 * start over. For example, an already-added minecraft:timer that is
 * added again will start its timing logic over.
 */
export default interface AddComponentGroup {

}