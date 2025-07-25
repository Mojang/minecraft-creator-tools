import Action from "./Action";
import ActionGroup from "./ActionGroup";
import IScriptRequirements from "./IScriptRequirements.js";
import ICommandOptions from "./ICommandOptions.js";
import BlockLocation from "../minecraft/BlockLocation";
import ICommandRequirements from "./ICommandRequirements.js";
import ActionSetScope from "./ActionSetScope.js";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import IScriptGenerationContext, { ScriptGenerationPlacement } from "./IScriptGenerationContext";

export default class SimulatedPlayerSpawnAction extends Action {
  get shortSubjectId() {
    return "simplayer";
  }

  get typeTitle() {
    return "Spawn Simulated Player";
  }

  get typeId() {
    return "test_simulated_player_spawn";
  }

  get title() {
    let title = this.typeTitle;

    if (this.location) {
      title += " " + this.location.toSummary();
    }

    return title;
  }

  get location() {
    return this.getArgumentAsBlockLocation("location");
  }

  set location(location: BlockLocation | undefined) {
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

  addCommandLines(lines: string[], indent: number, options: ICommandOptions) {
    let location = this.location;

    if (!location) {
      location = new BlockLocation(0, 0, 0);
    }

    location = this.absolutizeBlockLocation(location);

    ActionGroup.addLine(lines, indent, "tag @p[l=1] add " + this.getCommandSet());
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

    const simPlayer = scope.test.spawnSimulatedPlayer(this.location);

    scope.setState(this.setId, simPlayer);
  }

  addScriptLines(
    lines: string[],
    options: IScriptGenerationOptions,
    context: IScriptGenerationContext,
    placement: ScriptGenerationPlacement
  ) {
    if (placement === ScriptGenerationPlacement.inSequence) {
      let location = this.location;

      if (!location) {
        location = new BlockLocation(0, 0, 0);
      }

      ActionGroup.addLine(
        lines,
        context.indent,
        "const " +
          this.getScriptSet() +
          " = " +
          this.getScriptTest() +
          ".spawnSimulatedPlayer(new BlockLocation(" +
          location.x +
          ", " +
          location.y +
          ", " +
          location.z +
          '), "' +
          this.getScriptSet() +
          '");'
      );
    }
  }
}
