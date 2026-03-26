// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Leasable - can be leashed with a lead.
 */
export class LeasableEntityTrait extends EntityContentTrait {
  get id(): string {
    return "leasable";
  }

  getData(_config?: ITraitConfig): IEntityTraitData {
    return {
      id: "leasable",
      displayName: "Leasable",
      description: "Can be leashed with a lead",
      category: "interaction",
      components: {
        "minecraft:leashable": {
          soft_distance: 4.0,
          hard_distance: 6.0,
          max_distance: 10.0,
        },
      },
    };
  }
}
