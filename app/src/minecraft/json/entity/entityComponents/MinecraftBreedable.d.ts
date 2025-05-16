// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:breedable
 * 
 * minecraft:breedable Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:breedable": {
  "love_filters": {
    "test": "enum_property",
    "domain": "minecraft:armadillo_state",
    "value": "unrolled"
  },
  "require_tame": false,
  "breeds_with": [
    {
      "mate_type": "minecraft:armadillo",
      "baby_type": "minecraft:armadillo",
      "breed_event": {
        "event": "minecraft:entity_born",
        "target": "baby"
      }
    }
  ],
  "breed_items": [
    "spider_eye"
  ]
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:breedable": {
  "require_tame": false,
  "breed_items": "tropical_fish_bucket",
  "transform_to_item": "water_bucket:0",
  "breeds_with": {
    "mate_type": "minecraft:axolotl",
    "baby_type": "minecraft:axolotl",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "mutation_factor": {
    "variant": 0.00083
  }
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:breedable": {
  "require_tame": false,
  "breeds_with": {
    "mate_type": "minecraft:bee",
    "baby_type": "minecraft:bee",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "breed_items": [
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
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:breedable": {
  "require_tame": false,
  "breeds_with": [
    {
      "mate_type": "minecraft:camel",
      "baby_type": "minecraft:camel",
      "breed_event": {
        "event": "minecraft:entity_born",
        "target": "baby"
      }
    }
  ],
  "breed_items": [
    "cactus"
  ]
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:breedable": {
  "require_tame": true,
  "require_full_health": true,
  "allow_sitting": true,
  "combine_parent_colors": true,
  "breeds_with": {
    "mate_type": "minecraft:cat",
    "baby_type": "minecraft:cat",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "breed_items": [
    "fish",
    "salmon"
  ]
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:breedable": {
  "require_tame": false,
  "breeds_with": {
    "mate_type": "minecraft:chicken",
    "baby_type": "minecraft:chicken",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "breed_items": [
    "wheat_seeds",
    "beetroot_seeds",
    "melon_seeds",
    "pumpkin_seeds",
    "pitcher_pod",
    "torchflower_seeds"
  ],
  "property_inheritance": {
    "minecraft:climate_variant": {}
  }
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:breedable": {
  "require_tame": false,
  "breed_items": "wheat",
  "breeds_with": {
    "mate_type": "minecraft:cow",
    "baby_type": "minecraft:cow",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "property_inheritance": {
    "minecraft:climate_variant": {}
  }
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:breedable": {
  "parent_centric_attribute_blending": [
    "minecraft:health"
  ],
  "require_tame": true,
  "inherit_tamed": false,
  "breeds_with": [
    {
      "mate_type": "minecraft:donkey",
      "baby_type": "minecraft:donkey",
      "breed_event": {
        "event": "minecraft:entity_born",
        "target": "baby"
      }
    },
    {
      "mate_type": "minecraft:horse",
      "baby_type": "minecraft:mule",
      "breed_event": {
        "event": "minecraft:entity_born",
        "target": "baby"
      }
    }
  ],
  "breed_items": [
    "golden_carrot",
    "golden_apple",
    "appleEnchanted"
  ]
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:breedable": {
  "require_tame": false,
  "breed_items": [
    "sweet_berries",
    "glow_berries"
  ],
  "breeds_with": {
    "mate_type": "minecraft:fox",
    "baby_type": "minecraft:fox",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  }
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:breedable": {
  "require_tame": false,
  "causes_pregnancy": true,
  "breeds_with": {
    "mate_type": "minecraft:frog",
    "baby_type": "minecraft:tadpole",
    "breed_event": {
      "event": "become_pregnant"
    }
  },
  "breed_items": [
    "slime_ball"
  ]
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:breedable": {
  "require_tame": false,
  "breed_items": "wheat",
  "breeds_with": {
    "mate_type": "minecraft:goat",
    "baby_type": "minecraft:goat",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "mutation_factor": {
    "variant": 0
  }
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:breedable": {
  "require_tame": false,
  "love_filters": {
    "test": "has_component",
    "subject": "self",
    "operator": "not",
    "value": "minecraft:attack_cooldown"
  },
  "breeds_with": {
    "mate_type": "minecraft:hoglin",
    "baby_type": "minecraft:hoglin",
    "breed_event": {
      "event": "minecraft:entity_born",
      "target": "baby"
    }
  },
  "breed_items": [
    "crimson_fungus"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Breedable (minecraft:breedable)
 * Allows an entity to establish a way to get into the love state
 * used for breeding.
 * Note: This component is commonly used in conjunction with the
 * 'minecraft:behavior.breed' component.
 */
export default interface MinecraftBreedable {

  /**
   * @remarks
   * If true, entities can breed while sitting
   * 
   * Sample Values:
   * Cat: true
   *
   *
   */
  allow_sitting: boolean;

  /**
   * @remarks
   * If true, the entities will blend their attributes in the
   * offspring after they breed. For example, horses blend their
   * health, movement, and jump_strength in their offspring.
   */
  blend_attributes: boolean;

  /**
   * @remarks
   * Time in seconds before the Entity can breed again.
   */
  breed_cooldown: number;

  /**
   * @remarks
   * The list of items that can be used to get the entity into the
   * 'love' state.
   * 
   * Sample Values:
   * Armadillo: ["spider_eye"]
   *
   * Axolotl: "tropical_fish_bucket"
   *
   * Bee: ["minecraft:poppy","minecraft:blue_orchid","minecraft:allium","minecraft:azure_bluet","minecraft:red_tulip","minecraft:orange_tulip","minecraft:white_tulip","minecraft:pink_tulip","minecraft:oxeye_daisy","minecraft:cornflower","minecraft:lily_of_the_valley","minecraft:dandelion","minecraft:wither_rose","minecraft:sunflower","minecraft:lilac","minecraft:rose_bush","minecraft:peony","minecraft:flowering_azalea","minecraft:azalea_leaves_flowered","minecraft:mangrove_propagule","minecraft:pitcher_plant","minecraft:torchflower","minecraft:cherry_leaves","minecraft:pink_petals","minecraft:wildflowers","minecraft:cactus_flower"]
   *
   */
  breed_items: string[];

  /**
   * @remarks
   * The list of entity definitions that this entity can breed 
   * with.
   * 
   * Sample Values:
   * Armadillo: [{"mate_type":"minecraft:armadillo","baby_type":"minecraft:armadillo","breed_event":{"event":"minecraft:entity_born","target":"baby"}}]
   *
   * Axolotl: {"mate_type":"minecraft:axolotl","baby_type":"minecraft:axolotl","breed_event":{"event":"minecraft:entity_born","target":"baby"}}
   *
   * Bee: {"mate_type":"minecraft:bee","baby_type":"minecraft:bee","breed_event":{"event":"minecraft:entity_born","target":"baby"}}
   *
   */
  breeds_with: MinecraftBreedableBreedsWith[];

  /**
   * @remarks
   * If true, the entity will become pregnant instead of spawning a
   * baby.
   */
  causes_pregnancy: boolean;

  combine_parent_colors: string;

  /**
   * @remarks
   * Determines how likely the baby of parents with the same variant will
   * deny that variant and take a random variant within the given range
   * instead.
   */
  deny_parents_variant: MinecraftBreedableDenyParentsVariant;

  /**
   * @remarks
   * The list of nearby block requirements to get the entity into the
   * 'love' state.
   */
  environment_requirements: MinecraftBreedableEnvironmentRequirements[];

  /**
   * @remarks
   * Chance that up to 16 babies will spawn.
   */
  extra_baby_chance: number[];

  /**
   * @remarks
   * If true, the babies will be automatically tamed if its parents 
   * are.
   */
  inherit_tamed: boolean;

  /**
   * @remarks
   * The filters to run when attempting to fall in love.
   */
  love_filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Determines how likely the babies are to NOT inherit one of
   * their parent's variances.
   */
  mutation_factor: MinecraftBreedableMutationFactor;

  /**
   * @remarks
   * Strategy used for mutating variants and extra variants for
   * offspring. Current valid alternatives are 'random' and 
   * 'none'.
   */
  mutation_strategy: string;

  /**
   * @remarks
   *  [EXPERIMENTAL] List of attributes that should benefit from
   * parent centric attribute blending. For example, horses blend their
   * health, movement, and jump_strength in their offspring.
   */
  parent_centric_attribute_blending: string[];

  /**
   * @remarks
   * List of Entity Properties that should be inherited from the
   * parent entities and potentially mutated.
   */
  property_inheritance: string[];

  /**
   * @remarks
   * Range used to determine random extra variant.
   */
  random_extra_variant_mutation_interval: number[];

  /**
   * @remarks
   * Range used to determine random variant.
   */
  random_variant_mutation_interval: number[];

  /**
   * @remarks
   * If true, the entity needs to be at full health before it can
   * breed.
   */
  require_full_health: boolean;

  /**
   * @remarks
   * If true, the entities need to be tamed first before they can
   * breed.
   */
  require_tame: boolean;

  /**
   * @remarks
   * The breed item used will transform to this item upon successful
   * interaction. Format: itemName:auxValue
   */
  transform_to_item: string;

}


/**
 * The list of entity definitions that this entity can breed 
 * with.
 */
export interface MinecraftBreedableBreedsWith {

  /**
   * @remarks
   * The entity definition of this entity's babies.
   */
  baby_type: string;

  /**
   * @remarks
   * Event to run when this entity breeds.
   */
  breed_event: string;

  /**
   * @remarks
   * The inclusive minimum of the variant range.
   */
  mate_type: string;

}


/**
 * Determines how likely the baby of parents with the same variant will
 * deny that variant and take a random variant within the given range
 * instead.
 */
export interface MinecraftBreedableDenyParentsVariant {

  /**
   * @remarks
   * The percentage chance of denying the parents' variant.
   */
  chance: number;

  /**
   * @remarks
   * The inclusive maximum of the variant range.
   */
  max_variant: string;

  /**
   * @remarks
   * The inclusive minimum of the variant range.
   */
  min_variant: string;

}


/**
 * The list of nearby block requirements to get the entity into the
 * 'love' state.
 */
export interface MinecraftBreedableEnvironmentRequirements {

  /**
   * @remarks
   * The block types required nearby for the entity to breed.
   */
  block_types: string[];

  /**
   * @remarks
   * The block types required nearby for the entity to breed.
   */
  blocks: string[];

  /**
   * @remarks
   * The number of the required block types nearby for the entity to
   * breed.
   */
  count: number;

  /**
   * @remarks
   * How many blocks radius from the mob's center to search in for
   * the required blocks. Bounded between 0 and 16.
   */
  radius: number;

}


/**
 * Determines how likely the babies are to NOT inherit one of
 * their parent's variances. Values are between 0.0 and 1.0, with a
 * higher number meaning more likely to mutate.
 */
export interface MinecraftBreedableMutationFactor {

  /**
   * @remarks
   * The percentage chance of denying the parents' variant.
   */
  color: number[];

  /**
   * @remarks
   * The percentage chance of a mutation on the entity's extra variant
   * type.
   */
  extra_variant: number[];

  /**
   * @remarks
   * The percentage chance of a mutation on the entity's variant 
   * type.
   */
  variant: number[];

}