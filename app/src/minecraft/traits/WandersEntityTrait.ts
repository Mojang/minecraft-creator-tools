// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Wanders - randomly wanders around.
 */
export class WandersEntityTrait extends EntityContentTrait {
  get id(): string {
    return "wanders";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const wanderSpeed = config?.speed ?? 1.0;

    return {
      id: "wanders",
      displayName: "Wanders",
      description: "Randomly wanders around",
      category: "behavior",
      components: {
        "minecraft:behavior.random_stroll": {
          priority: 6,
          speed_multiplier: wanderSpeed,
        },
        "minecraft:behavior.random_look_around": {
          priority: 8,
        },
        "minecraft:behavior.look_at_player": {
          priority: 7,
          look_distance: 6.0,
          probability: 0.02,
        },
      },
    };
  }
}
