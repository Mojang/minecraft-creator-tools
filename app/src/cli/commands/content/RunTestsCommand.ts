/**
 * RunTestsCommand - Placeholder command for running tests
 *
 * This command is currently a no-op placeholder. It exists to maintain
 * compatibility with the command registry but doesn't perform any actions.
 */

import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";

/**
 * RunTestsCommand - Placeholder for test running functionality
 */
export class RunTestsCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "runtests",
    description: "Run tests (placeholder)",
    taskType: TaskType.runTests,
    aliases: [],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Content",
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    context.log.info("RunTests command is currently a placeholder and does not perform any actions.");
  }
}

export const runTestsCommand = new RunTestsCommand();
