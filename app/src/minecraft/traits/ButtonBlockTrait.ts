// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Button - momentary switch.
 */
export class ButtonBlockTrait extends BlockContentTrait {
  get id(): string {
    return "button";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "button",
      displayName: "Button",
      description: "Momentary switch",
      category: "interactive",
      components: {
        "minecraft:on_interact": {
          event: "pressed",
        },
        "minecraft:geometry": "geometry.button",
        "minecraft:collision_box": false,
        "minecraft:selection_box": {
          origin: [-2, 0, -3],
          size: [4, 2, 6],
        },
      },
    };
  }
}
