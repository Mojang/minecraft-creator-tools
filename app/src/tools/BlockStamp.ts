import BlockLocation from "../minecraft/BlockLocation";
import BlockType from "../minecraft/BlockType";
import IDimension from "../minecraft/IDimension";

export class BlockStamp {
  static fillBlock(
    dimension: IDimension,
    blockType: BlockType,
    xFrom: number,
    yFrom: number,
    zFrom: number,
    xTo: number,
    yTo: number,
    zTo: number
  ) {
    for (let i = xFrom; i <= xTo; i++) {
      for (let j = yFrom; j <= yTo; j++) {
        for (let k = zFrom; k <= zTo; k++) {
          const block = dimension.getBlock(new BlockLocation(i, j, k));
          block.setType(blockType);
        }
      }
    }
  }

  static fourWalls(
    dimension: IDimension,
    blockType: BlockType,
    xFrom: number,
    yFrom: number,
    zFrom: number,
    xTo: number,
    yTo: number,
    zTo: number
  ) {
    for (let i = xFrom; i <= xTo; i++) {
      for (let k = yFrom; k <= yTo; k++) {
        let block = dimension.getBlock(new BlockLocation(i, k, zFrom));
        block.setType(blockType);

        block = dimension.getBlock(new BlockLocation(i, k, zTo));
        block.setType(blockType);
      }
    }

    for (let j = zFrom + 1; j < zTo; j++) {
      for (let k = yFrom; k <= yTo; k++) {
        let block = dimension.getBlock(new BlockLocation(xFrom, k, j));
        block.setType(blockType);

        block = dimension.getBlock(new BlockLocation(xTo, k, j));
        block.setType(blockType);
      }
    }
  }

  static fourNotchedWalls(
    dimension: IDimension,
    blockType: BlockType,
    xFrom: number,
    yFrom: number,
    zFrom: number,
    xTo: number,
    yTo: number,
    zTo: number
  ) {
    for (let i = xFrom + 1; i < xTo; i++) {
      for (let k = yFrom; k <= yTo; k++) {
        let block = dimension.getBlock(new BlockLocation(i, k, zFrom));
        block.setType(blockType);

        block = dimension.getBlock(new BlockLocation(i, k, zTo));
        block.setType(blockType);
      }
    }

    for (let j = zFrom + 1; j < zTo; j++) {
      for (let k = yFrom; k <= yTo; k++) {
        let block = dimension.getBlock(new BlockLocation(xFrom, k, j));
        block.setType(blockType);

        block = dimension.getBlock(new BlockLocation(xTo, k, j));
        block.setType(blockType);
      }
    }
  }
}
