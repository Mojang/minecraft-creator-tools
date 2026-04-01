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
import * as path from "path";

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

        // Determine output path: use --of if specified, otherwise auto-generate in output folder
        let folderPath: string;
        let filePath: string;

        if (context.outputFile) {
          const resolvedOutputFile = path.isAbsolute(context.outputFile)
            ? context.outputFile
            : path.resolve(process.cwd(), context.outputFile);
          folderPath = path.dirname(resolvedOutputFile);
          filePath = path.basename(resolvedOutputFile);
        } else {
          folderPath = context.outputFolder || ".";
          filePath = project.name + ".mcpack";
        }

        const ns = new NodeStorage(folderPath, "");
        await ns.rootFolder.ensureExists();
        const file = ns.rootFolder.ensureFile(filePath);

        file.setContent(bytes);
        await ns.rootFolder.saveAll();

        if (context.json) {
          context.log.info(
            JSON.stringify({ success: true, outputPath: StorageUtilities.joinPath(folderPath, filePath) })
          );
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
