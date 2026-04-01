// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Throwable - can be thrown.
 */
export class ThrowableItemTrait extends ItemContentTrait {
  get id(): string {
    return "throwable";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const launchPower = config?.launchPower ?? 1.0;

    return {
      id: "throwable",
      displayName: "Throwable",
      description: "Can be thrown",
      category: "special",
      components: {
        "minecraft:throwable": {
          do_swing_animation: true,
          launch_power_scale: launchPower,
          max_launch_power: 1.5,
        },
        "minecraft:projectile": {
          projectile_entity: "minecraft:snowball",
        },
      },
    };
  }
}
