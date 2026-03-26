// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Location from "./Location";

export default class BlockLocation {
  private _x: number;
  private _y: number;
  private _z: number;

  public get x() {
    return this._x;
  }

  public set x(newX: number) {
    Log.assertIsInt(newX, "BLX");
    this._x = newX;
  }

  public get y() {
    return this._y;
  }

  public set y(newY: number) {
    Log.assertIsInt(newY, "BLY");
    this._y = newY;
  }

  public get z() {
    return this._z;
  }

  public set z(newZ: number) {
    Log.assertIsInt(newZ, "BLZ");
    this._z = newZ;
  }

  public get title() {
    return this.x + "x" + this.y + "y" + this.z + "z";
  }

  public toLocation() {
    return new Location(this.x, this.y, this.z);
  }

  public toArray() {
    return [this.x, this.y, this.z];
  }

  public toSummary() {
    return "(" + this.x + "," + this.y + "," + this.z + ");";
  }

  constructor(x: number | null | undefined, y: number | null | undefined, z: number | null | undefined) {
    this._x = x == null ? 0 : x;
    this._y = y == null ? 0 : y;
    this._z = z == null ? 0 : z;

    Log.assertIsInt(this._x, "BLCX");
    Log.assertIsInt(this._y, "BLCY");
    Log.assertIsInt(this._z, "BLCZ");
  }

  static from(value: any): BlockLocation {
    if (value instanceof BlockLocation) {
      return value;
    }

    if (value instanceof Location) {
      return value.toRoundedBlockLocation();
    }

    if (value.length && value.length === 3) {
      return new BlockLocation(value[0], value[1], value[2]);
    }

    if (!value) {
      return new BlockLocation(0, 0, 0);
    }

    if (value.x || value.y || value.z) {
      return new BlockLocation(value.x, value.y, value.z);
    }

    return new BlockLocation(0, 0, 0);
  }
}
