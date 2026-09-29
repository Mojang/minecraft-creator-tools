import { Argument, Command, Option } from "commander";
import { ICommand } from "./ICommand";
import { CommandRegistry } from "./CommandRegistry";
import { configureGlobalOptions } from "./GlobalOptions";

/**
 * Generates the markdown command reference for the `creator-tools-cli` agent skill from the same
 * Commander definitions the CLI parses, so the reference can't drift from the commands.
 *
 * The output is checked in at plugins/minecraft/skills/creator-tools-cli/references/commands.md and
 * ships in the npm package with the other skills. CliReferenceTest (part of `npm test`, which runs
 * before every release) fails when it's stale; `npm run update-cli-skill-reference` (in app/)
 * rewrites it.
 *
 * Internal (content-production) and debug-only commands are left out, matching the default
 * `mct --help`, and so the output doesn't depend on whether debug mode is on.
 */

const OMITTED_GLOBAL_OPTIONS = new Set(["--internalOnlyRunningInTheContextOfTestCommandLines", "--all-commands"]);

export const CLI_REFERENCE_HEADER =
  "<!-- Generated from the mct command definitions by CliReferenceGenerator. Don't edit by hand: run `npm run update-cli-skill-reference` in app/. -->";

export function generateCliReference(commands: ICommand[]): string {
  const publicCommands = commands.filter((command) => !command.metadata.internal && !command.metadata.debugOnly);

  const registry = new CommandRegistry();
  registry.registerAll(publicCommands);

  const program = configureGlobalOptions(new Command("mct"));
  registry.configureCommander(program);

  const lines: string[] = [
    CLI_REFERENCE_HEADER,
    "",
    "# mct command reference",
    "",
    "Run commands as `npx -y @minecraft/creator-tools@latest <command> [arguments] [options]`, or `mct <command>` when Minecraft Creator Tools is installed globally. `<command> --help` prints the same details.",
    "",
    "## Global options",
    "",
    "These work with every command, though each command only uses the ones that apply to it.",
    "",
  ];

  for (const option of program.options) {
    if (!option.hidden && !OMITTED_GLOBAL_OPTIONS.has(option.long ?? "")) {
      lines.push(formatOption(option));
    }
  }

  lines.push("", "## Commands");

  for (const category of registry.getCategories()) {
    lines.push("", `### ${category}`);

    for (const command of registry.getByCategory(category)) {
      const commanderCommand = program.commands.find((candidate) => candidate.name() === command.metadata.name);
      if (commanderCommand) {
        lines.push("", ...formatCommand(commanderCommand));
      }
    }
  }

  return lines.join("\n") + "\n";
}

function formatCommand(command: Command): string[] {
  const usage = [command.name(), ...command.registeredArguments.map(formatArgumentName)].join(" ");
  const aliases = command.aliases();
  const lines = [`#### \`${usage}\``, ""];

  if (aliases.length > 0) {
    lines.push(`Aliases: ${aliases.map((alias) => `\`${alias}\``).join(", ")}`, "");
  }

  lines.push(oneLine(command.description()));

  if (command.registeredArguments.length > 0) {
    lines.push("", "Arguments:", "");
    for (const argument of command.registeredArguments) {
      lines.push(formatArgument(argument));
    }
  }

  const options = command.options.filter((option) => !option.hidden);
  if (options.length > 0) {
    lines.push("", "Options:", "");
    for (const option of options) {
      lines.push(formatOption(option));
    }
  }

  return lines;
}

function formatArgumentName(argument: Argument): string {
  return argument.required ? `<${argument.name()}>` : `[${argument.name()}]`;
}

function formatArgument(argument: Argument): string {
  const details = [oneLine(argument.description)];
  if (argument.argChoices && argument.argChoices.length > 0) {
    details.push(`One of: ${argument.argChoices.map((choice) => `\`${choice}\``).join(", ")}.`);
  }
  const defaultText = formatDefault(argument.defaultValue, argument.defaultValueDescription);
  if (defaultText) {
    details.push(defaultText);
  }
  return `- \`${formatArgumentName(argument)}\`: ${details.filter(Boolean).join(" ")}`;
}

function formatOption(option: Option): string {
  const details = [oneLine(option.description)];
  if (option.argChoices && option.argChoices.length > 0) {
    details.push(`One of: ${option.argChoices.map((choice) => `\`${choice}\``).join(", ")}.`);
  }
  const defaultText = option.negate ? undefined : formatDefault(option.defaultValue, option.defaultValueDescription);
  if (defaultText) {
    details.push(defaultText);
  }
  return `- \`${option.flags}\`: ${details.filter(Boolean).join(" ")}`;
}

function formatDefault(value: unknown, description?: string): string | undefined {
  if (description) {
    return `Default: ${description}.`;
  }
  if (value === undefined || value === false || (Array.isArray(value) && value.length === 0)) {
    return undefined;
  }
  return `Default: \`${Array.isArray(value) ? value.join(", ") : String(value)}\`.`;
}

function oneLine(text: string | undefined): string {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim();
  return collapsed && !/[.!?:)]$/.test(collapsed) ? `${collapsed}.` : collapsed;
}
