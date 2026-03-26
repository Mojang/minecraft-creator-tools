// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Hostile behavior - attacks players on sight.
 */
export class HostileEntityTrait extends EntityContentTrait {
  get id(): string {
    return "hostile";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const attackDamage = config?.attackDamage ?? 3;

    return {
      id: "hostile",
      displayName: "Hostile",
      description: "Attacks players on sight",
      category: "behavior",
      components: {
        "minecraft:behavior.hurt_by_target": { priority: 1 },
        "minecraft:attack": { damage: attackDamage },
      },
      componentGroups: {
        hostile_calm: {
          "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
          "minecraft:behavior.random_look_around": { priority: 7 },
        },
        hostile_angry: {
          "minecraft:behavior.nearest_attackable_target": {
            priority: 2,
            must_see: true,
            reselect_targets: true,
            entity_types: [
              {
                filters: { test: "is_family", subject: "other", value: "player" },
                max_dist: 35,
              },
            ],
          },
        },
      },
      events: {
        become_hostile: {
          add: { component_groups: ["hostile_angry"] },
        },
        calm_down: {
          remove: { component_groups: ["hostile_angry"] },
          add: { component_groups: ["hostile_calm"] },
        },
      },
      spawnEvent: {
        add: { component_groups: ["hostile_angry"] },
      },
    };
  }
}
