// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Stackable - can stack to 64.
 */
export class StackableItemTrait extends ItemContentTrait {
  get id(): string {
    return "stackable";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const maxStackSize = config?.maxStackSize ?? 64;

    return {
      id: "stackable",
      displayName: "Stackable",
      description: "Can stack to 64",
      category: "special",
      components: {
        "minecraft:max_stack_size": maxStackSize,
      },
    };
  }
}
