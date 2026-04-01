// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockBaseTypeData, { BlockShape } from "./IBlockBaseTypeData";

export default class BlockBaseType {
  private _name = "";

  public data: IBlockBaseTypeData;

  get icon() {
    return this.data.ic;
  }

  getProperty(name: string) {
    if (this.data.properties === undefined) {
      return undefined;
    }

    for (let i = 0; i < this.data.properties.length; i++) {
      if (this.data.properties[i].name === name) {
        return this.data.properties[i];
      }
    }

    throw new Error();
  }

  get isOpaque() {
    if (this.data.isOpaque !== undefined) {
      return this.data.isOpaque;
    }

    // Shapes that are inherently non-opaque (transparent, partial, or see-through)
    const nonOpaqueShapes = [
      BlockShape.fence,
      BlockShape.fenceGate,
      BlockShape.door,
      BlockShape.trapdoor,
      BlockShape.button,
      BlockShape.pressurePlate,
      BlockShape.torch,
      BlockShape.lantern,
      BlockShape.chain,
      BlockShape.ladder,
      BlockShape.rail,
      BlockShape.lever,
      BlockShape.candle,
      BlockShape.endRod,
      BlockShape.glassPaneOrBars,
      BlockShape.billboard,
      BlockShape.carpet,
      BlockShape.crop,
      BlockShape.leaves,
      BlockShape.water,
      BlockShape.redstoneWire,
      BlockShape.sign,
      BlockShape.hangingSign,
      BlockShape.campfire,
      BlockShape.bell,
      BlockShape.hopper,
      BlockShape.brewingStand,
      BlockShape.enchantingTable,
      BlockShape.cauldron,
      BlockShape.dripleaf,
    ];

    // Non-opaque shapes should not hide adjacent faces
    if (nonOpaqueShapes.includes(this.shape)) {
      return false;
    }

    // Default: solid blocks (custom, unitCube, stairs, slab, wall, anvil, bed, chest, etc.)
    // are opaque and correctly cull hidden faces between adjacent blocks
    return true;
  }

  get mapColor(): string | undefined {
    return this.data.mc;
  }

  get shape(): BlockShape {
    // Support both abbreviated (sh) and full (shape) property names
    const shapeValue = this.data.sh;
    if (shapeValue === undefined) {
      return BlockShape.custom;
    }

    return shapeValue;
  }

  get friendlyName(): string | undefined {
    return this.data.t;
  }

  get name() {
    return this._name;
  }

  constructor(name: string) {
    this._name = name;

    this.data = {
      n: name,
    };
  }
}
