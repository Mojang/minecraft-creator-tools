import BlockCubePlane from "./BlockCubePlane";
import Block from "./Block";
import { EventDispatcher } from "ste-events";
import IBlockCubeColumn from "./IBlockCubeColumn";
import IDimension from "./IDimension";
import BlockLocation from "./BlockLocation";
import Entity from "./Entity";
import Log from "../core/Log";

export default class BlockCube implements IDimension {
  _maxX: number = 1;
  _maxY: number = 1;
  _maxZ: number = 1;

  private _onMaxDimensionsChanged = new EventDispatcher<BlockCube, string>();
  private _onBlockTypeChanged = new EventDispatcher<BlockCube, Block>();
  private _onBlockPropertyChanged = new EventDispatcher<BlockCube, Block>();

  private _columns: IBlockCubeColumn[][] | undefined = undefined;

  public get onMaxDimensionsChanged() {
    return this._onMaxDimensionsChanged.asEvent();
  }

  public get onBlockTypeChanged() {
    return this._onBlockTypeChanged.asEvent();
  }

  public get onBlockPropertyChanged() {
    return this._onBlockPropertyChanged.asEvent();
  }

  get columns() {
    if (this._columns === undefined) {
      this._columns = this._generateColumnInfo();
    }

    return this._columns;
  }

  get maxX() {
    return this._maxX;
  }

  get maxY() {
    return this._maxY;
  }

  get maxZ() {
    return this._maxZ;
  }

  set maxX(newMaxX: number) {
    this._maxX = newMaxX;

    this._onMaxDimensionsChanged.dispatch(this, "x");
  }

  set maxY(newMaxY: number) {
    this._maxY = newMaxY;

    this._onMaxDimensionsChanged.dispatch(this, "y");
  }

  set maxZ(newMaxZ: number) {
    this._maxZ = newMaxZ;

    this._onMaxDimensionsChanged.dispatch(this, "z");
  }

  setMaxDimensions(newMaxX: number, newMaxY: number, newMaxZ: number) {
    this._maxX = newMaxX;
    this._maxY = newMaxY;
    this._maxZ = newMaxZ;

    this._onMaxDimensionsChanged.dispatch(this, "xyz");
  }

  planes: BlockCubePlane[];

  constructor() {
    this.planes = [];
  }

  spawnEntity(entityTypeId: string, location: BlockLocation) {
    const e = new Entity();

    return e;
  }

  getBlock(location: BlockLocation) {
    Log.assert(
      location.x >= 0 &&
        location.x <= this.maxX &&
        location.y >= 0 &&
        location.x <= this.maxY &&
        location.z >= 0 &&
        location.z <= this.maxZ,
      "Block location not within bounds."
    );

    return this.x(location.x).y(location.y).z(location.z);
  }

  getCommandList(fromX: number, fromY: number, fromZ: number) {
    const commands: string[] = [];

    for (let x = 0; x < this.maxX; x++) {
      for (let y = 0; y < this.maxY; y++) {
        for (let z = 0; z < this.maxZ; z++) {
          const block = this.x(x).y(y).z(z);

          if (!block.isEmpty) {
            commands.push("setblock ~" + (fromX + x) + " ~" + (fromY + y) + " ~" + (fromZ + z) + " " + block.typeName);
          }
        }
      }
    }

    return commands;
  }

  _generateColumnInfo() {
    const newColumns: IBlockCubeColumn[][] = new Array(this.maxZ);

    for (let z = 0; z < this.maxY; z++) {
      newColumns[z] = new Array(this.maxX);

      for (let x = 0; x < this.maxX; x++) {
        const blockX = this.x(x);
        let foundOpaqueTop = false;
        let foundContiguousTop = false;
        let opaqueTop = 0;
        let contiguousTop = 0;
        let top = 0;

        for (let y = 0; z < this.maxY; y++) {
          const block = blockX.y(y).z(z);

          if (!block.isEmpty && block.isOpaque && !foundOpaqueTop) {
            opaqueTop++;
          } else if (!block.isEmpty) {
            if (!foundContiguousTop) {
              contiguousTop++;
            }

            top = y;

            if (!block.isOpaque) {
              foundOpaqueTop = true;
            }
          } else {
            foundOpaqueTop = true;
            foundContiguousTop = true;
          }
        }

        newColumns[x][z] = {
          contiguousHeight: contiguousTop,
          height: top,
          opaqueHeight: opaqueTop,
        };
      }
    }

    return newColumns;
  }

  _notifyBlockTypeChanged(block: Block) {
    this._columns = undefined;

    this._onBlockTypeChanged.dispatch(this, block);
  }

  _notifyBlockPropertyChanged(block: Block) {
    this._onBlockPropertyChanged.dispatch(this, block);
  }

  x(int: number): BlockCubePlane {
    if (int > this.maxX) {
      throw new Error("Value exceeds maximum X");
    }

    while (int >= this.planes.length) {
      const newX = this.planes.length;
      this.planes[newX] = new BlockCubePlane(this, newX);
    }

    return this.planes[int];
  }

  fillEmpty(blockTypeId: string, xFrom: number, yFrom: number, zFrom: number, xTo: number, yTo: number, zTo: number) {
    for (let x = xFrom; x <= xTo; x++) {
      for (let y = yFrom; y <= yTo; y++) {
        let block = this.x(x).y(y).z(zFrom);

        block.typeName = blockTypeId;

        block = this.x(x).y(y).z(zTo);

        block.typeName = blockTypeId;
      }
    }

    for (let y = yFrom; y <= yTo; y++) {
      for (let z = zFrom + 1; z < zTo; z++) {
        let block = this.x(xFrom).y(y).z(z);

        block.typeName = blockTypeId;

        block = this.x(xTo).y(y).z(z);

        block.typeName = blockTypeId;
      }
    }
  }

  fill(blockTypeId: string, xFrom: number, yFrom: number, zFrom: number, xTo: number, yTo: number, zTo: number) {
    for (let x = xFrom; x <= xTo; x++) {
      for (let y = yFrom; y <= yTo; y++) {
        for (let z = zFrom; z <= zTo; z++) {
          const block = this.x(x).y(y).z(z);

          block.typeName = blockTypeId;
        }
      }
    }
  }

  fillY(blockTypeId: string, y: number) {
    for (let x = 0; x < this.maxX; x++) {
      const zSlice = this.x(x).y(y);

      for (let z = 0; z < this.maxZ; z++) {
        const block = zSlice.z(z);

        block.typeName = blockTypeId;
      }
    }
  }
}
