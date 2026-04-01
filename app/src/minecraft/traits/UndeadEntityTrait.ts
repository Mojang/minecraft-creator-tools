// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Undead - takes damage from healing, heals from damage potions.
 */
export class UndeadEntityTrait extends EntityContentTrait {
  get id(): string {
    return "undead";
  }

  getData(_config?: ITraitConfig): IEntityTraitData {
    return {
      id: "undead",
      displayName: "Undead",
      description: "Takes damage from healing, heals from damage potions",
      category: "special",
      components: {
        "minecraft:type_family": {
          family: ["undead", "monster"],
        },
        "minecraft:burns_in_daylight": {},
      },
    };
  }
}
