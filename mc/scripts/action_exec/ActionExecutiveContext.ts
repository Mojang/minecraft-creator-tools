import { Vector3Utils } from "@minecraft/math";
import { Dimension, Vector3 } from "@minecraft/server";

export class ActionExecutiveContext {
  location: Vector3;
  dimension: Dimension;

  constructor(location: Vector3, dimension: Dimension) {
    this.location = location;
    this.dimension = dimension;
  }

  getAbsoluteLocation(relativeLocation: Vector3): Vector3 {
    return Vector3Utils.add(this.location, relativeLocation);
  }
}
