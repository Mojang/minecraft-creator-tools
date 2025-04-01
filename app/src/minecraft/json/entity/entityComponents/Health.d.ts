// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:health
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Health
 * Default and maximum health settings.
 */
export default interface Health {

  max: number;

  value: number;

}