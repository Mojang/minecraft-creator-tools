import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import ActionGroup from "./ActionGroup";
import GroupAction from "./GroupAction";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class BlockExplodeAction extends GroupAction {
  get typeId() {
    return "block_explode";
  }

  validate() {
    return true;
  }

  getScriptRequirements(options: IScriptGenerationOptions): IScriptRequirements {
    return {
      needsTest: true,
    };
  }

  getCommandRequirements(options: ICommandOptions): ICommandRequirements {
    return {};
  }

  addCommandLines(lines: string[], indent: number, optons: ICommandOptions) {}

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (placement === ScriptGenerationPlacement.blockStart) {
      lines.push("export function " + this.group.name + "(event: mc.BlockExplodeAfterEventSignal) {");
    } else if (placement === ScriptGenerationPlacement.blockEnd) {
      lines.push("}");
    }

    if (placement === ScriptGenerationPlacement.initInSequence) {
      ActionGroup.addLine(
        lines,
        context.indent,
        "mc.world.afterEvents.blockExplode.subscribe(" + this.group.name + ");"
      );
    }
  }
}
