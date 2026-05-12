// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Redstone producer - block emits a redstone signal.
 * Uses minecraft:redstone_producer to output power on all faces.
 */
export class RedstoneProducerBlockTrait extends BlockContentTrait {
  get id(): string {
    return "redstone_signal";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const power = config?.redstonePower ?? 15;

    return {
      id: "redstone_signal",
      displayName: "Redstone Signal",
      description: "Outputs redstone power",
      category: "interactive",
      components: {
        "minecraft:redstone_producer": {
          power: power,
          connected_faces: ["down", "up", "north", "south", "east", "west"],
        },
        "minecraft:redstone_conductivity": {
          redstone_conductor: true,
          allows_wire_to_step_down: true,
        },
      },
    };
  }
}
