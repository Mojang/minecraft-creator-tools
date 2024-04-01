// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Command from "../minecraft/Command";
import { ICommandResponseBody } from "../minecraft/ICommandResponse";
import Carto, { CartoMinecraftState } from "./Carto";
import { ICustomToolResultItem } from "./ICustomTool";

export default class CommandRunner {
  static async runCustomTool(carto: Carto, commandNumber: number) {
    if (carto.activeMinecraftState !== CartoMinecraftState.started) {
      // alert("Cannot run command " + commandNumber + "; not connected to Minecraft.");
    }

    const cartoCommand = carto.getCustomTool(commandNumber - 1);
    let commandName = commandNumber + "";

    if (cartoCommand.name !== undefined && cartoCommand.name.length > 0) {
      commandName = cartoCommand.name;
    }

    const operId = await carto.notifyOperationStarted("Running command " + commandName);

    if (cartoCommand.text !== undefined) {
      await CommandRunner.runCommandText(carto, cartoCommand.text);
    } else {
      // alert("This command is not defined, yet.");
    }

    await carto.notifyOperationEnded(operId, "Command " + commandName + " complete.");
  }

  static async runCommandText(carto: Carto, commandText: string) {
    const commandItems = commandText.split("\n");

    await this.runCommandList(carto, commandItems);
  }

  static async runCommandList(carto: Carto, commandItems: string[]) {
    const resultItems = [];

    let lastStoredBlockX = -1;
    let lastStoredBlockY = -1;
    let lastStoredBlockZ = -1;

    let firstRelativeX: number | undefined;
    let firstRelativeY: number | undefined;
    let firstRelativeZ: number | undefined;

    let setFirstPosition = false;

    for (let i = 0; i < commandItems.length; i++) {
      let commandText = commandItems[i].trim();

      if (commandText.length > 4 && !commandText.startsWith("#")) {
        if (!commandText.startsWith("/")) {
          commandText = "/" + commandText;
        }

        const commandStart = new Date();

        const command = new Command(commandText);

        // fix up a command to use absolute positions based on the position of our first command.
        if (
          command.hasRelativeOrLocalCoordinates &&
          setFirstPosition &&
          firstRelativeX !== undefined &&
          firstRelativeY !== undefined &&
          firstRelativeZ !== undefined
        ) {
          command.absolutizeCoordinates(
            lastStoredBlockX - firstRelativeX,
            lastStoredBlockY - firstRelativeY,
            lastStoredBlockZ - firstRelativeZ
          );
        }

        commandText = command.toString();

        carto.notifyStatusUpdate("Running command '" + commandText + "'");

        const commandResult = await carto.runCommand(commandText);
        const result = commandResult?.data;

        let resultData: ICommandResponseBody | undefined;

        if (result !== undefined && result !== null && result.indexOf("{") >= 0) {
          try {
            resultData = JSON.parse(result);
          } catch (e) {}

          if (resultData !== undefined) {
            // store a position so that we can absolutize future commands
            if (resultData.position !== undefined && !setFirstPosition) {
              lastStoredBlockX = resultData.position.x;
              lastStoredBlockY = resultData.position.y;
              lastStoredBlockZ = resultData.position.z;

              const argX = command.firstX;
              if (argX !== undefined) {
                firstRelativeX = argX.position;
              }

              const argY = command.firstY;
              if (argY !== undefined) {
                firstRelativeY = argY.position;
              }

              const argZ = command.firstZ;
              if (argZ !== undefined) {
                firstRelativeZ = argZ.position;
              }

              setFirstPosition = true;
            }
          }
        }

        const resultItem: ICustomToolResultItem = {
          lineNumber: i,
          dateTime: commandStart,
          response: resultData,
        };

        resultItems.push(resultItem);
      }
    }

    return resultItems;
  }
}
