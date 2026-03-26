import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import ActionGroup from "./ActionGroup";
import GroupAction from "./GroupAction";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class TickGroupAction extends GroupAction {
  get typeTitle() {
    return "Tick";
  }

  get typeId() {
    return "tick";
  }

  get title() {
    return this.typeTitle;
  }

  get ticks() {
    return this.getArgumentAsNumber("ticks");
  }

  validate() {
    this.validateArgumentIsType("ticks", "number");

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
      let functionLine = "export function " + this.group.name + "() {";
      lines.push(functionLine);
    } else if (placement === ScriptGenerationPlacement.blockEnd) {
      lines.push("}");
    }

    if (placement === ScriptGenerationPlacement.initInSequence) {
      let ticks = this.getProperty("everyNTicks");

      if (!ticks) {
        ticks = 1;
      }
      ActionGroup.addLine(lines, context.indent, "mc.system.runInterval(" + this.group.name + ", " + ticks + ");");
    }
  }
}
