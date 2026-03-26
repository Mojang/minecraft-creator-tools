import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import ICommandOptions from "./ICommandOptions";
import { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext from "./IScriptGenerationContext";

export default class MusicPlayAction extends Action {
  get typeId() {
    return "play_music";
  }

  get trackName() {
    return this.getArgumentAsString("trackName");
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
    if (!this.trackName) {
      return;
    }

    ActionGroup.addLine(lines, indent, "music " + this.trackName);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (!this.trackName) {
      return;
    }
    if (placement === ScriptGenerationPlacement.inSequence) {
      ActionGroup.addLine(lines, context.indent, 'mc.overworld.playMusic("' + this.trackName + '");');
    }
  }

  validate() {
    return true;
  }
}
