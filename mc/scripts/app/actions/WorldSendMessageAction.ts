import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandRequirements from "./ICommandRequirements";
import ICommandOptions from "./ICommandOptions";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class WorldSendMessageAction extends Action {
  get typeId() {
    return "world_send_message";
  }

  get message() {
    return this.getArgumentAsString("message");
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
    if (!this.message) {
      return;
    }

    ActionGroup.addLine(lines, indent, "say " + this.message);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (!this.message) {
      return;
    }
    if (placement === ScriptGenerationPlacement.inSequence) {
      ActionGroup.addLine(lines, context.indent, 'mc.world.sendMessage("' + this.message + '");');
    }
  }

  validate() {
    return true;
  }
}
