// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Rideable - can be ridden by the player.
 */
export class RideableEntityTrait extends EntityContentTrait {
  get id(): string {
    return "rideable";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const seatCount = config?.seatCount ?? 1;
    const controllable = config?.controllable ?? true;
    const requiresSaddle = config?.requiresSaddle ?? true;

    const baseComponents: Record<string, any> = {
      "minecraft:rideable": {
        seat_count: seatCount,
        family_types: ["player"],
        interact_text: "action.interact.ride.horse",
        seats: [{ position: [0.0, 1.1, -0.2] }],
      },
    };

    if (controllable) {
      baseComponents["minecraft:input_ground_controlled"] = {};
    }

    const componentGroups: Record<string, Record<string, any>> = {};
    const events: Record<string, any> = {};

    if (requiresSaddle) {
      componentGroups["unsaddled"] = {};
      componentGroups["saddled"] = {
        "minecraft:is_saddled": {},
        ...baseComponents,
      };

      events["on_saddle"] = {
        remove: { component_groups: ["unsaddled"] },
        add: { component_groups: ["saddled"] },
      };

      return {
        id: "rideable",
        displayName: "Rideable",
        description: "Can be ridden by the player",
        category: "interaction",
        components: {
          "minecraft:equippable": {
            slots: [
              {
                slot: 0,
                item: "saddle",
                accepted_items: ["saddle"],
                on_equip: { event: "on_saddle" },
              },
            ],
          },
        },
        componentGroups,
        events,
        spawnEvent: {
          add: { component_groups: ["unsaddled"] },
        },
      };
    }

    return {
      id: "rideable",
      displayName: "Rideable",
      description: "Can be ridden by the player",
      category: "interaction",
      components: baseComponents,
    };
  }
}
