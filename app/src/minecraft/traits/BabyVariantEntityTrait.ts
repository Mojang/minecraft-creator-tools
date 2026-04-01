// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * BabyVariant - has baby/adult variants.
 */
export class BabyVariantEntityTrait extends EntityContentTrait {
  get id(): string {
    return "baby_variant";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const growUpTime = config?.growUpTime ?? 1200;

    return {
      id: "baby_variant",
      displayName: "Baby Variant",
      description: "Has baby/adult variants",
      category: "special",
      components: {
        "minecraft:ageable": {
          duration: growUpTime,
          grow_up: {
            event: "grow_up",
            target: "self",
          },
        },
      },
      componentGroups: {
        baby: {
          "minecraft:is_baby": {},
          "minecraft:scale": {
            value: 0.5,
          },
          "minecraft:ageable": {
            duration: growUpTime,
            grow_up: {
              event: "grow_up",
              target: "self",
            },
          },
        },
        adult: {
          "minecraft:scale": {
            value: 1.0,
          },
        },
      },
      events: {
        grow_up: {
          remove: { component_groups: ["baby"] },
          add: { component_groups: ["adult"] },
        },
        spawn_baby: {
          add: { component_groups: ["baby"] },
        },
      },
      spawnEvent: {
        randomize: [
          { weight: 95, add: { component_groups: ["adult"] } },
          { weight: 5, add: { component_groups: ["baby"] } },
        ],
      },
    };
  }
}
