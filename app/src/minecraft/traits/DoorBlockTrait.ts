// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Door - can be opened and closed.
 */
export class DoorBlockTrait extends BlockContentTrait {
  get id(): string {
    return "door";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "door",
      displayName: "Door",
      description: "Can be opened and closed",
      category: "interactive",
      components: {
        "minecraft:on_interact": {
          event: "toggle_open",
        },
        "minecraft:geometry": "geometry.door",
        "minecraft:collision_box": {
          origin: [-8, 0, -2],
          size: [16, 32, 4],
        },
        "minecraft:selection_box": {
          origin: [-8, 0, -2],
          size: [16, 32, 4],
        },
      },
    };
  }
}
