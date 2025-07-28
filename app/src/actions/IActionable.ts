import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import IScriptRequirements from "./IScriptRequirements";

export interface IActionable {
  getScriptRequirements(options: IScriptGenerationOptions): IScriptRequirements;
  getCommandRequirements(options: ICommandOptions): ICommandRequirements;
  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ): void;
  addCommandLines(lines: string[], indent: number, options: ICommandOptions): void;
}
