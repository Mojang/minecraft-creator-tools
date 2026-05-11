/**
 * ExportWorldCommand - Export project as an MCWorld
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command exports a flat GameTest world that includes
 * the project's behavior packs as an MCWorld file.
 *
 * OUTPUT:
 * - .mcworld file for import into Minecraft
 *
 * USAGE:
 * npx mct exportworld -i <project-folder> -o <output-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalTools from "../../../local/LocalTools";
import * as path from "path";

export class ExportWorldCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "exportworld",
    description: "Exports a flat GameTest world for the behavior packs in the project folder.",
    taskType: TaskType.exportWorld,
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

        const outputPath = context.outputFile
          ? path.isAbsolute(context.outputFile)
            ? context.outputFile
            : path.resolve(process.cwd(), context.outputFile)
          : this.getFilePath(context, project.name + ".mcworld");

        if (!context.json) {
          context.log.info(`Exporting flat pack world to '${outputPath}'`);
        }

        const success = await LocalTools.exportWorld(context.creatorTools, project, outputPath);

        if (!success) {
          context.log.error(
            "Failed to generate world for project: " +
              project.name +
              ". The project may have script build errors — check messages above."
          );
          context.setExitCode(ErrorCodes.VALIDATION_ERROR);
          continue;
        }

        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "exportworld",
              project: project.name,
              success: true,
              outputPath: outputPath,
            })
          );
        } else {
          context.log.success(`Exported: ${outputPath}`);
        }
      } catch (err) {
        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "exportworld",
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        } else {
          context.log.error("Failed to export world: " + (err instanceof Error ? err.message : String(err)));
        }
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
    }

    this.logComplete(context);
  }

  private getFilePath(context: ICommandContext, fileName: string): string {
    if (context.outputFolder) {
      return path.join(context.outputFolder, fileName);
    }
    return path.join(process.cwd(), fileName);
  }
}

export const exportWorldCommand = new ExportWorldCommand();
