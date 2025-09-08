// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:humidity
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Humidity (minecraft:humidity)
 * Forces a biome to ether always be humid or never humid. Humidity
 * effects the spread chance, and spread rate of fire in the 
 * biome.
 */
export default interface MinecraftHumidity {

  is_humid: boolean;

}