import ActionGroup from "./ActionGroup";
import ICommandOptions from "./ICommandOptions";
import Location from "../minecraft/Location";
import { SimulatedPlayer } from "@minecraft/server-gametest";
import ActionSetScope from "./ActionSetScope";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";
import TestSimulatedPlayerAction from "./TestSimulatedPlayerAction";

export default class TestSimulatedPlayerInteractionAction extends TestSimulatedPlayerAction {
  get shortSubjectId() {
    return "simplayer";
  }

  get typeTitle() {
    return "Test Simulated Player Interaction";
  }

  get typeId() {
    return "test_simulated_player_interaction";
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

  addCommandLines(lines: string[], indent: number, options: ICommandOptions) {
    let location = this.location;

    if (!location) {
      location = new Location(0, 0, 0);
    }

    ActionGroup.addLine(lines, indent, "tag @p[limit=1] add " + this.getCommandSet());
  }

  run(scope: ActionSetScope) {
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

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    ActionGroup.addLine(lines, context.indent, this.getScriptSet() + ".interact();");
  }
}
