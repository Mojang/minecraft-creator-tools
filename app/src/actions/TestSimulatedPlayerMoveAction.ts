import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class TestSimulatedPlayerMoveAction extends Action {
  get typeTitle() {
    return "Move Simulated Player";
  }

  get typeId() {
    return "test_simulated_player_move";
  }

  get shortSubjectId() {
    return "simplayer";
  }

  get title() {
    if (!this.location) {
      return this.typeTitle;
    }

    return this.typeTitle + " " + this.location.toSummary();
  }

  get location() {
    return this.getArgumentAsLocation("location");
  }

  set location(location: Location | undefined) {
    if (!location) {
      (this.data as any)["location"] = undefined;
    } else {
      (this.data as any)["location"] = [location.x, location.y, location.z];
    }
  }

  validate() {
    this.validateArgumentIsType("location", "Location");

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

  addCommandLines(lines: string[], indent: number) {
    let location = this.location;

    if (!location) {
      location = new Location(0, 0, 0);
    }

    location = this.absolutizeLocation(location);

    ActionGroup.addLine(
      lines,
      indent,
      "tp @p[tag=" + this.getCommandWith() + "]" + location.x + " " + location.y + " " + location.z
    );
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    let location = this.location;

    if (!location) {
      location = new Location(0, 0, 0);
    }

    ActionGroup.addLine(
      lines,
      context.indent,
      this.getScriptWith() +
        ".moveToLocation(new Location(" +
        location.x +
        ", " +
        location.y +
        ", " +
        location.z +
        "));"
    );
  }
}
