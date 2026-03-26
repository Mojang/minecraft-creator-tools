// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Gravity affected - falls when unsupported.
 */
export class GravityAffectedBlockTrait extends BlockContentTrait {
  get id(): string {
    return "gravity_affected";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "gravity_affected",
      displayName: "Gravity Affected",
      description: "Falls when unsupported",
      category: "special",
      components: {
        "minecraft:on_placed": {
          event: "check_fall",
        },
      },
    };
  }
}
