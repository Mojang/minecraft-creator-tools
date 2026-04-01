// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Slime body type - bouncy cube.
 */
export class SlimeEntityTrait extends EntityContentTrait {
  get id(): string {
    return "slime";
  }

  getData(config?: ITraitConfig): IEntityTraitData {
    return {
      id: "slime",
      displayName: "Slime",
      description: "Bouncy cube body",
      category: "body_type",
      components: {
        "minecraft:movement.sway": { sway_amplitude: 0.0 },
        "minecraft:movement.jump": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {
          avoid_damage_blocks: true,
        },
      },
      resources: {
        animations: {
          move: "animation.slime.move",
        },
      },
    };
  }
}
