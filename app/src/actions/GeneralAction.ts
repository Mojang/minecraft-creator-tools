import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import Action from "./Action";

export default class GeneralAction extends Action {
  _typeId = "general";

  get typeId() {
    return this._typeId;
  }

  set typeId(newTypeId: string) {
    this._typeId = newTypeId;
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
  ) {}
}
