// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Flying body type - bird, bat, phantom.
 */
export class FlyingEntityTrait extends EntityContentTrait {
  get id(): string {
    return "flying";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "flying",
      displayName: "Flying",
      description: "Can fly through the air",
      category: "body_type",
      components: {
        "minecraft:navigation.fly": {
          can_path_over_water: true,
          can_path_over_lava: false,
        },
        "minecraft:can_fly": {},
        "minecraft:movement.fly": {},
      },
      resources: {
        animations: {
          fly: "animation.flying.fly",
          glide: "animation.flying.glide",
        },
      },
    };
  }
}
