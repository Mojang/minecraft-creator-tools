// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Breedable - can be bred to produce offspring.
 */
export class BreedableEntityTrait extends EntityContentTrait {
  get id(): string {
    return "breedable";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    const breedItems = config?.breedItems ?? ["wheat"];

    return {
      id: "breedable",
      displayName: "Breedable",
      description: "Can be bred to produce offspring",
      category: "interaction",
      components: {
        "minecraft:breedable": {
          require_tame: false,
          breeds_with: {
            mate_type: "self",
            baby_type: "self",
          },
          breed_items: breedItems,
        },
      },
    };
  }
}
