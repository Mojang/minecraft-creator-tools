import ActionGroup from "./ActionGroup";
import Location from "../minecraft/Location";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import TestSimulatedPlayerAction from "./TestSimulatedPlayerAction";

export default class TestSimulatedPlayerMoveAction extends TestSimulatedPlayerAction {
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
    return super.validate() && this.validateArgumentIsType("location", "Location");
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
