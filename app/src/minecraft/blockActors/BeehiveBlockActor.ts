// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockActor from "./BlockActor";

export default class BeehiveBlockActor extends BlockActor {
  shouldSpawnBees?: boolean;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    const tag = this.rootTag.find("shouldSpawnBees");
    if (tag) {
      this.shouldSpawnBees = tag.valueAsBoolean;
    }
  }
}
