import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import ICommandOptions from "./ICommandOptions";
import { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext from "./IScriptGenerationContext";

export default class PlaySoundAction extends Action {
  get typeId() {
    return "sound_play";
  }

  get soundName() {
    return this.getArgumentAsString("soundName");
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
    if (!this.soundName) {
      return;
    }

    let loc = this.location;

    if (!loc) {
      loc = new Location(0, 0, 0);
    }

    ActionGroup.addLine(lines, indent, "playsound " + this.soundName + " " + loc.x + " " + loc.y + " " + loc.z);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (!this.soundName) {
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
        'overworld.playSound("' + this.soundName + '", { x: ' + loc.x + ", y: " + loc.y + ", z: " + loc.z + "});"
      );
    }
  }

  validate() {
    return true;
  }
}
