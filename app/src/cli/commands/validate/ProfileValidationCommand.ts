/**
 * ProfileValidationCommand - Profiles validation performance
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command runs validation with CPU profiling enabled to help
 * identify performance bottlenecks. It wraps the standard validation
 * logic with profiling instrumentation.
 *
 * OUTPUT:
 * - CPU trace file in the output folder
 *
 * USAGE:
 * npx mct profileValidation -i <project-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProfilerWrapper from "../../ProfilerWrapper";
import IProjectStartInfo from "../../IProjectStartInfo";

export class ProfileValidationCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "profileValidation",
    description: "Profile validating a single project with default settings",
    taskType: TaskType.profileValidation,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Validation",
    internal: true,
  };

  configure(cmd: Command): void {
    // No additional arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    if (context.projectCount === 0) {
      context.log.error("No projects to profile. Use -i to specify a project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await ProfilerWrapper.generateCpuTrace("validate", async () => {
      for (let i = 0; i < context.projects.length; i++) {
        const project = context.projects[i];
        const projectStart = this.getProjectStartInfo(project);

        context.log.info(`Profiling project ${i + 1}/${context.projectCount}: ${project.name}`);

        try {
          const result = await context.workerPool.execute({
            taskType: TaskType.validate,
            args: {
              project: projectStart,
              arguments: {
                suite: context.validation.suite !== undefined ? String(context.validation.suite) : undefined,
                exclusionList: context.validation.exclusionList,
                outputMci: true,
                outputType: context.outputType,
              },
              outputFolder: context.outputFolder !== context.inputFolder ? context.outputFolder : undefined,
              inputFolder: context.inputFolder,
              displayInfo: context.localEnv.displayInfo,
              displayVerbose: context.verbose,
              force: context.force,
            },
          });

          if (!result.success) {
            context.log.error(`Validation failed during profiling: ${result.error}`);
            context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          context.log.error(`Internal Processing Error during profiling: ${message}`);
          context.setExitCode(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
        }
      }
    });

    if (context.json) {
      context.log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "profilevalidation",
          success: true,
          message: "Profiling complete. Check output folder for CPU trace.",
        })
      );
    } else {
      context.log.success("Profiling complete. Check output folder for CPU trace.");
    }
    this.logComplete(context);
  }

  private getProjectStartInfo(project: import("../../../app/Project").default): IProjectStartInfo {
    return {
      ctorProjectName: project.name,
      localFilePath: project.localFilePath,
      localFolderPath: project.localFolderPath,
      accessoryFiles: project.accessoryFilePaths,
    };
  }
}

export const profileValidationCommand = new ProfileValidationCommand();
