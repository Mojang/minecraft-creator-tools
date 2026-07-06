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

const AVAILABLE_PROPERTIES = ["name", "title", "description", "bpscriptentrypoint", "bpuuid", "rpuuid"];

export class SetCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "set",
    description: "Temporarily disabled in CLI.",
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
    // Intentionally left blank while this command is disabled.
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    context.log.error("The 'set' command is temporarily disabled in CLI while persistence issues are being resolved.");
    context.setExitCode(ErrorCodes.INIT_ERROR);
    this.logComplete(context);
  }
}

export const setCommand = new SetCommand();
