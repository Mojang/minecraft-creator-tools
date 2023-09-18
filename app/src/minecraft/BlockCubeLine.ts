import BlockCube from "./BlockCube";
import Block from "./Block";
import BlockCubePlane from "./BlockCubePlane";

export default class BlockCubeLine {
  private _cube: BlockCube;
  private _plane: BlockCubePlane;
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

  constructor(cube: BlockCube, plane: BlockCubePlane, y: number) {
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
