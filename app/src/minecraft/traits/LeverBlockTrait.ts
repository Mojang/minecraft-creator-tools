// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Lever - toggle switch.
 */
export class LeverBlockTrait extends BlockContentTrait {
  get id(): string {
    return "lever";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "lever",
      displayName: "Lever",
      description: "Toggle switch",
      category: "interactive",
      components: {
        "minecraft:on_interact": {
          event: "toggle",
        },
        "minecraft:geometry": "geometry.lever",
        "minecraft:collision_box": false,
        "minecraft:selection_box": {
          origin: [-3, 0, -2],
          size: [6, 10, 4],
        },
      },
    };
  }
}
