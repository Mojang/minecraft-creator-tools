// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:dyeable
 * 
 * minecraft:dyeable Samples
"minecraft:dyeable": {
  "default_color": "#175882"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Dyeable (minecraft:dyeable)
 * Enables custom items to be dyed in cauldrons. To use the dyeable
 * component, the format version on the item and the attachable needs
 * to have a format_version of 1.21.30 or greater.
 */
export default interface MinecraftDyeable {

  /**
   * @remarks
   * default_color
   */
  default_color: string;

}