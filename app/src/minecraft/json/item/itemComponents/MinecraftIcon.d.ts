// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:icon
 * 
 * minecraft:icon Samples
"minecraft:icon": {
  "textures": "oak_slab"
}


Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:icon": {
  "texture": "apple"
}


Black Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/black_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_black"
  }
}


Blue Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/blue_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_blue"
  }
}


Breeze Rod - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/breeze_rod.json

"minecraft:icon": {
  "texture": "breeze_rod"
}


Brown Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/brown_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_brown"
  }
}


Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle"
  }
}


Cyan Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/cyan_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_cyan"
  }
}


Gray Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/gray_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_gray"
  }
}


Green Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/green_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_green"
  }
}


Light Blue Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/light_blue_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_light_blue"
  }
}


Light Gray Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/light_gray_bundle.json

"minecraft:icon": {
  "textures": {
    "default": "bundle_light_gray"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Icon (minecraft:icon)
 * Determines the icon to represent the item in the UI and
 * elsewhere.
 */
export default interface MinecraftIcon {

  /**
   * @remarks
   * 
   * Sample Values:
   * Apple: "apple"
   *
   * Breeze Rod: "breeze_rod"
   *
   * Ominous Trial Key: "ominous_trial_key"
   *
   */
  texture: string;

  /**
   * @remarks
   * This map contains the different textures that can be used for
   * the item's icon. Default will contain the actual icon texture. Armor
   * trim textures and palettes can be specified here as well. The
   * icon textures are the keys from the
   * resource_pack/textures/item_texture.json 'texture_data' object
   * associated with the texture file.
   * 
   * Sample Values:
   * Black Bundle: {"default":"bundle_black"}
   *
   * Blue Bundle: {"default":"bundle_blue"}
   *
   * Brown Bundle: {"default":"bundle_brown"}
   *
   */
  textures: string;

}