import Location from "../minecraft/Location";

export enum WorldDisplayObjectType {
  point = 0,
  plane = 1,
  cube = 2,
  path = 3,
}

export default class WorldDisplayObject {
  static _maxId = 0;

  type: WorldDisplayObjectType = WorldDisplayObjectType.point;

  points: Location[] = [];

  get from() {
    if (this.points.length < 1) {
      return new Location(0, 0, 0);
    }

    return this.points[0];
  }

  set from(newFrom: Location) {
    this.points[0] = newFrom;
  }

  get to() {
    if (this.points.length < 1) {
      return new Location(0, 0, 0);
    }

    return this.points[this.points.length - 1];
  }

  set to(newTo: Location) {
    this.points[this.points.length - 1] = newTo;
  }

  _id: number = WorldDisplayObject._maxId++;

  get id() {
    return this._id;
  }
}
