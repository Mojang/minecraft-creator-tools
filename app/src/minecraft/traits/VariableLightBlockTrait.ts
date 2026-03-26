// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Variable light - light level can change.
 */
export class VariableLightBlockTrait extends BlockContentTrait {
  get id(): string {
    return "variable_light";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const maxLightLevel = config?.maxLightLevel ?? 15;

    return {
      id: "variable_light",
      displayName: "Variable Light",
      description: "Light level can change",
      category: "special",
      components: {
        "minecraft:light_emission": 0,
      },
      properties: {
        "custom:light_level": Array.from({ length: maxLightLevel + 1 }, (_, i) => i),
      },
      permutations: Array.from({ length: maxLightLevel + 1 }, (_, i) => ({
        condition: `q.block_state('custom:light_level') == ${i}`,
        components: { "minecraft:light_emission": i },
      })),
    };
  }
}
