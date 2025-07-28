import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import ActionGroup from "./ActionGroup";
import GroupAction from "./GroupAction";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class EntityDieAction extends GroupAction {
  get typeId() {
    return "entity_die";
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
      lines.push("export function " + this.group.name + "(event: mc.EntityDieAfterEventSignal) {");
    } else if (placement === ScriptGenerationPlacement.blockEnd) {
      lines.push("}");
    }

    if (placement === ScriptGenerationPlacement.initInSequence) {
      ActionGroup.addLine(lines, context.indent, "mc.world.afterEvents.entityDie.subscribe(" + this.group.name + ");");
    }
  }
}
