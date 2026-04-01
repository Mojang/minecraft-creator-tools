// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Teleporter - can teleport.
 */
export class TeleporterEntityTrait extends EntityContentTrait {
  get id(): string {
    return "teleporter";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const teleportChance = config?.teleportChance ?? 0.01;

    return {
      id: "teleporter",
      displayName: "Teleporter",
      description: "Can teleport",
      category: "special",
      components: {
        "minecraft:teleport": {
          random_teleports: true,
          max_random_teleport_time: 30.0,
          random_teleport_cube: [32, 16, 32],
          target_distance: 16.0,
          target_teleport_chance: teleportChance,
          light_teleport_chance: 0.01,
        },
      },
    };
  }
}
