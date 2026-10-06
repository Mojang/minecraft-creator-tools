/**
 * CommandLineHelp - Installs the unified help experience on the `mct` Commander program
 *
 * - Every command renders through CommandHelpWriter, so root and leaf share one layout.
 * - `mct help [command...]` is the primary way to get help: it is listed as a command, used in
 *   hints and errors, renders exactly what `mct <command> --help` renders, resolves aliases and
 *   internal commands, and reports an unknown path like an unknown command.
 * - Bare `mct` and `mct --all-commands` print root help to stdout and exit 0; see
 *   parseCommandLine. Options without a command (`mct --json`) still fail, with help on stderr.
 * - An unknown command prints `unknown command "x" for "mct"` with a suggestion and usage, even
 *   when command-specific flags follow it. Commander reports it through the `command:*` event,
 *   which it emits before checking options, so `mct serv --port 8080` is not misreported as an
 *   unknown `--port`.
 *
 * Call configureCommandLineHelp() after every command is registered: it walks the finished tree
 * rather than relying on Commander's settings inheritance, which only copies settings to
 * commands created after they were set.
 */

import * as tty from "tty";
import { Command, Help } from "commander";
import { INVALID_INPUT_FILE_OPTION_MESSAGE, isValidInputFileOption } from "./InputFileOption";
import {
  CommandHelpMetadata,
  IHelpSection,
  HELP_DESCRIPTION,
  HELP_FLAGS,
  formatUnknownCommandError,
  renderCommandHelp,
  resolveCommandPath,
  resolveHelpWidth,
} from "./CommandHelpWriter";

export interface ICommandLineHelpOptions {
  productName: string;
  version: string;
  documentationUrl: string;
  /** Where to report a problem; listed in root help's LEARN MORE. */
  reportIssueUrl?: string;
  /** Include internal commands in root help, as `mct --all-commands` requests. */
  showAllCommands: boolean;
  getMetadata: (command: Command) => CommandHelpMetadata | undefined;
  /** Extra root help sections; only called when root help is rendered. */
  rootHelpSections?: () => IHelpSection[];
}

export function configureCommandLineHelp(program: Command, options: ICommandLineHelpOptions): void {
  const helpCommand = addHelpCommand(program);
  // `help` renders during parsing, before index.ts applies logging or network options.
  const helpCommandMetadata: CommandHelpMetadata = {
    category: "Information",
    globalOptionGroups: [],
    omitProcessOptions: true,
    examples: [{ command: `${program.name()} help validate` }, { command: `${program.name()} help val` }],
  };

  const getMetadata = (command: Command) =>
    command === helpCommand ? helpCommandMetadata : options.getMetadata(command);

  // The root has no action, so Commander emits this for operands that match no command
  // (including ones after `--`) instead of printing its own terse error.
  program.on("command:*", (operands: string[]) => failUnknownCommand(program, program, operands[0]));

  forEachCommand(program, (command) => {
    // Commander echoes argv into errors (unknown option, invalid choice). Escape control characters
    // so an argument can't inject terminal escape sequences. Set per command: each command copied
    // the output settings when it was created.
    command.configureOutput({ outputError: (text, write) => write(escapeControlCharacters(text)) });
    command.helpOption(HELP_FLAGS, HELP_DESCRIPTION);
    command.configureHelp({
      // Commander passes the stream's color support here but the stock Help discards it.
      prepareContext(this: IOutputAwareHelp, context) {
        this.helpWidth = this.helpWidth ?? context.helpWidth ?? 80;
        this.outputHasColors = !!context.outputHasColors;
        this.outputIsError = !!context.error;
      },
      formatHelp: (target, helper) =>
        renderCommandHelp(program, target, {
          productName: options.productName,
          version: options.version,
          documentationUrl: options.documentationUrl,
          reportIssueUrl: options.reportIssueUrl,
          width: resolveHelpWidth(helper.helpWidth),
          useColor: true,
          colorDepth: getColorDepth(helper as IOutputAwareHelp),
          showAllCommands: options.showAllCommands,
          getMetadata,
          getRootSections: options.rootHelpSections,
        }),
    });
  });
}

/**
 * Parses the command line. Handles the two invocations Commander has no hook for, then defers to
 * Commander, so every other invocation (including option-only ones) behaves as Commander defines:
 * - Bare `mct` prints root help to stdout and exits 0 (Commander would exit 1 on stderr).
 * - `--all-commands` anywhere prints root help with every command and exits 0, and never runs
 *   a command, as it always has.
 */
export function parseCommandLine(program: Command, argv: string[]): void {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--all-commands")) {
    program.help();
  }

  program.parse(argv);
  if (!isValidInputFileOption(program.opts().inputFile)) {
    program.error(INVALID_INPUT_FILE_OPTION_MESSAGE);
  }
}

/** Replaces control characters other than newline and tab with `\uXXXX` escapes. */
export function escapeControlCharacters(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

interface IOutputAwareHelp extends Help {
  outputHasColors?: boolean;
  outputIsError?: boolean;
}

/**
 * Color depth of the stream help is going to: 1 when Commander will strip color (not a TTY,
 * NO_COLOR, etc.), otherwise what Node detects for the terminal (COLORTERM, TERM, TERM_PROGRAM).
 */
function getColorDepth(helper: IOutputAwareHelp): number {
  if (!helper.outputHasColors) {
    return 1;
  }

  const stream = helper.outputIsError ? process.stderr : process.stdout;
  // Streams forced into color with FORCE_COLOR may not be TTYs, so fall back to the env heuristics.
  return typeof (stream as tty.WriteStream).getColorDepth === "function"
    ? (stream as tty.WriteStream).getColorDepth()
    : tty.WriteStream.prototype.getColorDepth.call(stream, process.env);
}

function addHelpCommand(program: Command): Command {
  program.helpCommand(false);

  return program
    .command("help")
    .description("Show help for any command")
    .argument("[command...]", "The command to show help for, such as `validate`.")
    .action((segments: string[]) => {
      const resolution = resolveCommandPath(program, segments ?? []);

      if (!resolution.command) {
        failUnknownCommand(program, resolution.parent, resolution.unresolvedSegment ?? "");
      }

      (resolution.command ?? program).help();
    });
}

function failUnknownCommand(program: Command, parent: Command, unknownCommand: string): never {
  program.error(formatUnknownCommandError(program, parent, unknownCommand), {
    exitCode: 1,
    code: "commander.unknownCommand",
  });
}

function forEachCommand(command: Command, visit: (command: Command) => void): void {
  visit(command);

  for (const sub of command.commands) {
    forEachCommand(sub, visit);
  }
}
