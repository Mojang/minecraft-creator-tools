// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Tameable - can be tamed by the player.
 */
export class TameableEntityTrait extends EntityContentTrait {
  get id(): string {
    return "tameable";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const tameItems = config?.tameItems ?? ["bone"];
    const tameChance = config?.tameChance ?? 0.33;

    return {
      id: "tameable",
      displayName: "Tameable",
      description: "Can be tamed by the player with specific items",
      category: "interaction",
      components: {
        "minecraft:tameable": {
          probability: tameChance,
          tame_items: tameItems,
          tame_event: { event: "on_tame", target: "self" },
        },
      },
      componentGroups: {
        wild: {
          "minecraft:behavior.avoid_mob_type": {
            priority: 4,
            entity_types: [
              {
                filters: { test: "is_family", subject: "other", value: "player" },
                max_dist: 8,
                walk_speed_multiplier: 1.0,
                sprint_speed_multiplier: 1.0,
              },
            ],
          },
        },
        tamed: {
          "minecraft:is_tamed": {},
          "minecraft:behavior.follow_owner": {
            priority: 4,
            speed_multiplier: 1.0,
            start_distance: 10,
            stop_distance: 2,
          },
          "minecraft:behavior.owner_hurt_by_target": { priority: 1 },
          "minecraft:behavior.owner_hurt_target": { priority: 2 },
          "minecraft:sittable": {},
          "minecraft:behavior.stay_while_sitting": { priority: 3 },
        },
      },
      events: {
        on_tame: {
          remove: { component_groups: ["wild"] },
          add: { component_groups: ["tamed"] },
        },
      },
      spawnEvent: {
        add: { component_groups: ["wild"] },
      },
    };
  }
}
