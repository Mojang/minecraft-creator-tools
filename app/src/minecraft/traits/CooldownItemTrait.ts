// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Cooldown - has a cooldown after use.
 */
export class CooldownItemTrait extends ItemContentTrait {
  get id(): string {
    return "cooldown";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const cooldownDuration = config?.cooldownDuration ?? 1.0;
    const cooldownCategory = config?.cooldownCategory ?? "attack";

    return {
      id: "cooldown",
      displayName: "Cooldown",
      description: "Has a cooldown after use",
      category: "special",
      components: {
        "minecraft:cooldown": {
          category: cooldownCategory,
          duration: cooldownDuration,
        },
      },
    };
  }
}
