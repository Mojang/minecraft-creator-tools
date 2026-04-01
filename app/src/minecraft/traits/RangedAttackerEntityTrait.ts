// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Ranged attacker - uses projectiles.
 */
export class RangedAttackerEntityTrait extends EntityContentTrait {
  get id(): string {
    return "ranged_attacker";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const projectile = config?.projectile ?? "minecraft:arrow";
    const attackRadius = config?.attackRadius ?? 15.0;

    return {
      id: "ranged_attacker",
      displayName: "Ranged Attacker",
      description: "Attacks with ranged projectiles",
      category: "combat",
      components: {
        "minecraft:behavior.ranged_attack": {
          priority: 3,
          attack_interval_min: 1.0,
          attack_interval_max: 3.0,
          attack_radius: attackRadius,
        },
        "minecraft:shooter": {
          def: projectile,
        },
      },
    };
  }
}
