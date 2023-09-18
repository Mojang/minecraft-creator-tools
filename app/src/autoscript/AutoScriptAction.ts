import AutoScript from "./AutoScript.js";
import AutoScriptGroup from "./AutoScriptGroup.js";
import IAutoScriptAction from "./IAutoScriptAction.js";
import Location from "./../minecraft/Location";
import BlockLocation from "./../minecraft/BlockLocation";
import IScriptOptions from "./IScriptOptions.js";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import ICommandRequirements from "./ICommandRequirements.js";
import { EventDispatcher } from "ste-events";
import IGetSetPropertyObject from "../dataform/IGetSetPropertyObject.js";
import AutoScriptScope from "./AutoScriptScope.js";

export enum AutoScriptActionType {
  simulatedPlayerSpawn = "simulatedplayer.spawn",
  simulatedPlayerMove = "simulatedplayer.move",
  simulatedPlayerInteract = "simulatedplayer.interact",
  spawnEntity = "entity.spawn",
  idle = "idle",
}

export default abstract class AutoScriptAction implements IGetSetPropertyObject {
  data: IAutoScriptAction;
  group: AutoScriptGroup;
  script: AutoScript;

  private _onPropertyChanged = new EventDispatcher<AutoScriptAction, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get shortSubjectId() {
    return "obj";
  }

  get withId() {
    const withId = this.data.withId;

    if (withId) {
      return withId;
    }

    return this.shortSubjectId;
  }

  get setId() {
    const setId = this.data.setId;

    if (setId) {
      return setId;
    }

    return this.shortSubjectId;
  }

  abstract get typeTitle(): string;
  abstract get title(): string;

  get type(): string {
    return this.data.type;
  }

  constructor(group: AutoScriptGroup, data: IAutoScriptAction) {
    this.group = group;

    if (!this.group.script) {
      throw new Error("Cannot add action to unattached group");
    }

    this.script = this.group.script;

    this.data = data;
  }

  abstract validate(): boolean;

  run(scope: AutoScriptScope) {}

  getProperty(id: string) {
    return (this.data as any)[id] as any;
  }

  setProperty(id: string, value: any) {
    (this.data as any)[id] = value;
  }

  getArgumentAsLocation(name: string) {
    const val = (this.data as any)[name];

    if (val instanceof Array && val.length >= 3) {
      const loc = new Location(val[0], val[1], val[2]);

      return loc;
    }

    return undefined;
  }

  getArgumentAsBlockLocation(name: string) {
    const val = (this.data as any)[name];

    if (val instanceof Array && val.length >= 3) {
      const loc = new BlockLocation(val[0], val[1], val[2]);

      return loc;
    }

    return undefined;
  }

  _notifyPropertyChanged(propertyName: string) {
    this._onPropertyChanged.dispatch(this, propertyName);
  }

  abstract getJavaScriptRequirements(options: IScriptOptions): IScriptRequirements;
  abstract getCommandRequirements(options: ICommandOptions): ICommandRequirements;
  abstract addJavaScriptLines(lines: string[], indent: number, options: IScriptOptions): void;
  abstract addCommandLines(lines: string[], indent: number, options: ICommandOptions): void;

  getScriptTest() {
    return "test";
  }

  getScriptWith() {
    if (!this.data.withId) {
      return "obj";
    }

    return this.data.withId;
  }

  getScriptSet() {
    if (!this.data.setId) {
      return "obj";
    }

    return this.data.setId;
  }

  getCommandWith() {
    if (!this.data.withId) {
      return "obj";
    }

    return this.data.withId;
  }

  getCommandSet() {
    if (!this.data.setId) {
      return "obj";
    }

    return this.data.setId;
  }

  getArgumentAsNumber(name: string) {
    const val = (this.data as any)[name];

    if (typeof val === "number") {
      return val;
    } else if (typeof val === "string") {
      return parseFloat(val);
    }

    throw new Error();
  }

  getArgumentAsString(name: string) {
    const val = (this.data as any)[name];

    return val;
  }

  validateArgumentIsEntityType(name: string) {
    const val = (this.data as any)[name];

    if (!val || typeof val !== "string") {
      throw new Error("Argument '" + name + "' is not defined.");
    }

    return true;
  }

  absolutizeLocation(location: Location) {
    if (!this.script.locationRoot) {
      return location;
    }

    return new Location(
      this.script.locationRoot.x + location.x,
      this.script.locationRoot.y + location.y,
      this.script.locationRoot.z + location.z
    );
  }

  absolutizeBlockLocation(location: BlockLocation) {
    if (!this.script.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(this.script.locationRoot.x + location.x),
      Math.round(this.script.locationRoot.y + location.y),
      Math.round(this.script.locationRoot.z + location.z)
    );
  }

  validateArgumentIsType(name: string, type: string) {
    const val = (this.data as any)[name];

    const typestr = typeof val;

    switch (type) {
      case "BlockLocation":
      case "Location":
        if (!(val instanceof Array) || val.length !== 3) {
          throw new Error("Expected an array of 3 numbers for parameter '" + name + "'");
        }
        break;

      case "boolean":
      case "number":
      case "string":
        if (typestr !== type) {
          throw new Error("Unexpected type mismatch: " + name + " is " + typestr + " (expected " + type + ")");
        }
        break;
    }

    return true;
  }
}
