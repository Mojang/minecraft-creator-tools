// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Transparent - allows light through.
 */
export class TransparentBlockTrait extends BlockContentTrait {
  get id(): string {
    return "transparent";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "transparent",
      displayName: "Transparent",
      description: "Allows light through",
      category: "special",
      components: {
        "minecraft:light_dampening": 0,
      },
    };
  }
}
