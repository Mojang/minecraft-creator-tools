// ======= UTILITIES =================================================================================================

export class Utilities {
  static fillBlock(test, blockType, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    for (let i = xFrom; i <= xTo; i++) {
      for (let j = yFrom; j <= yTo; j++) {
        for (let k = zFrom; k <= zTo; k++) {
          test.setBlockType(blockType, { x: i, y: j, z: k });
        }
      }
    }
  }

  static addFourWalls(test, blockType, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    for (let xCoord = xFrom; xCoord <= xTo; xCoord++) {
      for (let yCoord = yFrom; yCoord <= yTo; yCoord++) {
        test.setBlockType(blockType, { x: xCoord, y: yCoord, z: zFrom });
        test.setBlockType(blockType, { x: xCoord, y: yCoord, z: zTo });
      }
    }

    for (let zCoord = zFrom + 1; zCoord < zTo; zCoord++) {
      for (let yCoord = yFrom; yCoord <= yTo; yCoord++) {
        test.setBlockType(blockType, { x: xFrom, y: yCoord, z: zCoord });
        test.setBlockType(blockType, { x: xTo, y: yCoord, z: zCoord });
      }
    }
  }

  static addFourNotchedWalls(test, blockType, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    for (let xCoord = xFrom + 1; xCoord < xTo; xCoord++) {
      for (let yCoord = yFrom; yCoord <= yTo; yCoord++) {
        test.setBlockType(blockType, { x: xCoord, y: yCoord, z: zFrom });
        test.setBlockType(blockType, { x: xCoord, y: yCoord, z: zTo });
      }
    }

    for (let zCoord = zFrom + 1; zCoord < zTo; zCoord++) {
      for (let yCoord = yFrom; yCoord <= yTo; yCoord++) {
        test.setBlockType(blockType, { x: xFrom, y: yCoord, z: zCoord });
        test.setBlockType(blockType, { x: xTo, y: yCoord, z: zCoord });
      }
    }
  }

  static assertEntityNotInVolume(test, entityType, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    const fromLoc = test.worldLocation({ x: xFrom, y: yFrom, z: zFrom });

    const entities = test.getDimension().getEntities({
      type: entityType,
      location: fromLoc,
      volume: {
        x: xTo - xFrom,
        y: yTo - yFrom,
        z: zTo - zFrom,
      },
    });

    test.assert(entities.length === 0, "Entity of type '" + entityType + "' found (" + entities.length + ")");
  }

  static assertEntityInVolume(test, entityType, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    const fromLoc = test.worldLocation({ x: xFrom, y: yFrom, z: zFrom });

    const entities = test.getDimension().getEntities({
      type: entityType,
      location: fromLoc,
      volume: {
        x: xTo - xFrom,
        y: yTo - yFrom,
        z: zTo - zFrom,
      },
    });

    test.assert(entities.length > 0, "Entity of type '" + entityType + "' was not found (" + entities.length + ")");
  }
}
