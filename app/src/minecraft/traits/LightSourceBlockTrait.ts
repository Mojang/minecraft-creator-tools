// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Light source - emits light.
 */
export class LightSourceBlockTrait extends BlockContentTrait {
  get id(): string {
    return "light_source";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const lightLevel = config?.lightLevel ?? 15;

    return {
      id: "light_source",
      displayName: "Light Source",
      description: "Emits light",
      category: "special",
      components: {
        "minecraft:light_emission": lightLevel,
      },
    };
  }
}
