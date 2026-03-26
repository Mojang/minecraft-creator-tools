// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Melee attacker - uses close-range attacks.
 */
export class MeleeAttackerEntityTrait extends EntityContentTrait {
  get id(): string {
    return "melee_attacker";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const damage = config?.damage ?? 3;
    const attackSpeed = config?.attackSpeed ?? 1.2;

    return {
      id: "melee_attacker",
      displayName: "Melee Attacker",
      description: "Attacks with close-range melee strikes",
      category: "combat",
      components: {
        "minecraft:behavior.melee_attack": {
          priority: 3,
          speed_multiplier: attackSpeed,
          track_target: true,
        },
        "minecraft:attack": { damage },
      },
      resources: {
        animations: {
          attack: "animation.humanoid.attack",
        },
      },
    };
  }
}
