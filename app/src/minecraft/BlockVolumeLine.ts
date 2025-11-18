// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockVolume from "./BlockVolume";
import Block from "./Block";
import BlockVolumePlane from "./BlockVolumePlane";

export default class BlockVolumeLine {
  private _cube: BlockVolume;
  private _plane: BlockVolumePlane;
  private _y: number;

  get cube() {
    return this._cube;
  }

  get y() {
    return this._y;
  }

  get x() {
    return this._plane.x;
  }

  get plane() {
    return this._plane;
  }

  blocks: Block[];

  constructor(cube: BlockVolume, plane: BlockVolumePlane, y: number) {
    this.blocks = [];
    this._cube = cube;
    this._plane = plane;
    this._y = y;
  }

  z(z: number): Block {
    if (z > this._cube.maxZ) {
      throw new Error("Value exceeds maximum Z");
    }

    while (z >= this.blocks.length) {
      const block = new Block(undefined);

      block.line = this;
      block.z = this.blocks.length;

      this.blocks[this.blocks.length] = block;
    }

    return this.blocks[z];
  }
}
