// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Glinting - has enchantment glint effect.
 */
export class GlintingItemTrait extends ItemContentTrait {
  get id(): string {
    return "glinting";
  }

  getData(_config?: ITraitConfig): IItemTraitData {
    return {
      id: "glinting",
      displayName: "Glinting",
      description: "Has enchantment glint effect",
      category: "special",
      components: {
        "minecraft:glint": true,
      },
    };
  }
}
