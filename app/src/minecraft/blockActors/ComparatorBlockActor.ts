// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockActor from "./BlockActor";

export default class ComparatorBlockActor extends BlockActor {
  outputSignal?: number;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    const tag = this.rootTag.find("OutputSignal");
    if (tag) {
      this.outputSignal = tag.valueAsInt;
    }
  }
}
