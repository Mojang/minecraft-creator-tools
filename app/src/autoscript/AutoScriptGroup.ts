import AutoScript from "./AutoScript";
import AutoScriptAction from "./AutoScriptAction";
import EntitySpawnAction from "./EntitySpawnAction";
import SimulatedPlayerMoveAction from "./SimulatedPlayerMoveAction";
import IAutoScriptAction from "./IAutoScriptAction";
import IAutoScriptGroup from "./IAutoScriptGroup";
import SimulatedPlayerSpawnAction from "./SimulatedPlayerSpawnAction";
import IdleAction from "./IdleAction";
import IScriptOptions from "./IScriptOptions";
import ICommandOptions from "./ICommandOptions";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import Test from "../gameTest/Test";
import AutoScriptScope from "./AutoScriptScope";

import Location from "../minecraft/Location";
import BlockLocation from "../minecraft/BlockLocation";
import IWorld from "../minecraft/IWorld";

export default class AutoScriptGroup {
  data: IAutoScriptGroup;
  script?: AutoScript;
  actions: AutoScriptAction[];

  constructor(data: IAutoScriptGroup) {
    this.data = data;
    this.actions = [];
  }

  run(world?: IWorld, test?: Test, parentScope?: AutoScriptScope) {
    const scope = new AutoScriptScope();

    scope.parent = parentScope;
    scope.test = test;
    scope.world = world;

    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];

      action.run(scope);
    }
  }

  absolutizeLocation(location: Location) {
    if (!this.script || !this.script.locationRoot) {
      return location;
    }

    return new Location(
      this.script.locationRoot.x + location.x,
      this.script.locationRoot.y + location.y,
      this.script.locationRoot.z + location.z
    );
  }

  absolutizeBlockLocation(location: BlockLocation) {
    if (!this.script || !this.script.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(this.script.locationRoot.x + location.x),
      Math.round(this.script.locationRoot.y + location.y),
      Math.round(this.script.locationRoot.z + location.z)
    );
  }

  relativizeLocation(location: Location) {
    if (!this.script || !this.script.locationRoot) {
      return location;
    }

    return new Location(
      location.x - this.script.locationRoot.x,
      location.y - this.script.locationRoot.y,
      location.z - this.script.locationRoot.z
    );
  }

  relativizeBlockLocation(location: BlockLocation) {
    if (!this.script || !this.script.locationRoot) {
      return location;
    }

    return new BlockLocation(
      Math.round(location.x - this.script.locationRoot.x),
      Math.round(location.y - this.script.locationRoot.y),
      Math.round(location.z - this.script.locationRoot.z)
    );
  }

  addAction(action: AutoScriptAction) {
    this.actions.push(action);
  }

  addJavaScriptGroupLines(lines: string[], indent: number, options: IScriptOptions) {
    const req: IScriptRequirements = {};

    for (const action of this.actions) {
      AutoScriptGroup.mergeScriptRequirements(req, action.getJavaScriptRequirements(options));
    }

    if (req.needsLocalOverworld) {
      AutoScriptGroup.addLine(lines, indent, 'const overworld = world.getDimension("overworld");');
    }

    for (const action of this.actions) {
      action.addJavaScriptLines(lines, indent, options);

      if (options.addTestIdlePause) {
        AutoScriptGroup.addLine(lines, indent, "await test.idle(15);");
      }
    }
  }

  addCommandGroupLines(lines: string[], indent: number, options: ICommandOptions) {
    const req: ICommandRequirements = {};

    for (const action of this.actions) {
      AutoScriptGroup.mergeCommandRequirements(req, action.getCommandRequirements(options));
    }

    for (const action of this.actions) {
      action.addCommandLines(lines, indent, options);
    }
  }

  static mergeScriptOptions(source: IScriptOptions, add: IScriptOptions) {
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
        const action = this.getActionFromData(actionData);
        this.actions.push(action);
      }
    }
  }

  removeAction(removeAction: AutoScriptAction) {
    const newActionArr: AutoScriptAction[] = [];

    for (const action of this.actions) {
      if (action !== removeAction) {
        newActionArr.push(action);
      }
    }

    this.actions = newActionArr;
  }

  createAction(type: string) {
    let action = undefined;

    switch (type) {
      case "entity.spawn":
        action = new EntitySpawnAction(this, { type: type });
        break;
      case "simulatedplayer.spawn":
        action = new SimulatedPlayerSpawnAction(this, { type: type });
        break;
      case "simulatedplayer.move":
        action = new SimulatedPlayerMoveAction(this, { type: type });
        break;
      case "idle":
        action = new IdleAction(this, { type: type });
        break;
    }

    if (action) {
      this.actions.push(action);

      if (!this.data.actions) {
        this.data.actions = [];
      }

      this.data.actions.push(action.data);
    }
  }

  getActionFromData(data: IAutoScriptAction): AutoScriptAction {
    switch (data.type) {
      case "entity.spawn":
        return new EntitySpawnAction(this, data);

      case "simulatedplayer.spawn":
        return new SimulatedPlayerSpawnAction(this, data);

      case "simulatedplayer.move":
        return new SimulatedPlayerMoveAction(this, data);

      case "idle":
        return new IdleAction(this, data);

      default:
        throw new Error("Unexpected action type: " + data.type);
    }
  }
}
