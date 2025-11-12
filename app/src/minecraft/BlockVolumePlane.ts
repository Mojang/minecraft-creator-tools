// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockVolume from "./BlockVolume";
import BlockVolumeLine from "./BlockVolumeLine";

export default class BlockVolumePlane {
  private _cube: BlockVolume;
  private _x: number;

  lines: BlockVolumeLine[];

  get x() {
    return this._x;
  }

  constructor(cube: BlockVolume, x: number) {
    this.lines = [];
    this._cube = cube;
    this._x = x;
  }

  y(y: number): BlockVolumeLine {
    if (y > this._cube.maxY) {
      throw new Error("Value exceeds maximum Y");
    }

    while (y >= this.lines.length) {
      const newY = this.lines.length;
      this.lines[newY] = new BlockVolumeLine(this._cube, this, newY);
    }

    return this.lines[y];
  }
}
