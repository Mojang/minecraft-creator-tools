// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * FleesDaylight - seeks shelter from sunlight.
 */
export class FleesDaylightEntityTrait extends EntityContentTrait {
  get id(): string {
    return "flees_daylight";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const fleeSpeed = config?.speed ?? 1.0;

    return {
      id: "flees_daylight",
      displayName: "Flees Daylight",
      description: "Seeks shelter from sunlight",
      category: "behavior",
      components: {
        "minecraft:behavior.flee_sun": {
          priority: 2,
          speed_multiplier: fleeSpeed,
        },
        "minecraft:navigation.walk": {
          can_path_over_water: true,
          avoid_sun: true,
        },
      },
    };
  }
}
