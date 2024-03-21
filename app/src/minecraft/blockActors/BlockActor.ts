// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NbtBinaryTag from "../NbtBinaryTag";

export default abstract class BlockActor {
  rootTag: NbtBinaryTag;

  x: number | undefined;
  y: number | undefined;
  z: number | undefined;

  id?: string;

  isMovable?: boolean;

  constructor(rootTagIn: NbtBinaryTag) {
    this.rootTag = rootTagIn;

    let tag = this.rootTag.find("x");

    if (tag !== null) {
      this.x = tag.valueAsInt;
    }

    tag = this.rootTag.find("y");

    if (tag !== null) {
      this.y = tag.valueAsInt;
    }

    tag = this.rootTag.find("z");

    if (tag !== null) {
      this.z = tag.valueAsInt;
    }

    tag = this.rootTag.find("id");

    if (tag !== null) {
      this.id = tag.valueAsString;
    }

    tag = this.rootTag.find("isMovable");
    if (tag) {
      this.isMovable = tag.valueAsBoolean;
    }
  }

  public abstract load(): void;
}
