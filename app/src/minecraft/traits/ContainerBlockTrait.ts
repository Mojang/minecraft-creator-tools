// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Container - stores items.
 */
export class ContainerBlockTrait extends BlockContentTrait {
  get id(): string {
    return "container";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const containerSize = config?.containerSize ?? 27;

    return {
      id: "container",
      displayName: "Container",
      description: "Stores items",
      category: "interactive",
      components: {
        "minecraft:on_interact": {
          event: "open_container",
        },
        "minecraft:inventory": {
          container_size: containerSize,
          can_be_siphoned_from: true,
        },
      },
    };
  }
}
