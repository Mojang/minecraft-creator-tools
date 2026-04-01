// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockLocation from "./BlockLocation";

export default class Location {
  private _x: number;
  private _y: number;
  private _z: number;

  public get x() {
    return this._x;
  }

  public set x(newX: number) {
    this._x = newX;
  }

  public get y() {
    return this._y;
  }

  public set y(newY: number) {
    this._y = newY;
  }

  public get z() {
    return this._z;
  }

  public set z(newZ: number) {
    this._z = newZ;
  }

  public toSummary() {
    return "(" + this.x.toPrecision(4) + "," + this.y.toPrecision(4) + "," + this.z.toPrecision(4) + ")";
  }

  public toRoundedBlockLocation() {
    return new BlockLocation(Math.round(this.x), Math.round(this.y), Math.round(this.z));
  }

  constructor(x: number | null | undefined, y: number | null | undefined, z: number | null | undefined) {
    this._x = x == null ? 0 : x;
    this._y = y == null ? 0 : y;
    this._z = z == null ? 0 : z;
  }

  distanceTo(location: Location) {
    return Math.sqrt(
      Math.pow(Math.abs(this._x - location.x), 2) +
        Math.pow(Math.abs(this._y - location.y), 2) +
        Math.pow(Math.abs(this._z - location.z), 2)
    );
  }
}
