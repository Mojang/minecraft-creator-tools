import AutoScriptAction from "./AutoScriptAction";
import AutoScriptGroup from "./AutoScriptGroup";
import IScriptOptions from "./IScriptOptions.js";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import Location from "./../minecraft/Location";
import ICommandRequirements from "./ICommandRequirements.js";
import SimulatedPlayer from "../gameTest/SimulatedPlayer.js";
import AutoScriptScope from "./AutoScriptScope.js";

export default class SimulatedPlayerInteractionAction extends AutoScriptAction {
  get shortSubjectId() {
    return "simplayer";
  }

  get typeTitle() {
    return "Simulated Player Interaction";
  }

  get title() {
    let title = this.typeTitle;

    if (this.location) {
      title += " " + this.location.toSummary();
    }

    return title;
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

  addCommandLines(lines: string[], indent: number, options: ICommandOptions) {
    let location = this.location;

    if (!location) {
      location = new Location(0, 0, 0);
    }

    AutoScriptGroup.addLine(lines, indent, "tag @p[limit=1] add " + this.getCommandSet());
  }

  run(scope: AutoScriptScope) {
    if (!scope.test) {
      scope.addError(this, "Test is not specified");
      return;
    }

    if (!this.location) {
      scope.addError(this, "Location is not specified");
      return;
    }

    //const simPlayer = scope.test.spawnSimulatedPlayer(this.location);

    const simPlayer = scope.getState(this.setId) as SimulatedPlayer;

    if (simPlayer) {
      simPlayer.interact();
    }
    //scope.setState(this.setId, simPlayer);
  }

  addJavaScriptLines(lines: string[], indent: number, options: IScriptOptions) {
    AutoScriptGroup.addLine(lines, indent, this.getScriptSet() + ".interact();");
  }
}
