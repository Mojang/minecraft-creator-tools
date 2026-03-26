// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Trapdoor - horizontal door.
 */
export class TrapdoorBlockTrait extends BlockContentTrait {
  get id(): string {
    return "trapdoor";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "trapdoor",
      displayName: "Trapdoor",
      description: "Horizontal door",
      category: "interactive",
      components: {
        "minecraft:on_interact": {
          event: "toggle_open",
        },
        "minecraft:geometry": "geometry.trapdoor",
        "minecraft:collision_box": {
          origin: [-8, 0, -8],
          size: [16, 3, 16],
        },
        "minecraft:selection_box": {
          origin: [-8, 0, -8],
          size: [16, 3, 16],
        },
      },
    };
  }
}
