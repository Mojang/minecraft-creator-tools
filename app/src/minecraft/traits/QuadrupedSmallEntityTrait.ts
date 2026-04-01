// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Small quadruped body type - rabbit, cat sized.
 */
export class QuadrupedSmallEntityTrait extends EntityContentTrait {
  get id(): string {
    return "quadruped_small";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "quadruped_small",
      displayName: "Small Quadruped",
      description: "Small four-legged animal (rabbit, cat size)",
      category: "body_type",
      components: {
        "minecraft:can_climb": {},
        "minecraft:jump.static": { jump_power: 0.6 },
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {
          can_path_over_water: true,
          avoid_damage_blocks: true,
        },
        "minecraft:scale": { value: 0.5 },
      },
    };
  }
}
