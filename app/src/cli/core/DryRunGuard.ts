/**
 * DryRunGuard - Rejects --dry-run for commands that don't honor it, before anything runs
 *
 * `-n, --dry-run` is a global option, so Commander accepts it with every command, but only commands
 * whose entry in the effects table (CommandEffects.ts) has dryRun.support "honored" skip their effects
 * under it. For every other command, the guard stops the CLI in a Commander preAction hook, while the
 * command line is still being parsed. That's before cli/index.ts creates the data folder or the output
 * folder, saves passcodes, loads projects, downloads, or launches anything. The CLI then prints one
 * error line to stderr and exits with 1 (ErrorCodes.INIT_ERROR), like Commander's other usage errors.
 *
 * Commands that honor --dry-run only partly ("partial") are rejected too: a dry run that still writes,
 * saves, or launches something isn't safe to offer.
 *
 * Help lists --dry-run only for commands whose globalOptionGroups include "dryRun". DryRunGuardTest
 * checks that this matches the commands the guard lets through. To support --dry-run in a command,
 * skip every effect in its entry except reading its input when context.dryRun is set, then add the
 * dryRun group and mark the entry "honored".
 *
 * RELATED FILES:
 * - core/CommandEffects.ts: dryRun.support for every command
 * - core/CliProgram.ts: installs the guard on the program
 * - core/CommandContextFactory.ts: under --dry-run, creates no folders and makes storage and projects read-only
 */

import { Command } from "commander";
import { getCommandEffects } from "./CommandEffects";
import { CommandRegistry } from "./CommandRegistry";
import { ErrorCodes } from "./ICommandContext";

/** The CommanderError code for a rejected --dry-run, for callers that use exitOverride(). */
export const DRY_RUN_NOT_SUPPORTED_CODE = "mct.dryRunNotSupported";

/**
 * Why storage and projects are read-only under --dry-run. CommandContextFactory sets it. Write errors include it,
 * and it makes Node storage refuse creating and moving files and folders too (see IStorage.readOnlyReason), so a
 * write that a command forgot to skip fails with an error that names the dry run.
 */
export const DRY_RUN_READ_ONLY_REASON = "--dry-run doesn't change files.";

/** True when the command, by registered name, skips all of its effects under --dry-run. */
export function isDryRunSupported(commandName: string): boolean {
  return getCommandEffects(commandName)?.dryRun.support === "honored";
}

/** The error for a command that doesn't support --dry-run, such as `mct deploy`. */
export function formatDryRunNotSupportedError(commandPath: string): string {
  return `error: \`${commandPath}\` doesn't support --dry-run yet, so nothing was changed.`;
}

/**
 * Rejects --dry-run for registered commands that don't honor it. Commands that aren't registered,
 * such as `help`, have no effects, so they're left alone.
 */
export function installDryRunGuard(program: Command, registry: CommandRegistry): void {
  program.hook("preAction", (_hookedCommand, actionCommand) => {
    if (!program.opts().dryRun) {
      return;
    }

    const command = registry.get(actionCommand.name());

    if (command === undefined || isDryRunSupported(command.metadata.name)) {
      return;
    }

    program.error(formatDryRunNotSupportedError(`${program.name()} ${getTypedName(program, actionCommand)}`), {
      exitCode: ErrorCodes.INIT_ERROR,
      code: DRY_RUN_NOT_SUPPORTED_CODE,
    });
  });
}

/** The command name as typed, so `mct eula` isn't reported as `mct minecrafteulaandprivacystatement`. */
function getTypedName(program: Command, command: Command): string {
  // Commander sets the program's args, starting with the command name or alias, before it dispatches.
  const typed = program.args[0];

  return typed !== undefined && command.aliases().includes(typed) ? typed : command.name();
}
