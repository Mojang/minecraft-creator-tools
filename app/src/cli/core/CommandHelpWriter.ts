/**
 * CommandHelpWriter - Renders help for every command in the `mct` CLI
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * One renderer, three shapes, chosen from the target command rather than from how help was
 * requested. `mct --help`, `mct help`, and bare `mct` all render the root; `mct validate --help`,
 * `mct help validate`, and `mct help val` all render the same leaf. Before this renderer existed,
 * Commander's stock layout dumped all ~50 global options at the root, showed none of them on
 * subcommands, and appended examples through ad-hoc `addHelpText` blocks.
 *
 * SHAPES (modeled on GitHub CLI's `gh` help; sections are omitted when empty):
 * - Root:  banner, GET STARTED, USAGE, <CATEGORY> COMMANDS..., extra sections (e.g. AGENT SKILLS),
 *          FLAGS, EXAMPLES, LEARN MORE
 * - Group: description, USAGE, ALIASES, AVAILABLE COMMANDS, FLAGS, INHERITED FLAGS, EXAMPLES,
 *          LEARN MORE
 * - Leaf:  description, USAGE, ALIASES, ARGUMENTS, FLAGS, INHERITED FLAGS, EXAMPLES, LEARN MORE
 * The description is unlabeled prose at the top, as in `gh`. ARGUMENTS comes before FLAGS (gh puts
 * it after) because positional arguments such as `validate [suite]` are primary input in `mct`.
 * Required arguments are `<name>` and optional ones `[name]`; required options are marked
 * "(required)" in FLAGS.
 *
 * WHERE CONTENT COMES FROM:
 * - Names, descriptions, arguments, options: the Commander command tree (source of truth for
 *   what actually parses).
 * - Category, examples, learnMore, globalOptionGroups: ICommandMetadata, via the getMetadata
 *   callback, so organization is declared on each command instead of in lists here.
 * - Which global options a command shows: the option's group (GlobalOptions.ts) intersected with
 *   the command's globalOptionGroups, plus the `process` group every command honors. Root help
 *   shows only ROOT_FLAGS (help, version, all-commands), as `gh` does, and points to
 *   `mct help <command>`.
 *
 * LAYOUT:
 * - Width is the terminal width clamped to [MIN_WIDTH, MAX_WIDTH]; 80 when not a TTY.
 * - Each row section sizes its own label column, as `gh` does, so one long flag does not push
 *   every other section right. Root command sections share one column so category lists line
 *   up. The column is capped at MAX_LABEL_WIDTH (or 40% of a narrow terminal); a longer label
 *   (e.g. the EULA command) goes on its own line with its description below.
 * - Below MIN_DESCRIPTION_WIDTH a section switches to a stacked layout.
 * - USAGE and EXAMPLES are written verbatim (never wrapped) so they stay copy-pasteable.
 *   Descriptions and LEARN MORE are prose and wrap on spaces.
 * - Section titles are bold ANSI. Commander strips ANSI when the stream has no color support
 *   (not a TTY, NO_COLOR, etc.), so the renderer never checks the terminal itself.
 *
 * COMMON PITFALLS:
 * - Commander's `addHelpText()` still appends after this renderer. Put examples and tips in
 *   ICommandMetadata instead, or they print twice in different styles.
 * - Positional options are not enabled, so the root program consumes its own options wherever
 *   they appear. A subcommand option whose every flag is also a root flag (e.g. `deploy --launch`,
 *   `serve --adminpc`) therefore never receives a value; the root option does. Help follows the
 *   parser: such local options are omitted and the root option is listed under INHERITED FLAGS.
 *
 * RELATED FILES:
 * - cli/core/CommandLineHelp.ts: wires this renderer, the `help` command, and unknown-command
 *   errors into Commander
 * - cli/core/GlobalOptions.ts: global options and their help groups
 * - cli/core/ICommand.ts: ICommandMetadata help fields
 * - docs/CliHelp.md: contributor guide for writing help content
 */

import { Argument, Command, Option } from "commander";
import { ICommandExample, ICommandMetadata } from "./ICommand";
import { GlobalOptionGroup, getGlobalOptionGroup } from "./GlobalOptions";
import { getLogoWidth, renderLogo } from "./CliLogo";

