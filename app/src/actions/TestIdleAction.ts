import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import ICommandRequirements from "./ICommandRequirements.js";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class TestIdleAction extends Action {
  get typeTitle() {
    return "Idle";
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
    if (placement === ScriptGenerationPlacement.inSequence) {
      ActionGroup.addLine(lines, context.indent, "await " + this.getScriptTest() + ".idle(" + this.ticks + ");");
    }
  }
}
