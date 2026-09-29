/**
 * SkillsCommand - Lists the agent skills that ship with this version of the CLI, or prints one.
 *
 * Skills are step-by-step guides for AI agents, loaded and rendered by src/local/McpSkillLibrary.ts.
 * `mct mcp` serves them through its getSkill tool; this command prints the same text for agents
 * that only use the CLI, with script paths and package versions filled in for this install. It only
 * reads the skills: nothing is copied into agent skill folders. src/cli/index.ts calls printSkills()
 * before Creator Tools and project loading, so the command works from any folder, ignores -i and -o,
 * and creates no files there.
 *
 * USAGE:
 *   mct skills                   List the skills
 *   mct skills <name>            Print a skill's guide (SKILL.md)
 *   mct skills <name> <file>     Print one of its other files, such as references/behaviors.md
 *   Add --json for machine-readable output.
 */

import * as path from "path";
import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes, ILogger } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import McpSkillLibrary from "../../../local/McpSkillLibrary";
import { constants } from "../../../core/Constants";

const JSON_SCHEMA_VERSION = "1.0.0";

/**
 * How to run this CLI without a global install: pinned to this version for releases, `@latest` for dev
 * builds (the same rule McpSkillLibrary.renderText() uses). Agents that ran the CLI through npx would
 * otherwise try `mct skills` and get "command not found".
 */
function npxSkillsCommand(library: McpSkillLibrary): string {
  return `npx -y @minecraft/creator-tools@${library.packageTag ?? "latest"} skills`;
}

/** Text for `mct skills` with no arguments: every skill with the first sentence of its description. */
export function buildSkillListText(library: McpSkillLibrary): string {
  if (library.skills.length === 0) {
    return "No skills were found in this installation of Minecraft Creator Tools.";
  }

  const width = Math.max(...library.skillNames.map((name) => name.length)) + 2;
  const lines = [
    `Minecraft Creator Tools ${library.cliVersion} includes ${library.skills.length} skills: step-by-step guides for AI agents doing common Minecraft Bedrock add-on tasks.`,
    `Before starting one of these tasks, print the matching skill with \`mct skills <name>\` (without a global install: \`${npxSkillsCommand(library)} <name>\`) and follow it.`,
    "",
  ];

  for (const skill of library.skills) {
    lines.push(`  ${skill.name.padEnd(width)}${McpSkillLibrary.firstSentence(skill.description)}`);
  }

  lines.push("", `Skills folder: ${path.dirname(library.skills[0].folderPath)}`);
  return lines.join("\n");
}

export function buildSkillListJson(library: McpSkillLibrary): object {
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    command: "skills",
    version: library.cliVersion,
    skills: library.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      folder: skill.folderPath,
      files: skill.files,
    })),
  };
}

/** JSON for `mct skills <name> [file]`. Returns undefined when the skill or file doesn't exist. */
export function buildSkillFileJson(library: McpSkillLibrary, name: string, file?: string): object | undefined {
  const skill = library.getSkill(name);
  const requestedFile = McpSkillLibrary.normalizeFile(file || "SKILL.md");
  const content = library.readFile(name, requestedFile);
  if (!skill || content === undefined) {
    return undefined;
  }

  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    command: "skills",
    version: library.cliVersion,
    name: skill.name,
    file: requestedFile,
    folder: skill.folderPath,
    otherFiles: skill.files.filter((candidate) => candidate !== requestedFile),
    content,
  };
}

/** The "Agent skills" section at the end of `mct --help`. Undefined when no skills were found. */
export function buildSkillsHelpText(library: McpSkillLibrary): string | undefined {
  if (library.skills.length === 0) {
    return undefined;
  }

  return [
    "",
    "Agent skills:",
    "  Step-by-step guides for AI agents doing common add-on tasks with these tools:",
    `  ${library.skillNames.join(", ")}.`,
    "  Run `mct skills` to list them, or `mct skills <name>` to print one.",
    `  Without a global install, use \`${npxSkillsCommand(library)}\`.`,
  ].join("\n");
}

export interface ISkillsRequest {
  /** Skill to print. Undefined lists every skill. */
  name?: string;
  /** File inside the skill. Defaults to SKILL.md. */
  file?: string;
  json: boolean;
}

/**
 * Prints the skill list, or one skill file, to stdout (errors to stderr). Returns the exit code.
 * The CLI calls this directly, before any project loading (see src/cli/index.ts).
 */
export function printSkills(library: McpSkillLibrary, request: ISkillsRequest, log: ILogger): number {
  if (library.skills.length === 0) {
    log.error("No skills were found in this installation of Minecraft Creator Tools.");
    return ErrorCodes.INIT_ERROR;
  }

  const { name, file, json } = request;
  if (!name) {
    log.data(json ? JSON.stringify(buildSkillListJson(library)) : buildSkillListText(library));
    return ErrorCodes.SUCCESS;
  }

  const response = library.buildSkillResponse(name, file, `print with \`mct skills ${name} <file>\``);
  if (response.isError) {
    log.error(response.text);
    return ErrorCodes.INIT_ERROR;
  }

  log.data(json ? JSON.stringify(buildSkillFileJson(library, name, file)) : response.text);
  return ErrorCodes.SUCCESS;
}

export class SkillsCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "skills",
    description:
      "List agent skills: step-by-step guides that show AI agents how to do common add-on tasks. Name one to print it.",
    taskType: TaskType.skills,
    aliases: ["skill"],
    // The registry passes positional arguments through generic context fields, like `fix <fix>`.
    arguments: [
      {
        name: "name",
        description: "Skill to print. Leave out to list every skill.",
        required: false,
        contextField: "subCommand",
      },
      {
        name: "file",
        description: "A file inside the skill, such as references/behaviors.md. Defaults to SKILL.md.",
        required: false,
        contextField: "propertyValue",
      },
    ],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Information",
  };

  configure(_cmd: Command): void {
    // No additional options; --json is a global option.
  }

  async execute(context: ICommandContext): Promise<void> {
    const exitCode = printSkills(
      McpSkillLibrary.load(constants.version),
      { name: context.subCommand, file: context.propertyValue, json: context.json },
      context.log
    );
    context.setExitCode(exitCode);
  }
}

export const skillsCommand = new SkillsCommand();
