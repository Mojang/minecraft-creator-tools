// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Neutral behavior - attacks only when provoked.
 */
export class NeutralEntityTrait extends EntityContentTrait {
  get id(): string {
    return "neutral";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "neutral",
      displayName: "Neutral",
      description: "Only attacks when provoked",
      category: "behavior",
      components: {
        "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
        "minecraft:behavior.random_look_around": { priority: 7 },
      },
      componentGroups: {
        neutral_calm: {},
        neutral_angry: {
          "minecraft:behavior.hurt_by_target": {
            priority: 1,
            alert_same_type: true,
          },
          "minecraft:behavior.nearest_attackable_target": {
            priority: 2,
            entity_types: [
              {
                filters: {
                  all_of: [
                    { test: "is_family", subject: "other", value: "player" },
                    { test: "has_component", subject: "self", value: "minecraft:angry" },
                  ],
                },
              },
            ],
          },
          "minecraft:angry": {
            duration: 25,
            broadcast_anger: true,
            broadcast_range: 20,
            calm_event: { event: "on_calm" },
          },
        },
      },
      events: {
        "minecraft:on_hurt": {
          add: { component_groups: ["neutral_angry"] },
        },
        on_calm: {
          remove: { component_groups: ["neutral_angry"] },
          add: { component_groups: ["neutral_calm"] },
        },
      },
      spawnEvent: {
        add: { component_groups: ["neutral_calm"] },
      },
    };
  }
}
