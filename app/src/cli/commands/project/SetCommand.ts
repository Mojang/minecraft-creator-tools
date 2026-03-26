/**
 * SetCommand - Set project properties
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command sets various project properties such as name,
 * description, UUIDs, and script entry points.
 *
 * AVAILABLE PROPERTIES:
 * - name: Project name/title
 * - title: Same as name
 * - description: Project description
 * - bpscriptentrypoint: Behavior pack script entry point
 * - bpuuid: Behavior pack UUID
 * - rpuuid: Resource pack UUID
 *
 * USAGE:
 * npx mct set <property> <value> -i <project-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectUtilities from "../../../app/ProjectUtilities";

const AVAILABLE_PROPERTIES = ["name", "title", "description", "bpscriptentrypoint", "bpuuid", "rpuuid"];

export class SetCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "set",
    description: "Sets a project property.",
    taskType: TaskType.setProjectProperty,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: false,
    category: "Project",
    arguments: [
      {
        name: "propertyName",
        description: `Property name to set. Valid: ${AVAILABLE_PROPERTIES.join(", ")}`,
        required: false,
        contextField: "subCommand",
      },
      {
        name: "propertyValue",
        description: "Property value to set.",
        required: false,
        contextField: "propertyValue",
      },
    ],
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const propertyName = context.subCommand;
    const propertyValue = context.propertyValue;

    if (!propertyName) {
      context.log.error(`No property specified. Available properties: ${AVAILABLE_PROPERTIES.join(", ")}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const trimmedValue = propertyValue?.trim();
    if (!trimmedValue || trimmedValue.length < 1) {
      context.log.error("Please specify a valid property value (must be non-empty).");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const propCanon = propertyName.trim().toLowerCase();

    if (!AVAILABLE_PROPERTIES.includes(propCanon)) {
      context.log.error(`Unknown property: '${propertyName}'. Available: ${AVAILABLE_PROPERTIES.join(", ")}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      await project.inferProjectItemsFromFiles();

      if (context.dryRun) {
        context.log.info("Dry run: would set '" + propCanon + "' = '" + trimmedValue + "' in project: " + project.name);
        continue;
      }

      if (!context.quiet) {
        context.log.info(`Setting '${propCanon}' = '${trimmedValue}' in project: ${project.name}`);
      }

      switch (propCanon) {
        case "name":
        case "title":
          await ProjectUtilities.applyTitle(project, trimmedValue);
          break;

        case "description":
          await ProjectUtilities.applyDescription(project, trimmedValue);
          break;

        case "bpscriptentrypoint":
          await ProjectUtilities.applyScriptEntryPoint(project, trimmedValue);
          break;

        case "bpuuid":
          await ProjectUtilities.applyBehaviorPackUniqueId(project, trimmedValue);
          break;

        case "rpuuid":
          await ProjectUtilities.applyResourcePackUniqueId(project, trimmedValue);
          break;
      }

      if (!context.quiet) {
        context.log.success(`Updated ${propCanon} for project: ${project.name}`);
      }
    }

    this.logComplete(context);
  }
}

export const setCommand = new SetCommand();