/** The subset of command metadata that affects help. */
export type CommandHelpMetadata = Partial<
  Pick<ICommandMetadata, "category" | "examples" | "learnMore" | "globalOptionGroups" | "internal">
> & {
  /**
   * Leave out the `process` options (logging, network). Only for commands handled before
   * cli/index.ts applies them, such as the built-in `help` command.
   */
  omitProcessOptions?: boolean;
};

/** An extra titled section of prose, such as AGENT SKILLS in root help. */
export interface IHelpSection {
  title: string;
  /** Each entry is wrapped as its own paragraph. */
  paragraphs: string[];
}

export interface IHelpRenderContext {
  /** Product name shown in the root banner. */
  productName: string;
  version: string;
  documentationUrl: string;
  /** Where to report a problem; listed in root help's LEARN MORE. */
  reportIssueUrl?: string;
  /** Output width in columns; see resolveHelpWidth. */
  width: number;
  /** Emit ANSI styling. Commander strips it again when the stream has no color support. */
  useColor: boolean;
  /**
   * Color depth of the stream help is written to, in bits (24, 8, 4, or 1 for none). Decides
   * whether the root logo is drawn and with which palette; see CliLogo.ts.
   */
  colorDepth: number;
  /** Include internal (hidden) commands in root help, as `--all-commands` does. */
  showAllCommands: boolean;
  getMetadata: (command: Command) => CommandHelpMetadata | undefined;
  /** Extra root help sections, shown after the command lists as gh shows HELP TOPICS. */
  getRootSections?: () => IHelpSection[];
}

export const HELP_FLAGS = "-h, --help";
export const HELP_DESCRIPTION = "Show help for the command.";

const DEFAULT_WIDTH = 80;
const MIN_WIDTH = 40;
const MAX_WIDTH = 120;
const MIN_DESCRIPTION_WIDTH = 24;
const MAX_LABEL_WIDTH = 32;
const INDENT = "  ";
const COLUMN_GAP = 2;
const ANSI_BOLD = "\x1b[1m";
const ANSI_RESET = "\x1b[0m";

/** Root category order. Categories not listed here follow, alphabetically. */
const CATEGORY_ORDER = [
  "Project",
  "Validation",
  "Content",
  "World",
  "Render",
  "Server",
  "Information",
  "Documentation",
];
const FALLBACK_CATEGORY = "Additional";

/** Global options shown in root help, by long flag. Everything else is on command help. */
const ROOT_FLAGS = ["--help", "--version", "--all-commands"];

/**
 * INHERITED FLAGS sections, in order, each a blank-line-separated block: command-specific groups
 * first, then output format, then the `process` options every command honors.
 */
const INHERITED_SECTIONS: GlobalOptionGroup[][] = [
  ["input", "projects"],
  ["outputFolder", "outputFile", "outputType"],
  ["dryRun", "force", "prompts"],
  ["threads", "warnOnly"],
  ["launch", "betaApis", "editor"],
  ["server", "passcodes"],
  ["ssl"],
  ["json"],
  ["process"],
];

interface IHelpRow {
  label: string;
  description: string;
}

/**
 * Clamps a terminal width to something help can lay out. Undefined (not a TTY) yields 80 so
 * piped and captured output is stable.
 */
export function resolveHelpWidth(columns: number | undefined): number {
  if (!columns || columns <= 0) {
    return DEFAULT_WIDTH;
  }

  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, columns));
}

/**
 * Renders help for `command`, which may be the root or any command beneath it.
 */
export function renderCommandHelp(root: Command, command: Command, context: IHelpRenderContext): string {
  let lines: string[];

  if (command === root) {
    lines = renderRootHelp(root, context);
  } else if (getSubcommands(command, false).length > 0) {
    lines = renderGroupHelp(root, command, context);
  } else {
    lines = renderLeafHelp(root, command, context);
  }

  return lines.join("\n") + "\n";
}

/**
 * Builds the usage line for any command shape. Leaves list their arguments and mandatory
 * options so the line is a complete template.
 */
