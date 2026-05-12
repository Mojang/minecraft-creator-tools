// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectSetup from "../../../app/ProjectSetup";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

export class SetupCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "setup",
    description: "Ensures project configuration files are up to date and healthy",
    taskType: TaskType.setup,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: false,
    category: "Project",
    arguments: [],
  };

  configure(cmd: Command): void {
    // No additional options needed
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    if (context.projects.length === 0) {
      context.log.error("No project folder specified. Use -i to specify the project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      if (context.dryRun) {
        context.log.info("Dry run: would set up project at: " + (project.localFolderPath || project.name));
        continue;
      }

      if (!context.quiet) {
        context.log.info("Setting up project: " + (project.localFolderPath || project.name));
      }

      const results = await ProjectSetup.setup(project, context.log);

      let packageJsonUpdated = false;
      let packageJsonContent: string | undefined;

      for (const result of results) {
        if (result.status === "unchanged") {
          context.log.info(`${GREEN}  ✅ ${result.filePath}${RESET}`);
        } else if (result.status === "updated") {
          context.log.info(`${YELLOW}  📝 ${result.filePath} — updated${RESET}`);
        } else if (result.status === "created") {
          context.log.info(`${YELLOW}  📝 ${result.filePath} — created${RESET}`);
        }

        if (result.filePath === "package.json" && result.status !== "unchanged") {
          packageJsonUpdated = true;
          packageJsonContent = result.packageJsonContent;
        }
      }

      if (packageJsonUpdated && packageJsonContent) {
        context.log.info("");
        context.log.info("Updated package.json:");
        context.log.info(packageJsonContent);
        context.log.info("");
        context.log.info(
          "Please review the updated package.json file. When you are ready, run 'npm install' to update any packages needed for this project."
        );
      }

      if (context.json) {
        context.log.data(
          JSON.stringify({
            schemaVersion: "1.0.0",
            command: "setup",
            results,
            projectPath: project.localFolderPath || project.name,
          })
        );
      }

      if (!context.quiet && !packageJsonUpdated) {
        context.log.success("Project setup complete.");
      }
    }

    this.logComplete(context);
  }
}

export const setupCommand = new SetupCommand();
