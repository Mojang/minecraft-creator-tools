import AutoScriptAction from "./AutoScriptAction";
import AutoScriptGroup from "./AutoScriptGroup";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandRequirements from "./ICommandRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import IScriptOptions from "./IScriptOptions.js";
import Location from "../minecraft/Location";

export default class EntitySpawnAction extends AutoScriptAction {
  get typeTitle() {
    return "Spawn Entity";
  }

  get title() {
    if (!this.entityType) {
      return this.typeTitle;
    }

    return this.typeTitle + " " + this.entityType;
  }

  get entityType() {
    return this.getArgumentAsString("entityType");
  }

  get location() {
    return this.getArgumentAsLocation("location");
  }

  getJavaScriptRequirements(): IScriptRequirements {
    return {
      needsLocalOverworld: true,
    };
  }

  getCommandRequirements(): ICommandRequirements {
    return {};
  }

  addCommandLines(lines: string[], indent: number, options: ICommandOptions) {
    if (!this.entityType) {
      return;
    }

    let loc = this.location;

    if (!loc) {
      loc = new Location(0, 0, 0);
    }

    AutoScriptGroup.addLine(lines, indent, "summon " + this.entityType + " " + loc.x + " " + loc.y + " " + loc.z);
  }

  addJavaScriptLines(lines: string[], indent: number, options: IScriptOptions) {
    if (!this.entityType) {
      return;
    }

    let loc = this.location;

    if (!loc) {
      loc = new Location(0, 0, 0);
    }

    if (options.useGameTestApis) {
      AutoScriptGroup.addLine(
        lines,
        indent,
        'test.spawnEntity("' + this.entityType + '", new Location(' + loc.x + ", " + loc.y + ", " + loc.z + "));"
      );
    } else {
      AutoScriptGroup.addLine(
        lines,
        indent,
        'overworld.spawnEntity("' + this.entityType + '", new Location(' + loc.x + ", " + loc.y + ", " + loc.z + "));"
      );
    }
  }

  validate() {
    this.validateArgumentIsType("location", "Location");
    this.validateArgumentIsEntityType("entityType");

    return true;
  }

  getCommand() {
    return "";
  }

  getJavaScript() {
    return "";
  }
}
