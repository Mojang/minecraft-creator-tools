import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import ICommandOptions from "./ICommandOptions";
import { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext from "./IScriptGenerationContext";

export default class ParticleSpawnAction extends Action {
  get typeId() {
    return "particle_spawn";
  }

  get particleName() {
    return this.getArgumentAsString("particleName");
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
    if (!this.particleName) {
      return;
    }

    let loc = this.location;

    if (!loc) {
      loc = new Location(0, 0, 0);
    }

    ActionGroup.addLine(lines, indent, "particle " + this.particleName + " " + loc.x + " " + loc.y + " " + loc.z);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (!this.particleName) {
      return;
    }
    if (placement === ScriptGenerationPlacement.inSequence) {
      let loc = this.location;

      if (!loc) {
        loc = new Location(0, 0, 0);
      }

      ActionGroup.addLine(
        lines,
        context.indent,
        'overworld.spawnParticle("' + this.particleName + '", { x: ' + loc.x + ", y: " + loc.y + ", z: " + loc.z + "});"
      );
    }
  }

  validate() {
    return true;
  }
}
