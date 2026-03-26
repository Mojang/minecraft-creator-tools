// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Passable - entities can walk through.
 */
export class PassableBlockTrait extends BlockContentTrait {
  get id(): string {
    return "passable";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "passable",
      displayName: "Passable",
      description: "Entities can walk through",
      category: "special",
      components: {
        "minecraft:collision_box": false,
      },
    };
  }
}
