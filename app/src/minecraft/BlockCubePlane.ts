import BlockCube from "./BlockCube";
import BlockCubeLine from "./BlockCubeLine";

export default class BlockCubePlane {
  private _cube: BlockCube;
  private _x: number;

  lines: BlockCubeLine[];

  get x() {
    return this._x;
  }

  constructor(cube: BlockCube, x: number) {
    this.lines = [];
    this._cube = cube;
    this._x = x;
  }

  y(y: number): BlockCubeLine {
    if (y > this._cube.maxY) {
      throw new Error("Value exceeds maximum Y");
    }

    while (y >= this.lines.length) {
      const newY = this.lines.length;
      this.lines[newY] = new BlockCubeLine(this._cube, this, newY);
    }

    return this.lines[y];
  }
}
