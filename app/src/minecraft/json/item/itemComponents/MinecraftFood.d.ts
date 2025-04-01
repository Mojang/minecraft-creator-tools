// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:food
 * 
 * minecraft:food Samples
"minecraft:food": {
  "can_always_eat": false,
  "nutrition": 3,
  "saturation_modifier": 0.6,
  "using_converts_to": "bowl"
}


Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:food": {
  "nutrition": 4,
  "saturation_modifier": 0.3
}


AppleEnchanted - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/appleEnchanted.json

"minecraft:food": {
  "nutrition": 4,
  "saturation_modifier": "supernatural",
  "can_always_eat": true,
  "effects": [
    {
      "name": "regeneration",
      "chance": 1,
      "duration": 30,
      "amplifier": 1
    },
    {
      "name": "absorption",
      "chance": 1,
      "duration": 120,
      "amplifier": 3
    },
    {
      "name": "resistance",
      "chance": 1,
      "duration": 300,
      "amplifier": 0
    },
    {
      "name": "fire_resistance",
      "chance": 1,
      "duration": 300,
      "amplifier": 0
    }
  ]
}


Baked Potato - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/baked_potato.json

"minecraft:food": {
  "nutrition": 5,
  "saturation_modifier": "normal"
}


Beef - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/beef.json

"minecraft:food": {
  "nutrition": 3,
  "saturation_modifier": "low"
}


Beetroot Soup - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/beetroot_soup.json

"minecraft:food": {
  "nutrition": 6,
  "saturation_modifier": "normal",
  "using_converts_to": "bowl"
}


Beetroot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/beetroot.json

"minecraft:food": {
  "nutrition": 1,
  "saturation_modifier": "normal"
}


Carrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/carrot.json

"minecraft:food": {
  "nutrition": 3,
  "saturation_modifier": "normal"
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/chicken.json

"minecraft:food": {
  "nutrition": 2,
  "saturation_modifier": "low",
  "effects": [
    {
      "name": "hunger",
      "chance": 0.3,
      "duration": 30,
      "amplifier": 0
    }
  ]
}


Chorus Fruit - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/chorus_fruit.json

"minecraft:food": {
  "nutrition": 4,
  "saturation_modifier": "low",
  "on_use_action": "chorus_teleport",
  "on_use_range": [
    8,
    8,
    8
  ],
  "cooldown_type": "chorusfruit",
  "cooldown_time": 20,
  "can_always_eat": true
}


Clownfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/clownfish.json

"minecraft:food": {
  "nutrition": 1,
  "saturation_modifier": "poor"
}


Cooked Beef - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/cooked_beef.json

"minecraft:food": {
  "nutrition": 8,
  "saturation_modifier": "good"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Food (minecraft:food)
 * Sets the item as a food component, allowing it to be edible to
 * the player.
 */
export default interface MinecraftFood {

  /**
   * @remarks
   * If true you can always eat this item (even when not hungry). Default
   * is set to false.
   * 
   * Sample Values:
   * AppleEnchanted: true
   *
   *
   */
  can_always_eat: boolean;

  cooldown_time: number;

  cooldown_type: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * AppleEnchanted: [{"name":"regeneration","chance":1,"duration":30,"amplifier":1},{"name":"absorption","chance":1,"duration":120,"amplifier":3},{"name":"resistance","chance":1,"duration":300,"amplifier":0},{"name":"fire_resistance","chance":1,"duration":300,"amplifier":0}]
   *
   * Chicken: [{"name":"hunger","chance":0.3,"duration":30,"amplifier":0}]
   *
   */
  effects: MinecraftFoodEffects[];

  is_meat: string;

  /**
   * @remarks
   * Value that is added to the entity's nutrition when the item is
   * used. Default is set to 0.
   * 
   * Sample Values:
   * Apple: 4
   *
   *
   * Baked Potato: 5
   *
   * Beef: 3
   *
   */
  nutrition: number;

  on_use_action: jsoncommon.MinecraftEventTrigger;

  on_use_range: jsoncommon.MinecraftEventTrigger;

  remove_effects: string[];

  /**
   * @remarks
   * saturation_modifier is used in this formula: (nutrition *
   * saturation_modifier * 2) when applying the saturation buff.
   * Default is set to 0.6.
   * 
   * Sample Values:
   * Apple: 0.3
   *
   * AppleEnchanted: "supernatural"
   *
   * Baked Potato: "normal"
   *
   */
  saturation_modifier: number;

  /**
   * @remarks
   * When used, converts to the item specified by the string in this
   * field. Default does not convert item.
   * 
   * Sample Values:
   * Beetroot Soup: "bowl"
   *
   * Honey Bottle: "glass_bottle"
   *
   *
   */
  using_converts_to: string;

}


/**
 * Effects (effects)
 */
export interface MinecraftFoodEffects {

  /**
   * @remarks
   * 
   * Sample Values:
   * AppleEnchanted: 1
   *
   */
  amplifier: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * AppleEnchanted: 1
   *
   */
  chance: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * AppleEnchanted: 30
   *
   */
  duration: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * AppleEnchanted: "regeneration"
   *
   */
  name: string;

}