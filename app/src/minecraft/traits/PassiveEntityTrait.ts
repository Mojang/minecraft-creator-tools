// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Passive behavior - flees when hurt.
 */
export class PassiveEntityTrait extends EntityContentTrait {
  get id(): string {
    return "passive";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "passive",
      displayName: "Passive",
      description: "Flees when attacked, does not fight back",
      category: "behavior",
      components: {
        "minecraft:behavior.panic": {
          priority: 1,
          speed_multiplier: 1.25,
        },
        "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
        "minecraft:behavior.random_look_around": { priority: 7 },
        "minecraft:behavior.look_at_player": {
          priority: 8,
          look_distance: 6.0,
        },
      },
    };
  }
}
