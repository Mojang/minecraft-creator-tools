import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import GroupAction from "./GroupAction";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class SequenceGroupAction extends GroupAction {
  get typeTitle() {
    return "Sequence";
  }

  get typeId() {
    return "sequence";
  }

  get title() {
    return this.typeTitle;
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
      let functionLine = "export function " + this.group.name + "() {";
      lines.push(functionLine);
    } else if (placement === ScriptGenerationPlacement.blockEnd) {
      lines.push("}");
    }
  }
}
