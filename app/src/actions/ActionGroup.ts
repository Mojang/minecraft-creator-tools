import ActionSet from "./ActionSet";
import Action from "./Action";
import IActionGroup from "./IActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import Test from "../gameTest/Test";
import ActionSetScope from "./ActionSetScope";

import Location from "../minecraft/Location";
import BlockLocation from "../minecraft/BlockLocation";
import IWorld from "../minecraft/IWorld";
import { ActionSetCatalog } from "./ActionSetCatalog";
import IAction, { ActionContextType } from "./IAction";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import IGetSetPropertyObject from "../dataform/IGetSetPropertyObject";
import { EventDispatcher } from "ste-events";
import { IActionable } from "./IActionable";
import ICommandOptions from "./ICommandOptions";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class ActionGroup implements IGetSetPropertyObject, IActionable {
  data: IActionGroup;
  _actionSet?: ActionSet;
  actions: (Action | ActionGroup)[];
  expectedContext: ActionContextType = ActionContextType.general;
  _groupAction?: Action;

  private _onPropertyChanged = new EventDispatcher<Action, string>();

  public get groupActionType() {
    return this.data?.groupActionType;
  }

  public set groupActionType(newGat: string | undefined) {
    if (!this.data) {
      this.data = {
        actions: [],
      };
    }

    if (newGat !== this.data.groupActionType) {
      this._groupAction = undefined;
      this.data.groupActionType = newGat;
      this.ensureGroupAction();
    }
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get actionSet() {
    return this._actionSet;
  }

  set actionSet(newActionSet: ActionSet | undefined) {
    this._actionSet = newActionSet;
  }

  get id() {
    return this.data.id;
  }

  set id(newId: string | undefined) {
    this.data.id = newId;
  }

  get name() {
    return this.data.name;
  }

  set name(newName: string | undefined) {
    this.data.name = newName;
  }

  get typeId() {
    if (this.data.groupActionType) {
      return this.data.groupActionType;
    }

    return "group";
  }

  get canvasX() {
    return this.data.canvasX;
  }

  set canvasX(inboundX: number | undefined) {
    this.data.canvasX = inboundX;
  }

  get canvasY() {
    return this.data.canvasY;
  }

  set canvasY(inboundY: number | undefined) {
    this.data.canvasY = inboundY;
  }

  constructor(data: IActionGroup, actionSet?: ActionSet, doNotHydrate?: boolean) {
    this.data = data;
    this._actionSet = actionSet;
    this.actions = [];

    if (!doNotHydrate) {
      this._hydrate();
    }
  }

  getScriptRequirements(options: IScriptGenerationOptions) {
    return {};
  }

  getCommandRequirements(options: ICommandOptions) {
    return {};
  }
  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ): void {}
  addCommandLines(lines: string[], indent: number, options: ICommandOptions): void {}

  getProperty(id: string) {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }

    if (!this.data.groupActionData) {
      return undefined;
    }

    if (this._groupAction) {
      return this._groupAction.getProperty(id);
    }

    return (this.data.groupActionData as any)[id] as any;
  }

  setProperty(id: string, value: any) {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      throw new Error();
    }
    if (!this.data.groupActionData && this.data.groupActionType) {
      this.data.groupActionData = {
        type: this.data.groupActionType,
      };
    }

    if (this.groupAction) {
      this.groupAction.setProperty(id, value);
    }
  }

  ensureGroupAction() {
    if (!this._groupAction && this.data && this.data.groupActionType) {
      this._hydrateGroupAction();
    }
  }

  get groupAction() {
    if (this._groupAction) {
      return this._groupAction;
    }

    this.ensureGroupAction();

    return this._groupAction;
  }

  getBaseValue(): any {
    return this.data as any;
  }

  setBaseValue(value: any): void {
    (this.data as any) = value;
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

  _hydrate() {
    this.actions = [];

    if (this.data.actions && Array.isArray(this.data.actions)) {
      for (const dataAction of this.data.actions) {
        if (dataAction.actions) {
          const newActionGroup = ActionSetCatalog.createActionGroup(this, dataAction as IActionGroup);
          this.actions.push(newActionGroup);
        } else if ((dataAction as IAction).type) {
          const newAction = ActionSetCatalog.createAction(this, (dataAction as IAction).type, dataAction as IAction);
          this.actions.push(newAction);
        }
      }
    }

    this._hydrateGroupAction();
  }

  _hydrateGroupAction() {
    if (this.data && this.data.groupActionType) {
      if (!this.data.groupActionData) {
        this.data.groupActionData = { type: this.data.groupActionType };
      }

      const act = ActionSetCatalog.createAction(this, this.data.groupActionType, this.data.groupActionData);

      this._groupAction = act;
    }
  }

  startRun(world?: IWorld, test?: Test) {
    const scope = new ActionSetScope();

    scope.test = test;
    scope.world = world;

    this.run(scope);
  }

  run(parentScope: ActionSetScope) {
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];

      action.run(parentScope);
    }
  }

  setActions(newActionList: (Action | ActionSet)[]) {
    this.actions = newActionList;
    const dataArr: (IAction | IActionGroup)[] = [];

    for (const actionOrGroup of newActionList) {
      actionOrGroup.actionSet = this.actionSet;

      dataArr.push(actionOrGroup.data);
    }

    this.data.actions = dataArr;
  }

  absolutizeLocation(location: Location) {
    if (!this._actionSet || !this._actionSet.locationRoot) {
      return location;
    }

    return new Location(
      this._actionSet.locationRoot.x + location.x,
      this._actionSet.locationRoot.y + location.y,
      this._actionSet.locationRoot.z + location.z
    );
  }

  absolutizeBlockLocation(location: BlockLocation) {
    if (!this._actionSet || !this._actionSet.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(this._actionSet.locationRoot.x + location.x),
      Math.round(this._actionSet.locationRoot.y + location.y),
      Math.round(this._actionSet.locationRoot.z + location.z)
    );
  }

  relativizeLocation(location: Location) {
    if (!this._actionSet || !this._actionSet.locationRoot) {
      return location;
    }

    return new Location(
      location.x - this._actionSet.locationRoot.x,
      location.y - this._actionSet.locationRoot.y,
      location.z - this._actionSet.locationRoot.z
    );
  }

  relativizeBlockLocation(location: BlockLocation) {
    if (!this._actionSet || !this._actionSet.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(location.x - this._actionSet.locationRoot.x),
      Math.round(location.y - this._actionSet.locationRoot.y),
      Math.round(location.z - this._actionSet.locationRoot.z)
    );
  }

  addAction(action: Action | ActionGroup) {
    this.actions.push(action);

    if (!this.data.actions) {
      this.data.actions = [];
    }

    this.data.actions.push(action.data);
  }

  static mergeScriptOptions(source: IScriptGenerationOptions, add: IScriptGenerationOptions) {
    source.isFunction = source.isFunction || add.isFunction;
  }

  static mergeScriptRequirements(source: IScriptRequirements, add: IScriptRequirements) {
    source.needsLocalOverworld = source.needsLocalOverworld || add.needsLocalOverworld;
  }

  static mergeCommandRequirements(source: ICommandRequirements, add: ICommandRequirements) {}

  static addLine(lines: string[], indent: number, line: string) {
    lines.push(this.getIndentSpaces(indent) + line);
  }

  static getIndentSpaces(indent: number) {
    let result = "";

    for (let i = 0; i < indent; i++) {
      result += " ";
    }

    return result;
  }

  ensureLoaded() {
    if (this.data.actions) {
      for (const actionData of this.data.actions) {
        if ((actionData as IAction).type) {
          const action = ActionSetCatalog.createAction(this, (actionData as IAction).type, actionData as IAction);

          this.actions.push(action);
        }
      }
    }
  }

  removeAction(removeAction: Action) {
    const newActionArr: (Action | ActionGroup)[] = [];

    for (const action of this.actions) {
      if (action !== removeAction) {
        newActionArr.push(action);
      }
    }

    this.actions = newActionArr;
  }
}
