// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:tamemount
 * 
 * minecraft:tamemount Samples

Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:tamemount": {
  "min_temper": 0,
  "max_temper": 100,
  "feed_text": "action.interact.feed",
  "ride_text": "action.interact.mount",
  "feed_items": [
    {
      "item": "wheat",
      "temper_mod": 3
    },
    {
      "item": "sugar",
      "temper_mod": 3
    },
    {
      "item": "apple",
      "temper_mod": 3
    },
    {
      "item": "carrot",
      "temper_mod": 3
    },
    {
      "item": "golden_carrot",
      "temper_mod": 5
    },
    {
      "item": "golden_apple",
      "temper_mod": 10
    },
    {
      "item": "appleEnchanted",
      "temper_mod": 10
    }
  ],
  "auto_reject_items": [
    {
      "item": "horsearmorleather"
    },
    {
      "item": "horsearmoriron"
    },
    {
      "item": "horsearmorgold"
    },
    {
      "item": "horsearmordiamond"
    },
    {
      "item": "minecraft:copper_horse_armor"
    },
    {
      "item": "minecraft:netherite_horse_armor"
    },
    {
      "item": "saddle"
    }
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:tamemount": {
  "min_temper": 0,
  "max_temper": 30,
  "feed_text": "action.interact.feed",
  "ride_text": "action.interact.mount",
  "feed_items": [
    {
      "item": "wheat",
      "temper_mod": 3
    },
    {
      "item": "hay_block",
      "temper_mod": 6
    }
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Trader Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/trader_llama.json

"minecraft:tamemount": {
  "min_temper": 0,
  "max_temper": 30,
  "feed_text": "action.interact.feed",
  "ride_text": "action.interact.mount",
  "feed_items": [
    {
      "item": "wheat",
      "temper_mod": 3
    },
    {
      "item": "hay_block",
      "temper_mod": 6
    }
  ],
  "auto_reject_items": [
    {
      "item": "horsearmorleather"
    },
    {
      "item": "horsearmoriron"
    },
    {
      "item": "horsearmorgold"
    },
    {
      "item": "horsearmordiamond"
    },
    {
      "item": "minecraft:copper_horse_armor"
    },
    {
      "item": "minecraft:netherite_horse_armor"
    },
    {
      "item": "saddle"
    }
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

"minecraft:tamemount": {
  "min_temper": 0,
  "max_temper": 100,
  "feed_text": "action.interact.feed",
  "ride_text": "action.interact.mount",
  "feed_items": [
    {
      "item": "red_mushroom",
      "temper_mod": 10
    }
  ],
  "auto_reject_items": [
    {
      "item": "horsearmorleather"
    },
    {
      "item": "horsearmoriron"
    },
    {
      "item": "horsearmorgold"
    },
    {
      "item": "horsearmordiamond"
    },
    {
      "item": "minecraft:copper_horse_armor"
    },
    {
      "item": "minecraft:netherite_horse_armor"
    },
    {
      "item": "saddle"
    }
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

"minecraft:tamemount": {
  "min_temper": 0,
  "max_temper": 30,
  "feed_text": "action.interact.feed",
  "ride_text": "action.interact.mount",
  "feed_items": [
    {
      "item": "wheat",
      "temper_mod": 3
    },
    {
      "item": "hay_block",
      "temper_mod": 6
    }
  ],
  "auto_reject_items": [
    {
      "item": "horsearmorleather"
    },
    {
      "item": "horsearmoriron"
    },
    {
      "item": "horsearmorgold"
    },
    {
      "item": "horsearmordiamond"
    },
    {
      "item": "saddle"
    }
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Tamemount (minecraft:tamemount)
 * Allows the Entity to be tamed by mounting it.
 */
export default interface MinecraftTamemount {

  /**
   * @remarks
   * The amount the entity's temper will increase when mounted.
   */
  attempt_temper_mod?: number;

  auto_reject_items?: MinecraftTamemountAutoRejectItems[];

  /**
   * @remarks
   * The list of items that, if carried while interacting with the
   * entity, will anger it.
   */
  autoRejectItems?: MinecraftTamemountAutoRejectItems[];

  /**
   * @remarks
   * The list of items that can be used to increase the entity's temper
   * and speed up the taming process.
   * 
   * Sample Values:
   * Donkey: [{"item":"wheat","temper_mod":3},{"item":"sugar","temper_mod":3},{"item":"apple","temper_mod":3},{"item":"carrot","temper_mod":3},{"item":"golden_carrot","temper_mod":5},{"item":"golden_apple","temper_mod":10},{"item":"appleEnchanted","temper_mod":10}]
   *
   */
  feed_items?: MinecraftTamemountFeedItems[];

  /**
   * @remarks
   * The text that shows in the feeding interact button.
   */
  feed_text?: string;

  /**
   * @remarks
   * The maximum value for the entity's random starting temper.
   */
  max_temper?: number;

  /**
   * @remarks
   * The minimum value for the entity's random starting temper.
   */
  min_temper?: number;

  /**
   * @remarks
   * The text that shows in the riding interact button.
   */
  ride_text?: string;

  /**
   * @remarks
   * Event that triggers when the entity becomes tamed.
   */
  tame_event?: jsoncommon.MinecraftEventTrigger;

}


/**
 * Auto reject items (auto_reject_items)
 */
export interface MinecraftTamemountAutoRejectItems {

  /**
   * @remarks
   * 
   * Sample Values:
   * Donkey: "horsearmorleather"
   *
   */
  item?: string;

}


/**
 * The list of items that, if carried while interacting with the
 * entity, will anger it.
 */
export interface MinecraftTamemountAutoRejectItems {

  /**
   * @remarks
   * Name of the item this entity dislikes and will cause it to get
   * angry if used while untamed.
   */
  item?: string;

}


/**
 * The list of items that can be used to increase the entity's temper
 * and speed up the taming process.
 */
export interface MinecraftTamemountFeedItems {

  /**
   * @remarks
   * Name of the item this entity likes and can be used to increase this
   * entity's temper.
   */
  item?: string;

  /**
   * @remarks
   * The amount of temper this entity gains when fed this item.
   */
  temper_mod?: number;

}