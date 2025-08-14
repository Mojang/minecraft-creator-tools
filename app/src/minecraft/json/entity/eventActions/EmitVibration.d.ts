// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:emit_vibration
 * 
 * minecraft:emit_vibration Samples
{
	"emit_vibration": {
		"vibration": "entity_act"
	}
}
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Emit Vibration (emit_vibration)
 * Allows the entity to emit a vibration having the entity itself as
 * its source.
 */
export default interface EmitVibration {

  vibration: string;

}


export enum EmitVibrationVibration {
  EntityInteract = `entity_interact`,
  EntityAct = `entity_act`,
  EntityDie = `entity_die`
}