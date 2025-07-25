import ActionSet from "./ActionSet";
import ActionGroup from "./ActionGroup";
import IAction from "./IAction";
import Location from "../minecraft/Location";
import BlockLocation from "../minecraft/BlockLocation";
import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import { EventDispatcher } from "ste-events";
import IGetSetPropertyObject from "../dataform/IGetSetPropertyObject";
import ActionSetScope from "./ActionSetScope";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import { IActionable } from "./IActionable";
import IFormDefinition from "../dataform/IFormDefinition";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export enum ActionType {
  simulatedPlayerSpawn = "test_simulated_player_spawn",
  simulatedPlayerMove = "test_simulated_player_move",
  simulatedPlayerInteract = "test_simulated_player_interact",
  entitySpawn = "entity_spawn",
  idle = "test_idle",
}

export default abstract class Action implements IGetSetPropertyObject, IActionable {
  data: IAction;
  group: ActionGroup;
  typeForm?: IFormDefinition;
  actionSet: ActionSet;

  get id() {
    return this.data.id;
  }

  set id(newId: string | undefined) {
    this.data.id = newId;
  }

  private _onPropertyChanged = new EventDispatcher<Action, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get typeId() {
    return "action";
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

  get type(): string {
    return this.data.type;
  }

  getDataCopy() {
    const result: { [propName: string]: any } = {};

    if (this.data) {
      for (const propName in this.data) {
        let val = (this.data as any)[propName];

        if (val) {
          result[propName] = val;
        }
      }
    }

    return result;
  }

  constructor(group: ActionGroup, data: IAction) {
    this.group = group;

    if (!this.group._actionSet) {
      throw new Error("Cannot add action to unattached group");
    }

    this.actionSet = this.group._actionSet;

    this.data = data;
  }

  abstract validate(): boolean;

  run(scope: ActionSetScope) {}

  getProperty(id: string) {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }

    return (this.data as any)[id] as any;
  }

  setProperty(id: string, value: any) {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }

    (this.data as any)[id] = value;
  }

  getBaseValue(): any {
    return this.data as any;
  }

  setBaseValue(value: any): void {
    (this.data as any) = value;
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

  abstract getScriptRequirements(options: IScriptGenerationOptions): IScriptRequirements;
  abstract getCommandRequirements(options: ICommandOptions): ICommandRequirements;
  abstract addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ): void;
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

    return 0;
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
    if (!this.actionSet.locationRoot) {
      return location;
    }

    return new Location(
      this.actionSet.locationRoot.x + location.x,
      this.actionSet.locationRoot.y + location.y,
      this.actionSet.locationRoot.z + location.z
    );
  }

  absolutizeBlockLocation(location: BlockLocation) {
    if (!this.actionSet.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(this.actionSet.locationRoot.x + location.x),
      Math.round(this.actionSet.locationRoot.y + location.y),
      Math.round(this.actionSet.locationRoot.z + location.z)
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