export function buildUsage(root: Command, command: Command): string {
  const path = formatCommandPath(root, command);

  if (command === root) {
    return `${path} <command> [arguments] [flags]`;
  }

  if (getSubcommands(command, false).length > 0) {
    return `${path} <command> [flags]`;
  }

  const parts = [path];

  for (const argument of command.registeredArguments) {
    parts.push(formatArgumentLabel(argument));
  }

  for (const option of command.options) {
    if (!option.hidden && option.mandatory) {
      const placeholder = getOptionPlaceholder(option);
      parts.push(placeholder ? `${option.long ?? option.short} ${placeholder}` : `${option.long ?? option.short}`);
    }
  }

  parts.push("[flags]");
  return parts.join(" ");
}

/** Returns the command's path from the root, e.g. `mct validate`. */
export function formatCommandPath(root: Command, command: Command): string {
  const segments: string[] = [];
  let current: Command | null = command;

  while (current && current !== root) {
    segments.unshift(current.name());
    current = current.parent;
  }

  return [root.name(), ...segments].join(" ");
}

export interface ICommandPathResolution {
  /** The command the whole path named, when every segment matched. */
  command?: Command;
  /** The deepest command that matched, for an accurate "unknown command X for Y" error. */
  parent: Command;
  /** The first segment that did not match. */
  unresolvedSegment?: string;
}

/**
 * Resolves a user-supplied path such as `["validate"]` or `["val"]`. Hidden commands resolve so
 * `mct help <internal-command>` still works.
 */
export function resolveCommandPath(root: Command, segments: string[]): ICommandPathResolution {
  let current = root;

  for (const segment of segments) {
    const match = current.commands.find((sub) => sub.name() === segment || sub.aliases().includes(segment));

    if (!match) {
      return { parent: current, unresolvedSegment: segment };
    }

    current = match;
  }

  return { command: current, parent: current.parent ?? root };
}

/**
 * Formats the error for an unknown command under `parent`, with a usage line from that
 * command's real depth and a suggestion when one is close.
 */
export function formatUnknownCommandError(root: Command, parent: Command, unknownCommand: string): string {
  const path = formatCommandPath(root, parent);
  // JSON.stringify quotes the token and escapes control characters, so a hostile argument cannot
  // inject terminal escape sequences into the error.
  const lines = [`error: unknown command ${JSON.stringify(unknownCommand)} for ${JSON.stringify(path)}`];

  const suggestion = suggestCommand(parent, unknownCommand);
  if (suggestion) {
    lines.push("", "Did you mean this?", `${INDENT}${suggestion}`);
  }

  const helpCommand = [root.name(), "help", ...path.split(" ").slice(1)].join(" ");
  const hint = getSubcommands(parent, false).length > 0 ? "to see available commands." : "for more information.";
  lines.push("", `Usage:  ${buildUsage(root, parent)}`, "", `Run \`${helpCommand}\` ${hint}`);

  return lines.join("\n");
}

/**
 * Suggests the visible subcommand of `parent` closest to `word`, matching aliases too but
 * always returning the primary name.
 */
export function suggestCommand(parent: Command, word: string): string | undefined {
  const primaryNames = new Map<string, string>();

  for (const sub of getSubcommands(parent, false)) {
    for (const name of [sub.name(), ...sub.aliases()]) {
      primaryNames.set(name.toLowerCase(), sub.name());
    }
  }

  const match = closestMatch(word.toLowerCase(), Array.from(primaryNames.keys()));
  return match ? primaryNames.get(match) : undefined;
}

/**
 * The candidate closest to `word` within two edits and more than 40% similar, using the same
 * thresholds as Commander's own suggestions. Single-character candidates are never suggested.
 */
