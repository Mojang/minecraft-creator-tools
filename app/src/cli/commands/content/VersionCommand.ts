/**
 * VersionCommand - Displays version and environment information
 *
 * This is a simple command that shows:
 * - MCT version
 * - Local environment paths
 * - Copyright/disclaimer
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalUtilities from "../../../local/LocalUtilities";
import { constants } from "../../../core/Constants";

/**
 * VersionCommand displays version and path information.
 */
export class VersionCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "version",
    description: "Display version information.",
    taskType: TaskType.version,
    aliases: ["ver", "v"],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Information",
  };

  configure(_cmd: Command): void {
    // No additional options
  }

  async execute(context: ICommandContext): Promise<void> {
    if (context.json) {
      const jsonOutput: Record<string, string> = { version: constants.version, name: constants.name };
      if (context.creatorTools?.local) {
        const local = context.creatorTools.local as LocalUtilities;
        jsonOutput.userDataPath = local.userDataPath;
        jsonOutput.localAppDataPath = local.localAppDataPath;
        jsonOutput.minecraftPath = local.minecraftPath;
        jsonOutput.serversPath = local.serversPath;
        jsonOutput.envPrefsPath = local.envPrefsPath;
        jsonOutput.packCachePath = local.packCachePath;
      }
      context.log.data(JSON.stringify(jsonOutput));
      return;
    }

    if (context.quiet) {
      context.log.info(constants.version);
      return;
    }

    context.log.info("");
    context.log.info(`${constants.name}`);
    context.log.info(`Version: ${constants.version}`);

    if (context.creatorTools?.local) {
      const local = context.creatorTools.local as LocalUtilities;
      context.log.info("");
      context.log.info(`Machine user data path: ${local.userDataPath}`);
      context.log.info(`Machine app data path: ${local.localAppDataPath}`);
      context.log.info(`Minecraft path: ${local.minecraftPath}`);
      context.log.info(`Server working path: ${local.serversPath}`);
      context.log.info(`Environment prefs path: ${local.envPrefsPath}`);
      context.log.info(`Pack cache path: ${local.packCachePath}`);
    }

    context.log.info("");
    context.log.info(constants.copyright);
    context.log.info(constants.disclaimer);
    context.log.info("");
  }
}

// Export singleton instance
export const versionCommand = new VersionCommand();
