// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Actions Documentation - minecraft:emit_particle
 * 
 * minecraft:emit_particle Samples
{
	"emit_particle": {
		"particle": "creakingcrumble"
	}
}
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Emit Particle (emit_particle)
 * Emits a particle specified via the particle attribute.
 */
export default interface EmitParticle {

  /**
   * @remarks
   * Identifier of the particle to emit.
   */
  particle?: string;

}