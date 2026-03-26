// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToolCommandCliAdapter - Adapter to expose ToolCommands as CLI commands
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This adapter provides a thin layer between ToolCommands and the CLI's
 * Commander.js-based command system. It allows ToolCommands to be exposed
 * as CLI commands without duplicating the command logic.
 *
 * KEY FEATURES:
 * 1. Generates Commander.js commands from ToolCommand metadata
 * 2. Translates CLI arguments/options to ToolCommand args/flags
 * 3. Creates appropriate IToolCommandContext from ICommandContext
 * 4. Routes output through CLI logging
 *
 * USAGE:
 * ```typescript
 * import { ToolCommandCliAdapter } from "./ToolCommandCliAdapter";
 * import { createCommand } from "../app/toolcommands";
 *
 * // In CLI registration:
 * const cliCommand = ToolCommandCliAdapter.createCliCommand(createCommand);
 * program.addCommand(cliCommand);
 * ```
 *
 * This adapter is meant for NEW commands that want to leverage ToolCommands.
 * Existing CLI commands (like ValidateCommand) that have CLI-specific logic
 * (worker pools, etc.) should NOT be converted to use this adapter.
 */

import { Command, Argument, Option } from "commander";
import { IToolCommand } from "../../app/toolcommands/IToolCommand";
import { IToolCommandContext, IToolCommandOutput } from "../../app/toolcommands/IToolCommandContext";
import { ICommandContext, ILogger } from "./ICommandContext";
import { ToolCommandRegistry, initializeToolCommands } from "../../app/toolcommands";
import { registerNodeOnlyCommands } from "../../app/toolcommands/registerNodeCommands";

/**
 * Adapter that wraps ToolCommands for CLI usage.
 */
export class ToolCommandCliAdapter {
  /**
   * Create a Commander.js Command from a ToolCommand.
   * @param toolCommand The ToolCommand to wrap
   * @returns Commander.js Command instance
   */
  static createCliCommand(toolCommand: IToolCommand): Command {
    const meta = toolCommand.metadata;
    const cmd = new Command(meta.name);

    cmd.description(meta.description);

    // Add aliases
    if (meta.aliases && meta.aliases.length > 0) {
      cmd.aliases(meta.aliases);
    }

    // Add positional arguments
    if (meta.arguments) {
      for (const arg of meta.arguments) {
        const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
        const argument = new Argument(argStr, arg.description);

        if (arg.defaultValue !== undefined) {
          argument.default(arg.defaultValue);
        }

        if (arg.choices && arg.choices.length > 0) {
          argument.choices(arg.choices);
        }

        cmd.addArgument(argument);
      }
    }

    // Add flags as options
    if (meta.flags) {
      for (const flag of meta.flags) {
        let optionStr = `--${flag.name}`;
        if (flag.shortName) {
          optionStr = `-${flag.shortName}, ${optionStr}`;
        }

        if (!flag.isBoolean) {
          optionStr += flag.required ? ` <${flag.name}>` : ` [${flag.name}]`;
        }

        const option = new Option(optionStr, flag.description);

        if (flag.defaultValue !== undefined) {
          option.default(flag.defaultValue);
        }

        if (flag.choices && flag.choices.length > 0) {
          option.choices(flag.choices);
        }

        cmd.addOption(option);
      }
    }

    // The action will be set up by the command registration system
    // This just creates the command structure

    return cmd;
  }

  /**
   * Create an IToolCommandOutput that routes to the CLI logger.
   */
  static createOutputFromLogger(logger: ILogger): IToolCommandOutput {
    return {
      info: (msg) => logger.info(msg),
      success: (msg) => logger.success(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
      debug: (msg) => logger.verbose(msg),
      progress: (current, total, msg) => logger.progress(current, total, msg),
    };
  }

  /**
   * Create an IToolCommandContext from an ICommandContext.
   * @param cliContext The CLI command context
   * @returns ToolCommand context
   */
  static createToolContext(cliContext: ICommandContext): IToolCommandContext {
    return {
      creatorTools: cliContext.creatorTools,
      project: cliContext.projects.length > 0 ? cliContext.projects[0] : undefined,
      minecraft: undefined, // CLI doesn't typically have direct Minecraft connection
      output: this.createOutputFromLogger(cliContext.log),
      scope: "cli",
      verbose: cliContext.verbose,
    };
  }

  /**
   * Execute a ToolCommand from CLI context.
   * @param toolCommand The ToolCommand to execute
   * @param cliContext The CLI command context
   * @param args Parsed positional arguments
   * @param options Parsed options (flags)
   */
  static async execute(
    toolCommand: IToolCommand,
    cliContext: ICommandContext,
    args: string[],
    options: Record<string, unknown>
  ): Promise<void> {
    const toolContext = this.createToolContext(cliContext);

    // Convert options to flags
    const flags: Record<string, string | boolean | string[]> = {};
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === "string" || typeof value === "boolean" || Array.isArray(value)) {
        flags[key] = value;
      } else if (value !== undefined) {
        flags[key] = String(value);
      }
    }

    const result = await toolCommand.execute(toolContext, args, flags);

    if (!result.success && result.error) {
      cliContext.log.error(`${result.error.code}: ${result.error.message}`);
      cliContext.setExitCode(1);
    }
  }
}

/**
 * Execute a ToolCommand by name from CLI context.
 * This is the main entry point for CLI commands that delegate to ToolCommands.
 *
 * @param commandName The ToolCommand name
 * @param cliContext CLI context
 * @param args Positional arguments
 * @param options Option flags
 */
export async function executeToolCommandFromCli(
  commandName: string,
  cliContext: ICommandContext,
  args: string[],
  options: Record<string, unknown>
): Promise<void> {
  // Ensure ToolCommands are initialized
  initializeToolCommands();
  await registerNodeOnlyCommands();

  const command = ToolCommandRegistry.instance.get(commandName);
  if (!command) {
    cliContext.log.error(`Unknown tool command: ${commandName}`);
    cliContext.setExitCode(1);
    return;
  }

  await ToolCommandCliAdapter.execute(command, cliContext, args, options);
}
