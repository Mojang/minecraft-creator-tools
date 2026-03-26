/**
 * InfoCommand - Displays information about projects
 *
 * Shows:
 * - Project name and description
 * - Default behavior/resource pack folders
 * - List of project items
 * - Validation summary
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { InfoItemType } from "../../../info/IInfoItemData";

/**
 * InfoCommand displays project information.
 */
export class InfoCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "info",
    description: "Displays information about the current project.",
    taskType: TaskType.info,
    aliases: ["i"],
    requiresProjects: true,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Information",
  };

  configure(_cmd: Command): void {
    // No additional options
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    await context.forEachProject(async (project) => {
      await project.inferProjectItemsFromFiles();

      // Display behavior pack info
      const bpFolder = await project.getDefaultBehaviorPackFolder();

      // Display resource pack info
      const rpFolder = await project.getDefaultResourcePackFolder();

      // List project items
      const items = project.getItemsCopy();

      // Show validation summary
      const pis = project.indevInfoSet;
      await pis.generateForProject();

      const errorCount = pis.items.filter(
        (item) => item.itemType !== InfoItemType.testCompleteFail && item.itemType !== InfoItemType.testCompleteSuccess
      ).length;

      if (errorCount > 0) {
        context.setExitCode(ErrorCodes.VALIDATION_WARNING);
      }

      if (context.json) {
        const jsonOutput = {
          name: project.name,
          description: project.description || "",
          behaviorPackFolder: bpFolder ? bpFolder.storageRelativePath : null,
          resourcePackFolder: rpFolder ? rpFolder.storageRelativePath : null,
          itemCount: items.length,
          items: items.map((item) => ({ type: item.typeTitle, path: item.projectPath })),
          errorCount: errorCount,
        };
        context.log.info(JSON.stringify(jsonOutput));
        return;
      }

      if (context.quiet) {
        context.log.info(`${project.name} ${errorCount} issue(s)`);
        return;
      }

      context.log.info(`Project name: ${project.name}`);
      context.log.info(`Project description: ${project.description || "(no description)"}`);

      if (bpFolder === null) {
        context.log.info("No default behavior pack.");
      } else {
        context.log.info(`Default behavior pack folder: ${bpFolder.storageRelativePath}`);
      }

      if (rpFolder === null) {
        context.log.info("No default resource pack.");
      } else {
        context.log.info(`Default resource pack folder: ${rpFolder.storageRelativePath}`);
      }

      for (const item of items) {
        context.log.info(`=== ${item.typeTitle}: ${item.projectPath}`);
      }

      for (const item of pis.items) {
        if (item.itemType !== InfoItemType.testCompleteFail && item.itemType !== InfoItemType.testCompleteSuccess) {
          context.log.info(pis.itemToString(item));
        }
      }
    }, "Analyzing");

    this.logComplete(context);
  }
}

// Export singleton instance
export const infoCommand = new InfoCommand();