function closestMatch(word: string, candidates: string[]): string | undefined {
  let bestDistance = 3;
  let best: string | undefined;

  for (const candidate of candidates) {
    if (candidate.length <= 1) {
      continue;
    }

    const distance = editDistance(word, candidate);
    const length = Math.max(word.length, candidate.length);

    if ((length - distance) / length > 0.4 && distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

function renderRootHelp(root: Command, context: IHelpRenderContext): string[] {
  const cli = root.name();
  const visible = getSubcommands(root, false);
  const listed = context.showAllCommands ? getSubcommands(root, true) : visible;
  const hiddenCount = root.commands.length - visible.length;

  const commandSections = groupByCategory(listed, context).map(([category, commands]) => ({
    title: `${category.toUpperCase()} COMMANDS`,
    rows: commands.map((sub) => commandRow(sub)),
  }));

  const optionsByLong = new Map<string, IHelpRow>();
  for (const option of root.options) {
    if (option.long && !option.hidden) {
      optionsByLong.set(option.long, optionRow(option));
    }
  }
  optionsByLong.set("--help", { label: HELP_FLAGS, description: HELP_DESCRIPTION });

  const flagRows = ROOT_FLAGS.map((long) => optionsByLong.get(long)).filter((row): row is IHelpRow => !!row);
  const commandLabelWidth = computeLabelWidth(
    commandSections.flatMap((section) => section.rows),
    context.width
  );

  const lines = [...renderBanner(root, context), ""];

  lines.push(...textSection("GET STARTED", [`$ ${cli} create`], context));
  lines.push(...textSection("USAGE", [buildUsage(root, root), `${cli} help [command]`], context));

  for (const section of commandSections) {
    lines.push(...rowsSection(section.title, section.rows, context, commandLabelWidth));
  }

  for (const extra of context.getRootSections?.() ?? []) {
    lines.push(...proseSection(extra.title, extra.paragraphs, context));
  }

  lines.push(...rowsSection("FLAGS", flagRows, context));

  lines.push(
    ...textSection(
      "EXAMPLES",
      [`$ ${cli} validate -i ./my-project`, `$ ${cli} view -i ./my-project`, `$ ${cli} help create`],
      context
    )
  );

  const learnMore = [`Use \`${cli} help <command>\` for more information about a command, including all of its flags.`];

  if (hiddenCount > 0 && !context.showAllCommands) {
    learnMore.push(
      `Use \`${cli} --all-commands\` to also list ${hiddenCount} content-production command${hiddenCount === 1 ? "" : "s"}.`
    );
  }

  learnMore.push(`Read the documentation at ${context.documentationUrl}`);
  if (context.reportIssueUrl) {
    learnMore.push(`Report a problem at ${context.reportIssueUrl}`);
  }
  lines.push(...proseSection("LEARN MORE", learnMore, context));

  return trimTrailingBlankLines(lines);
}

function renderGroupHelp(root: Command, command: Command, context: IHelpRenderContext): string[] {
  const metadata = context.getMetadata(command);

  const lines: string[] = [];
  lines.push(...descriptionBlock(command.description(), context));
  lines.push(...textSection("USAGE", [buildUsage(root, command)], context));
  lines.push(...textSection("ALIASES", formatAliases(root, command), context));
  lines.push(
    ...rowsSection(
      "AVAILABLE COMMANDS",
      getSubcommands(command, false).map((sub) => commandRow(sub)),
      context
    )
  );
  lines.push(...rowsSection("FLAGS", getLocalOptionRows(root, command), context));
  lines.push(...groupedRowsSection("INHERITED FLAGS", getInheritedOptionGroups(root, metadata), context));
  lines.push(...section("EXAMPLES", renderExamples(metadata?.examples), context));
  lines.push(
    ...proseSection(
      "LEARN MORE",
      [
        ...(metadata?.learnMore ?? []),
        `Use \`${helpPath(root, command)} <command>\` for more information about a command.`,
        `Read the documentation at ${context.documentationUrl}`,
      ],
      context
    )
  );

  return trimTrailingBlankLines(lines);
}

function renderLeafHelp(root: Command, command: Command, context: IHelpRenderContext): string[] {
  const metadata = context.getMetadata(command);

  const lines: string[] = [];
  lines.push(...descriptionBlock(command.description(), context));
  lines.push(...textSection("USAGE", [buildUsage(root, command)], context));
  lines.push(...textSection("ALIASES", formatAliases(root, command), context));
  lines.push(
    ...rowsSection(
      "ARGUMENTS",
      command.registeredArguments.map((argument) => argumentRow(argument)),
      context
    )
  );
  lines.push(...rowsSection("FLAGS", getLocalOptionRows(root, command), context));
  lines.push(...groupedRowsSection("INHERITED FLAGS", getInheritedOptionGroups(root, metadata), context));
  lines.push(...section("EXAMPLES", renderExamples(metadata?.examples), context));
  lines.push(
    ...proseSection(
      "LEARN MORE",
      [
        ...(metadata?.learnMore ?? []),
        `Use \`${root.name()} help\` to see all commands.`,
        `Read the documentation at ${context.documentationUrl}`,
      ],
      context
    )
  );

  return trimTrailingBlankLines(lines);
}

/** The `help` form of a command path: `mct validate` becomes `mct help validate`. */
function helpPath(root: Command, command: Command): string {
  return [root.name(), "help", ...formatCommandPath(root, command).split(" ").slice(1)].join(" ");
}

function formatAliases(root: Command, command: Command): string[] {
  const parentPath = formatCommandPath(root, command.parent ?? root);
  return command.aliases().map((alias) => `${parentPath} ${alias}`);
}

/** The command description as unlabeled prose at the top of help, as `gh` renders it. */
function descriptionBlock(description: string, context: IHelpRenderContext): string[] {
  return description.trim().length > 0 ? [...wrap(description, context.width), ""] : [];
}

/**
 * The root help banner: the creeper logo (10x5 cells) with the product name and description beside
 * it, or below it when the terminal is too narrow. A blank line separates the logo's solid block
 * from the shell prompt above it. Without color, a plain title (see CliLogo.ts).
 */
function renderBanner(root: Command, context: IHelpRenderContext): string[] {
  const title = `${context.productName} v${context.version}`;
  const logo = renderLogo(context.colorDepth);

  if (logo.length === 0) {
    return [...wrap(title, context.width), ...wrap(root.description(), context.width)];
  }

  const bold = (line: string) => (context.useColor ? `${ANSI_BOLD}${line}${ANSI_RESET}` : line);
  const logoWidth = getLogoWidth();
  const textWidth = context.width - logoWidth - COLUMN_GAP;

  if (textWidth < MIN_DESCRIPTION_WIDTH) {
    return ["", ...logo, "", ...wrap(title, context.width).map(bold), ...wrap(root.description(), context.width)];
  }

  const text = [...wrap(title, textWidth).map(bold), ...wrap(root.description(), textWidth)];
  const rows = Math.max(logo.length, text.length);
  const logoTop = Math.floor((rows - logo.length) / 2);
  const textTop = Math.floor((rows - text.length) / 2);
  const lines = [""];

  for (let row = 0; row < rows; row++) {
    const logoLine = logo[row - logoTop] ?? " ".repeat(logoWidth);
    const beside = text[row - textTop];
    lines.push(beside ? logoLine + " ".repeat(COLUMN_GAP) + beside : logoLine.trimEnd());
  }

  return lines;
}

function renderExamples(examples: ICommandExample[] | undefined): string[] {
  if (!examples || examples.length === 0) {
    return [];
  }

  const separate = examples.some((example) => example.description);
  const lines: string[] = [];

  examples.forEach((example, index) => {
    if (separate && index > 0) {
      lines.push("");
    }

    if (example.description) {
      lines.push(`${INDENT}# ${example.description}`);
    }

    lines.push(`${INDENT}$ ${example.command}`);
  });

  return lines;
}

/** Visible subcommands, or every subcommand including hidden ones. */
function getSubcommands(command: Command, includeHidden: boolean): Command[] {
  return includeHidden ? [...command.commands] : command.createHelp().visibleCommands(command);
}

function groupByCategory(commands: Command[], context: IHelpRenderContext): [string, Command[]][] {
  const byCategory = new Map<string, Command[]>();

  for (const sub of commands) {
    const category = context.getMetadata(sub)?.category || FALLBACK_CATEGORY;
    const list = byCategory.get(category) ?? [];
    list.push(sub);
    byCategory.set(category, list);
  }

  // Known categories in CATEGORY_ORDER, then unknown ones alphabetically, then the fallback.
  const rank = (category: string) => {
    if (category === FALLBACK_CATEGORY) {
      return CATEGORY_ORDER.length + 1;
    }
    const index = CATEGORY_ORDER.indexOf(category);
    return index >= 0 ? index : CATEGORY_ORDER.length;
  };

  return Array.from(byCategory.entries()).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function getLocalOptionRows(root: Command, command: Command): IHelpRow[] {
  return command.options
    .filter((option) => !option.hidden && !isShadowedByRoot(root, command, option))
    .map((option) => optionRow(option));
}

/**
 * Whether every flag of a subcommand option is also a root flag, so the root consumes it and the
 * subcommand option can never receive a value. See COMMON PITFALLS at the top of this file.
 */
function isShadowedByRoot(root: Command, command: Command, option: Option): boolean {
  if (command === root) {
    return false;
  }

  const rootTokens = new Set(root.options.flatMap((rootOption) => getFlagTokens(rootOption)));
  return getFlagTokens(option).every((token) => rootTokens.has(token));
}

/**
 * Global options relevant to a command: the groups its metadata declares plus `process` (unless
 * omitted), one blank-line-separated block per INHERITED_SECTIONS entry, with `-h, --help` last.
 */
function getInheritedOptionGroups(root: Command, metadata: CommandHelpMetadata | undefined): IHelpRow[][] {
  const groups = new Set<GlobalOptionGroup>(metadata?.globalOptionGroups ?? []);
  if (!metadata?.omitProcessOptions) {
    groups.add("process");
  }

  const blocks = INHERITED_SECTIONS.map((sectionGroups) =>
    root.options
      .filter((option) => !option.hidden)
      .filter((option) => {
        const group = getGlobalOptionGroup(option);
        return group !== undefined && groups.has(group) && sectionGroups.includes(group);
      })
      .map((option) => optionRow(option))
  ).filter((rows) => rows.length > 0);

  blocks.push([{ label: HELP_FLAGS, description: HELP_DESCRIPTION }]);
  return blocks;
}

/** Command lists show a one-line summary; the full description is on the command's own help. */
function commandRow(command: Command): IHelpRow {
  return { label: `${command.name()}:`, description: command.summary() || firstSentence(command.description()) };
}

function firstSentence(text: string): string {
  const match = /^.+?[.!?](?=\s|$)/.exec(text.trim());
  return match ? match[0] : text.trim();
}

function argumentRow(argument: Argument): IHelpRow {
  const extras: string[] = [];

  if (
    argument.argChoices &&
    argument.argChoices.length > 0 &&
    !allMentioned(argument.argChoices, argument.description)
  ) {
    extras.push(`choices: ${argument.argChoices.join(", ")}`);
  }

  if (argument.defaultValue !== undefined) {
    extras.push(`default: ${argument.defaultValueDescription ?? formatValue(argument.defaultValue)}`);
  }

  return { label: formatArgumentLabel(argument), description: withExtras(argument.description, extras) };
}

function optionRow(option: Option): IHelpRow {
  const extras: string[] = [];

  if (option.mandatory) {
    extras.push("required");
  }

  if (option.argChoices && option.argChoices.length > 0 && !allMentioned(option.argChoices, option.description)) {
    extras.push(`choices: ${option.argChoices.join(", ")}`);
  }

  // A `false` default on a switch is the absence of the switch, not information.
  const isNoiseDefault = option.defaultValue === false || option.negate;
  if (option.defaultValue !== undefined && !isNoiseDefault) {
    extras.push(`default: ${option.defaultValueDescription ?? formatValue(option.defaultValue)}`);
  }

  if (option.envVar) {
    extras.push(`env: ${option.envVar}`);
  }

  return { label: option.flags, description: withExtras(option.description, extras) };
}

function formatArgumentLabel(argument: Argument): string {
  const name = argument.variadic ? `${argument.name()}...` : argument.name();
  return argument.required ? `<${name}>` : `[${name}]`;
}

function getOptionPlaceholder(option: Option): string | undefined {
  const match = /[<[][^<[]*[>\]]$/.exec(option.flags);
  return match ? match[0] : undefined;
}

function getFlagTokens(option: Option): string[] {
  return option.flags.split(/[\s,|]+/).filter((token) => token.startsWith("-"));
}

function allMentioned(choices: readonly string[], description: string): boolean {
  return choices.every((choice) => description.includes(choice));
}

function withExtras(description: string, extras: string[]): string {
  if (extras.length === 0) {
    return description;
  }

  const suffix = `(${extras.join("; ")})`;
  return description ? `${description} ${suffix}` : suffix;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return JSON.stringify(value);
}

/**
 * The label column width for a section: the longest label that fits within MAX_LABEL_WIDTH (or
 * 40% of a narrow terminal). Longer labels render on their own line (see renderRows).
 */
function computeLabelWidth(rows: IHelpRow[], width: number): number {
  const cap = Math.max(12, Math.min(MAX_LABEL_WIDTH, Math.floor(width * 0.4)));
  const fitting = rows.map((row) => row.label.length).filter((length) => length <= cap);
  return fitting.length > 0 ? Math.max(...fitting) : cap;
}

function renderRows(rows: IHelpRow[], labelWidth: number, width: number): string[] {
  const lines: string[] = [];
  const descriptionColumn = INDENT.length + labelWidth + COLUMN_GAP;
  const descriptionWidth = width - descriptionColumn;

  if (descriptionWidth < MIN_DESCRIPTION_WIDTH) {
    const stackedIndent = INDENT + INDENT;
    for (const row of rows) {
      lines.push(INDENT + row.label);
      for (const line of wrap(row.description, width - stackedIndent.length)) {
        lines.push(stackedIndent + line);
      }
    }
    return lines.map((line) => line.trimEnd());
  }

  const continuation = " ".repeat(descriptionColumn);

  for (const row of rows) {
    const descriptionLines = wrap(row.description, descriptionWidth);

    if (row.label.length > labelWidth) {
      lines.push(INDENT + row.label);
      for (const line of descriptionLines) {
        lines.push(continuation + line);
      }
      continue;
    }

    lines.push(INDENT + row.label.padEnd(labelWidth) + " ".repeat(COLUMN_GAP) + (descriptionLines[0] ?? ""));
    for (const line of descriptionLines.slice(1)) {
      lines.push(continuation + line);
    }
  }

  return lines.map((line) => line.trimEnd());
}

/**
 * Wraps prose to `width` on spaces. Explicit newlines are kept, and each line's leading
 * whitespace is reused for its continuation lines so indented lists stay indented. Words
 * longer than the width (URLs, paths) are never split.
 */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.trim().split(/\r?\n/)) {
    const indent = /^\s*/.exec(paragraph)?.[0] ?? "";
    const words = paragraph
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = indent + words[0];
    for (const word of words.slice(1)) {
      if (line.length + 1 + word.length <= width) {
        line += " " + word;
      } else {
        lines.push(line);
        line = indent + word;
      }
    }
    lines.push(line);
  }

  return lines;
}

function section(title: string, body: string[], context: IHelpRenderContext): string[] {
  if (body.length === 0) {
    return [];
  }

  return [context.useColor ? `${ANSI_BOLD}${title}${ANSI_RESET}` : title, ...body, ""];
}

/** Rows under a title. The label column fits this section's rows unless `labelWidth` is given. */
function rowsSection(title: string, rows: IHelpRow[], context: IHelpRenderContext, labelWidth?: number): string[] {
  if (rows.length === 0) {
    return [];
  }

  const width = labelWidth ?? computeLabelWidth(rows, context.width);
  return section(title, renderRows(rows, width, context.width), context);
}

/** Row groups separated by blank lines, so related flags read as a unit. */
function groupedRowsSection(title: string, groups: IHelpRow[][], context: IHelpRenderContext): string[] {
  const labelWidth = computeLabelWidth(groups.flat(), context.width);
  const body: string[] = [];

  for (const rows of groups.filter((group) => group.length > 0)) {
    if (body.length > 0) {
      body.push("");
    }
    body.push(...renderRows(rows, labelWidth, context.width));
  }

  return section(title, body, context);
}

/** Lines copied verbatim: usage strings and commands the reader may copy and run. */
function textSection(title: string, lines: string[], context: IHelpRenderContext): string[] {
  return section(
    title,
    lines.filter((line) => line.length > 0).map((line) => INDENT + line),
    context
  );
}

/** Sentences wrapped to the width, one or more lines per entry. */
function proseSection(title: string, paragraphs: string[], context: IHelpRenderContext): string[] {
  const body = paragraphs
    .filter((paragraph) => paragraph && paragraph.trim().length > 0)
    .flatMap((paragraph) => wrap(paragraph, context.width - INDENT.length))
    .map((line) => (line.length > 0 ? INDENT + line : line));

  return section(title, body, context);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }
  return result;
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent transpositions). */
function editDistance(a: string, b: string): number {
  const d: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}
