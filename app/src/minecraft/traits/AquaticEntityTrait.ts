// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Aquatic body type - fish, dolphin.
 */
export class AquaticEntityTrait extends EntityContentTrait {
  get id(): string {
    return "aquatic";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "aquatic",
      displayName: "Aquatic",
      description: "Lives in water, can swim",
      category: "body_type",
      components: {
        "minecraft:navigation.swim": {
          can_path_over_water: false,
          can_swim: true,
          avoid_damage_blocks: true,
        },
        "minecraft:underwater_movement": { value: 0.3 },
        "minecraft:movement.sway": {
          sway_amplitude: 0.0,
        },
        "minecraft:breathable": {
          total_supply: 15,
          suffocate_time: 0,
          breathes_water: true,
          breathes_air: false,
        },
      },
    };
  }
}
