/**
 * CliProgram - Builds the `mct` Commander program: global options, registered commands, help, and the
 * guard that rejects --dry-run for commands that don't honor it (DryRunGuard.ts).
 *
 * Shared by cli/index.ts and the CLI tests so tests exercise the same wiring users get.
 */

import { Command } from "commander";
import { constants } from "../../core/Constants";
import { CommandRegistry } from "./CommandRegistry";
import { configureCommandLineHelp } from "./CommandLineHelp";
import { IHelpSection } from "./CommandHelpWriter";
import { installDryRunGuard } from "./DryRunGuard";
import { configureGlobalOptions } from "./GlobalOptions";

export const CLI_NAME = "mct";
export const CLI_PRODUCT_NAME = "Minecraft Creator Tools (preview)";
export const CLI_DESCRIPTION = "Create, preview, validate, and ship Minecraft add-ons.";
/** Creator documentation. constants.homeUrl is the web editor, not the docs. */
export const CLI_DOCUMENTATION_URL = "https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview";
export const CLI_REPORT_ISSUE_URL = "https://aka.ms/mctbugs";

export interface ICliProgramOptions {
  registry: CommandRegistry;
  includeDebugOptions: boolean;
  showAllCommands: boolean;
  /** Extra root help sections, such as AGENT SKILLS. Only called when root help is shown. */
  rootHelpSections?: () => IHelpSection[];
  /**
   * Runs on the empty program before options and commands are added, so settings such as
   * exitOverride() and configureOutput() are inherited by every subcommand.
   */
  prepare?: (program: Command) => void;
}

export function createCliProgram(options: ICliProgramOptions): Command {
  const program = new Command();
  options.prepare?.(program);

  program
    .name(CLI_NAME)
    .description(CLI_DESCRIPTION)
    .version(constants.version, "-v, --version", "Show the version number.");

  configureGlobalOptions(program, { includeDebugOptions: options.includeDebugOptions });
  options.registry.configureCommander(program);
  installDryRunGuard(program, options.registry);

  configureCommandLineHelp(program, {
    productName: CLI_PRODUCT_NAME,
    version: constants.version,
    documentationUrl: CLI_DOCUMENTATION_URL,
    reportIssueUrl: CLI_REPORT_ISSUE_URL,
    showAllCommands: options.showAllCommands,
    getMetadata: (command) => options.registry.get(command.name())?.metadata,
    rootHelpSections: options.rootHelpSections,
  });

  return program;
}
