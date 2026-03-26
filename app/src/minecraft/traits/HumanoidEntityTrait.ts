// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Humanoid body type - bipedal, can climb and jump.
 */
export class HumanoidEntityTrait extends EntityContentTrait {
  get id(): string {
    return "humanoid";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "humanoid",
      displayName: "Humanoid",
      description: "Bipedal humanoid body with arms and legs",
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
          walk: "animation.humanoid.walk",
          idle: "animation.humanoid.idle",
          attack: "animation.humanoid.attack",
        },
      },
    };
  }
}
