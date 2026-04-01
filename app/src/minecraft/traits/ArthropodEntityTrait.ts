// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Arthropod body type - spider, silverfish.
 */
export class ArthropodEntityTrait extends EntityContentTrait {
  get id(): string {
    return "arthropod";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "arthropod",
      displayName: "Arthropod",
      description: "Insect or spider-like body",
      category: "body_type",
      components: {
        "minecraft:can_climb": {},
        "minecraft:mark_variant": { value: 0 },
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {
          can_path_over_water: true,
          avoid_damage_blocks: true,
          can_walk_in_lava: false,
        },
      },
    };
  }
}
