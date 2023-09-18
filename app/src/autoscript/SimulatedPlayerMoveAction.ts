import AutoScriptAction from "./AutoScriptAction";
import AutoScriptGroup from "./AutoScriptGroup";
import IScriptOptions from "./IScriptOptions";
import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import Location from "./../minecraft/Location";

export default class SimulatedPlayerMoveAction extends AutoScriptAction {
  get typeTitle() {
    return "Move Simulated Player";
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

  getJavaScriptRequirements(options: IScriptOptions): IScriptRequirements {
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

    AutoScriptGroup.addLine(
      lines,
      indent,
      "tp @p[tag=" + this.getCommandWith() + "]" + location.x + " " + location.y + " " + location.z
    );
  }

  addJavaScriptLines(lines: string[], indent: number, options: IScriptOptions) {
    let location = this.location;

    if (!location) {
      location = new Location(0, 0, 0);
    }

    AutoScriptGroup.addLine(
      lines,
      indent,
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
