// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Exploder - explodes when near target.
 */
export class ExploderEntityTrait extends EntityContentTrait {
  get id(): string {
    return "exploder";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const power = config?.power ?? 3;
    const fuseTime = config?.fuseTime ?? 1.5;
    const causesFire = config?.causesFire ?? false;

    return {
      id: "exploder",
      displayName: "Exploder",
      description: "Explodes when near its target",
      category: "combat",
      components: {},
      componentGroups: {
        exploder_idle: {
          "minecraft:behavior.nearest_attackable_target": {
            priority: 1,
            entity_types: [
              {
                filters: { test: "is_family", subject: "other", value: "player" },
                max_dist: 25,
              },
            ],
          },
        },
        exploder_fuse_lit: {
          "minecraft:explode": {
            fuse_length: fuseTime,
            fuse_lit: true,
            power,
            causes_fire: causesFire,
          },
          "minecraft:behavior.melee_attack": {
            priority: 2,
            speed_multiplier: 1.5,
            track_target: true,
            reach_multiplier: 0.0,
          },
        },
      },
      events: {
        start_exploding: {
          remove: { component_groups: ["exploder_idle"] },
          add: { component_groups: ["exploder_fuse_lit"] },
        },
        stop_exploding: {
          remove: { component_groups: ["exploder_fuse_lit"] },
          add: { component_groups: ["exploder_idle"] },
        },
      },
      spawnEvent: {
        add: { component_groups: ["exploder_idle"] },
      },
      resources: {
        sounds: {
          fuse: "mob.creeper.say",
        },
      },
    };
  }
}
