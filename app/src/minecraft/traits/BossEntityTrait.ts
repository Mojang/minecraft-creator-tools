// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Boss behavior - boss bar, phases, special abilities.
 */
export class BossEntityTrait extends EntityContentTrait {
  get id(): string {
    return "boss";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const bossName = config?.bossName ?? "Boss";
    const phases = config?.phases ?? 3;

    const componentGroups: Record<string, Record<string, any>> = {};
    const events: Record<string, any> = {};

    // Create phase component groups
    for (let i = 1; i <= phases; i++) {
      componentGroups[`phase_${i}`] = {
        "minecraft:scale": { value: 1.0 + (i - 1) * 0.1 },
        "minecraft:movement": { value: 0.25 + (i - 1) * 0.05 },
      };

      if (i < phases) {
        events[`enter_phase_${i + 1}`] = {
          remove: { component_groups: [`phase_${i}`] },
          add: { component_groups: [`phase_${i + 1}`] },
        };
      }
    }

    return {
      id: "boss",
      displayName: "Boss",
      description: "Boss mob with health bar and phases",
      category: "behavior",
      components: {
        "minecraft:boss": {
          should_darken_sky: true,
          hud_range: 55,
          name: bossName,
        },
        "minecraft:knockback_resistance": { value: 1.0 },
      },
      componentGroups,
      events,
      spawnEvent: {
        add: { component_groups: ["phase_1"] },
      },
    };
  }
}
