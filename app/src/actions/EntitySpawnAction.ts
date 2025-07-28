import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import ICommandOptions from "./ICommandOptions";
import { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext from "./IScriptGenerationContext";
import Log from "../core/Log";

export default class EntitySpawnAction extends Action {
  get typeTitle() {
    return "Spawn Entity";
  }

  get typeId() {
    return "entity_spawn";
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

  getScriptRequirements(): IScriptRequirements {
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

    ActionGroup.addLine(lines, indent, "summon " + this.entityType + " " + loc.x + " " + loc.y + " " + loc.z);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (!this.entityType) {
      return;
    }
    if (placement === ScriptGenerationPlacement.inSequence) {
      let loc = this.location;

      if (!loc) {
        Log.debugAlert("Action does not have a defined location.");
      } else {
        if (options.useGameTestApis) {
          ActionGroup.addLine(
            lines,
            context.indent,
            'test.spawnEntity("' + this.entityType + '", { x: ' + loc.x + ", y: " + loc.y + ", z: " + loc.z + "});"
          );
        } else {
          ActionGroup.addLine(
            lines,
            context.indent,
            'overworld.spawnEntity("' + this.entityType + '", { x: ' + loc.x + ", y: " + loc.y + ", z: " + loc.z + "});"
          );
        }
      }
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
