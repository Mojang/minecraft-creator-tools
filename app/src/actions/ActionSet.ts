import IActionSetData, { ActionSetTarget } from "./IActionSetData";
import ActionGroup from "./ActionGroup";
import Test from "../gameTest/Test";
import Location from "../minecraft/Location";
import BlockLocation from "../minecraft/BlockLocation";

export default class ActionSet extends ActionGroup {
  actionSetData: IActionSetData;
  _test: Test | undefined;
  _locationRoot: Location | undefined;

  get targetType() {
    if (!this.actionSetData || !this.actionSetData.targetType) {
      return ActionSetTarget.general;
    }

    return this.actionSetData.targetType;
  }

  set targetType(newTargetType: ActionSetTarget) {
    this.actionSetData.targetType = newTargetType;
  }

  get locationRoot() {
    return this._locationRoot;
  }

  set locationRoot(newRoot: Location | undefined) {
    this._locationRoot = newRoot;
  }

  absolutizeLocation(location: Location) {
    if (!this.locationRoot) {
      return location;
    }

    return new Location(
      this.locationRoot.x + location.x,
      this.locationRoot.y + location.y,
      this.locationRoot.z + location.z
    );
  }

  absolutizeBlockLocation(location: BlockLocation) {
    if (!this.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(this.locationRoot.x + location.x),
      Math.round(this.locationRoot.y + location.y),
      Math.round(this.locationRoot.z + location.z)
    );
  }

  relativizeLocation(location: Location) {
    if (!this.locationRoot) {
      return location;
    }

    return new Location(
      location.x - this.locationRoot.x,
      location.y - this.locationRoot.y,
      location.z - this.locationRoot.z
    );
  }

  relativizeBlockLocation(location: BlockLocation) {
    if (!this.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(location.x - this.locationRoot.x),
      Math.round(location.y - this.locationRoot.y),
      Math.round(location.z - this.locationRoot.z)
    );
  }

  get test() {
    return this._test;
  }

  get name() {
    return this.actionSetData.name;
  }

  set name(newValue: string) {
    this.actionSetData.name = newValue;
  }

  constructor(data: IActionSetData) {
    super(data, undefined, true);
    this.actionSetData = data;
    this._actionSet = this;

    this._hydrate();
  }
}
