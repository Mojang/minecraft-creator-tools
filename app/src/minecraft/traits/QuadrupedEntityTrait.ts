// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Quadruped body type - four-legged animal.
 */
export class QuadrupedEntityTrait extends EntityContentTrait {
  get id(): string {
    return "quadruped";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "quadruped",
      displayName: "Quadruped",
      description: "Four-legged animal body",
      category: "body_type",
      components: {
        "minecraft:can_climb": {},
        "minecraft:jump.static": {},
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {
          can_path_over_water: true,
          avoid_damage_blocks: true,
        },
      },
      resources: {
        animations: {
          walk: "animation.quadruped.walk",
          idle: "animation.quadruped.idle",
        },
      },
    };
  }
}
