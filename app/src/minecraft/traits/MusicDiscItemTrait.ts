// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Music disc - can be played in a jukebox.
 */
export class MusicDiscItemTrait extends ItemContentTrait {
  get id(): string {
    return "music_disc";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const soundEvent = config?.soundEvent ?? "record.13";

    return {
      id: "music_disc",
      displayName: "Music Disc",
      description: "Can be played in a jukebox",
      category: "special",
      components: {
        "minecraft:record": {
          sound_event: soundEvent,
          duration: 178.0,
          comparator_signal: 1,
        },
        "minecraft:max_stack_size": 1,
      },
    };
  }
}
