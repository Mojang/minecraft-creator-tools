// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Crafting station - allows crafting.
 */
export class CraftingStationBlockTrait extends BlockContentTrait {
  get id(): string {
    return "crafting_station";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const craftingTags = config?.craftingTags ?? ["crafting_table"];

    return {
      id: "crafting_station",
      displayName: "Crafting Station",
      description: "Allows crafting",
      category: "interactive",
      components: {
        "minecraft:crafting_table": {
          crafting_tags: craftingTags,
          table_name: "container.crafting",
        },
      },
    };
  }
}
