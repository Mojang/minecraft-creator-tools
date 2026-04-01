import Action from "./Action";
import IScriptRequirements from "./IScriptRequirements";
import ICommandOptions from "./ICommandOptions";
import ICommandRequirements from "./ICommandRequirements";
import { IScriptGenerationOptions } from "../script/ActionSetScriptGenerator";
import { world } from "@minecraft/server";
import { SimulatedPlayer } from "@minecraft/server-gametest";

export default abstract class TestSimulatedPlayerAction extends Action {
  get name() {
    return this.getArgumentAsString("name");
  }

  validate() {
    this.validateArgumentIsType("name", "string");

    return true;
  }

  getSimulatedPlayer() {
    let thisName = this.name;
    const simPlayers: SimulatedPlayer[] = [];

    world.getAllPlayers().forEach((player) => {
      if (player instanceof SimulatedPlayer && player.name.toLowerCase() === thisName.toLowerCase()) {
        simPlayers.push(player);
      }
    });

    return simPlayers;
  }

  getScriptRequirements(options: IScriptGenerationOptions): IScriptRequirements {
    return {
      needsTest: true,
    };
  }

  getCommandRequirements(options: ICommandOptions): ICommandRequirements {
    return {};
  }
}
