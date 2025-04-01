// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:ageable
 * 
 * minecraft:ageable Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:ageable": {
  "duration": 1200,
  "interact_filters": {
    "test": "enum_property",
    "domain": "minecraft:armadillo_state",
    "value": "unrolled"
  },
  "feed_items": "spider_eye",
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": "tropical_fish_bucket",
  "transform_to_item": "water_bucket:0",
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "minecraft:poppy",
    "minecraft:blue_orchid",
    "minecraft:allium",
    "minecraft:azure_bluet",
    "minecraft:red_tulip",
    "minecraft:orange_tulip",
    "minecraft:white_tulip",
    "minecraft:pink_tulip",
    "minecraft:oxeye_daisy",
    "minecraft:cornflower",
    "minecraft:lily_of_the_valley",
    "minecraft:dandelion",
    "minecraft:wither_rose",
    "minecraft:sunflower",
    "minecraft:lilac",
    "minecraft:rose_bush",
    "minecraft:peony",
    "minecraft:flowering_azalea",
    "minecraft:azalea_leaves_flowered",
    "minecraft:mangrove_propagule",
    "minecraft:pitcher_plant",
    "minecraft:torchflower",
    "minecraft:cherry_leaves",
    "minecraft:pink_petals",
    "minecraft:wildflowers",
    "minecraft:cactus_flower"
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": "cactus",
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "fish",
    "salmon"
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "wheat_seeds",
    "beetroot_seeds",
    "melon_seeds",
    "pumpkin_seeds",
    "pitcher_pod",
    "torchflower_seeds"
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": "wheat",
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "fish",
    "salmon"
  ],
  "grow_up": {
    "event": "ageable_grow_up",
    "target": "self"
  }
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    {
      "item": "wheat",
      "growth": 0.016667
    },
    {
      "item": "sugar",
      "growth": 0.025
    },
    {
      "item": "hay_block",
      "growth": 0.15
    },
    {
      "item": "apple",
      "growth": 0.05
    },
    {
      "item": "golden_carrot",
      "growth": 0.05
    },
    {
      "item": "golden_apple",
      "growth": 0.2
    },
    {
      "item": "appleEnchanted",
      "growth": 0.2
    }
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "sweet_berries",
    "glow_berries"
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    "crimson_fungus"
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:ageable": {
  "duration": 1200,
  "feed_items": [
    {
      "item": "wheat",
      "growth": 0.1
    },
    {
      "item": "hay_block",
      "growth": 0.9
    }
  ],
  "grow_up": {
    "event": "minecraft:ageable_grow_up",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Ageable (minecraft:ageable)
 * Adds a timer for the entity to grow up. It can be accelerated by
 * giving the entity the items it likes as defined by 
 * feed_items.
 */
export default interface MinecraftAgeable {

  /**
   * @remarks
   * List of items that the entity drops when it grows up.
   * 
   * Sample Values:
   * Turtle: ["turtle_shell_piece"]
   *
   *
   */
  drop_items: string[];

  /**
   * @remarks
   * Length of time before an entity grows up (-1 to always stay a
   * baby)
   * 
   * Sample Values:
   * Armadillo: 1200
   *
   *
   * Sniffer: 2400
   *
   */
  duration: number;

  /**
   * @remarks
   * List of items that can be fed to the entity. Includes 'item' for
   * the item name and 'growth' to define how much time it grows up
   * by.
   * 
   * Sample Values:
   * Armadillo: "spider_eye"
   *
   * Axolotl: "tropical_fish_bucket"
   *
   * Bee: ["minecraft:poppy","minecraft:blue_orchid","minecraft:allium","minecraft:azure_bluet","minecraft:red_tulip","minecraft:orange_tulip","minecraft:white_tulip","minecraft:pink_tulip","minecraft:oxeye_daisy","minecraft:cornflower","minecraft:lily_of_the_valley","minecraft:dandelion","minecraft:wither_rose","minecraft:sunflower","minecraft:lilac","minecraft:rose_bush","minecraft:peony","minecraft:flowering_azalea","minecraft:azalea_leaves_flowered","minecraft:mangrove_propagule","minecraft:pitcher_plant","minecraft:torchflower","minecraft:cherry_leaves","minecraft:pink_petals","minecraft:wildflowers","minecraft:cactus_flower"]
   *
   */
  feed_items: string[];

  feedItems: string[];

  /**
   * @remarks
   * Event to run when this entity grows up.
   * 
   * Sample Values:
   * Armadillo: {"event":"minecraft:ageable_grow_up","target":"self"}
   *
   *
   * Dolphin: {"event":"ageable_grow_up","target":"self"}
   *
   * Rabbit: {"event":"grow_up","target":"self"}
   *
   */
  grow_up: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * List of conditions to meet so that the entity can be fed.
   * 
   * Sample Values:
   * Armadillo: {"test":"enum_property","domain":"minecraft:armadillo_state","value":"unrolled"}
   *
   */
  interact_filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The feed item used will transform to this item upon successful
   * interaction. Format: itemName:auxValue
   * 
   * Sample Values:
   * Axolotl: "water_bucket:0"
   *
   */
  transform_to_item: string[];

}