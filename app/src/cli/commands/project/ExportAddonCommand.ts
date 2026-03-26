/**
 * ExportAddonCommand - Package project as an MCAddon
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command packages the project's behavior and resource packs
 * into an MCAddon (or MCPack) file for distribution.
 *
 * OUTPUT:
 * - .mcpack or .mcaddon file in the output folder
 *
 * USAGE:
 * npx mct exportaddon -i <project-folder> -o <output-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectExporter from "../../../app/ProjectExporter";
import StorageUtilities from "../../../storage/StorageUtilities";
import NodeStorage from "../../../local/NodeStorage";

export class ExportAddonCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "exportaddon",
    description: "Packages the specified folder into an addon.",
    taskType: TaskType.exportAddon,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Project",
  };

  configure(cmd: Command): void {
    // No additional arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    if (context.projectCount === 0) {
      context.log.error("No projects to export. Use -i to specify a project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      try {
        await project.inferProjectItemsFromFiles();

        context.log.info(`Packaging project: ${project.name}`);

        if (context.dryRun) {
          context.log.info("Dry run: would export addon for project: " + project.name);
          continue;
        }

        const bytes = await ProjectExporter.generateMCAddonAsZip(context.creatorTools, project, false);

        if (!bytes || !(bytes instanceof Uint8Array) || bytes.length === 0) {
          context.log.error(
            "Failed to generate addon package for project: " +
              project.name +
              ". The project may have script build errors — check messages above."
          );
          context.setExitCode(ErrorCodes.VALIDATION_ERROR);
          continue;
        }

        // Always treat -o as a folder and auto-generate the filename.
        // CommandContextFactory ensures -o exists as a directory, so we can't use it as a filepath.
        const folderPath = context.outputFolder || ".";
        const filePath = project.name + ".mcpack";

        const ns = new NodeStorage(folderPath, "");
        await ns.rootFolder.ensureExists();
        const file = ns.rootFolder.ensureFile(filePath);

        file.setContent(bytes);
        await ns.rootFolder.saveAll();

        if (context.json) {
          context.log.info(JSON.stringify({ success: true, outputPath: StorageUtilities.joinPath(folderPath, filePath) }));
        }

        context.log.success(`Exported: ${filePath}`);
      } catch (err) {
        context.log.error("Failed to export addon: " + (err instanceof Error ? err.message : String(err)));
        context.setExitCode(ErrorCodes.VALIDATION_ERROR);
        continue;
      }
    }

    this.logComplete(context);
  }
}

export const exportAddonCommand = new ExportAddonCommand();
