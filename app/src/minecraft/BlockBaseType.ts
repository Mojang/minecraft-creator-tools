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
    if (this.data.isOpaque === undefined) {
      return false;
    }

    return this.data.isOpaque;
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
