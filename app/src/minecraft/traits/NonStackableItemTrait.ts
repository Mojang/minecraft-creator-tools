// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Non-stackable - cannot stack.
 */
export class NonStackableItemTrait extends ItemContentTrait {
  get id(): string {
    return "non_stackable";
  }

  getData(_config?: ITraitConfig): IItemTraitData {
    return {
      id: "non_stackable",
      displayName: "Non-Stackable",
      description: "Cannot stack",
      category: "special",
      components: {
        "minecraft:max_stack_size": 1,
      },
    };
  }
}
