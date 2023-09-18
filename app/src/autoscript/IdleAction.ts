import AutoScriptAction from "./AutoScriptAction";
import AutoScriptGroup from "./AutoScriptGroup";
import IScriptOptions from "./IScriptOptions.js";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import ICommandRequirements from "./ICommandRequirements.js";

export default class IdleAction extends AutoScriptAction {
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

  getJavaScriptRequirements(options: IScriptOptions): IScriptRequirements {
    return {
      needsTest: true,
    };
  }

  getCommandRequirements(options: ICommandOptions): ICommandRequirements {
    return {};
  }

  addCommandLines(lines: string[], indent: number, optons: ICommandOptions) {}

  addJavaScriptLines(lines: string[], indent: number, optons: IScriptOptions) {
    AutoScriptGroup.addLine(lines, indent, "await " + this.getScriptTest() + ".idle(" + this.ticks + ");");
  }
}
