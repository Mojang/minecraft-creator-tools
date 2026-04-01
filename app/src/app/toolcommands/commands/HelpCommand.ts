// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * HelpCommand - Unified help for ToolCommands and Bedrock commands
 *
 * This is the ONE command that overrides Bedrock's built-in /help.
 * It provides unified documentation for both MCT ToolCommands and
 * Bedrock server commands.
 */

import type { IToolCommand, IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { ToolCommandRegistry } from "../ToolCommandRegistry";

// Bedrock built-in commands for reference in help.
// MAINTENANCE: This list is manually maintained and should be updated when
// new slash commands are added to Minecraft Bedrock Edition.
// Reference: https://learn.microsoft.com/en-us/minecraft/creator/commands/
const BEDROCK_COMMANDS = [
  "allowlist",
  "alwaysday",
  "camera",
  "camerashake",
  "clear",
  "clearspawnpoint",
  "clone",
  "damage",
  "daylock",
  "deop",
  "dialogue",
  "difficulty",
  "effect",
  "enchant",
  "event",
  "execute",
  "fill",
  "fog",
  "function",
  "gamemode",
  "gamerule",
  "give",
  "hud",
  "inputpermission",
  "kick",
  "kill",
  "list",
  "locate",
  "loot",
  "me",
  "mobevent",
  "music",
  "op",
  "ops",
  "particle",
  "permission",
  "place",
  "playanimation",
  "playsound",
  "recipe",
  "reload",
  "replaceitem",
  "ride",
  "say",
  "schedule",
  "scoreboard",
  "script",
  "scriptevent",
  "setblock",
  "setmaxplayers",
  "setworldspawn",
  "spawnpoint",
  "spreadplayers",
  "stop",
  "stopsound",
  "structure",
  "summon",
  "tag",
  "teleport",
  "tell",
  "tellraw",
  "testfor",
  "testforblock",
  "testforblocks",
  "tickingarea",
  "time",
  "title",
  "titleraw",
  "toggledownfall",
  "tp",
  "transfer",
  "volumearea",
  "weather",
  "wsserver",
  "xp",
];

export class HelpCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "help",
    description: "Show help for ToolCommands and Bedrock server commands",
    aliases: ["?"],
    category: "General",
    arguments: [
      {
        name: "command",
        description: "Command name to get help for (optional)",
        type: "string",
        required: false,
      },
    ],
    examples: ["/help", "/help create", "/help add", "/help summon"],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const commandName = args[0];

    if (commandName) {
      return this.showCommandHelp(context, commandName);
    }

    return this.showAllHelp(context);
  }

  private showAllHelp(context: IToolCommandContext): IToolCommandResult {
    const output = context.output;
    const registry = ToolCommandRegistry.instance;

    output.info("=== Minecraft Creator Tools Commands ===");

    // Group commands by category
    const commands = registry.getAll();
    const byCategory = new Map<string, IToolCommand[]>();

    for (const cmd of commands) {
      const category = cmd.metadata.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(cmd);
    }

    // Output by category
    for (const [category, cmds] of byCategory) {
      output.info(`\n${category}:`);
      for (const cmd of cmds) {
        const aliases = cmd.metadata.aliases ? ` (${cmd.metadata.aliases.join(", ")})` : "";
        output.info(`  /${cmd.metadata.name}${aliases} - ${cmd.metadata.description}`);
      }
    }

    // Output Bedrock commands
    output.info("\n=== Bedrock Server Commands ===\n");
    output.info("The following Minecraft commands are passed through to the server:");
    output.info(`  ${BEDROCK_COMMANDS.slice(0, 15).join(", ")}, ...`);
    output.info("  (Use /help <command> for details on specific Bedrock commands)\n");

    output.info("Use /help <command> for detailed help on a specific command.");

    return this.success("Help displayed");
  }

  private showCommandHelp(context: IToolCommandContext, commandName: string): IToolCommandResult {
    const output = context.output;
    const registry = ToolCommandRegistry.instance;

    // Check if it's a ToolCommand
    const command = registry.get(commandName);
    if (command) {
      return this.showToolCommandHelp(context, command);
    }

    // Check if it's a Bedrock command
    if (BEDROCK_COMMANDS.includes(commandName.toLowerCase())) {
      output.info(`/${commandName} is a Bedrock server command.`);
      output.info("This command is passed through to the Minecraft server.");
      output.info("Run this command in-game or consult the Minecraft documentation for details.");
      return this.success(`Bedrock command: ${commandName}`);
    }

    return this.error("COMMAND_NOT_FOUND", `Unknown command: ${commandName}`);
  }

  private showToolCommandHelp(context: IToolCommandContext, command: IToolCommand): IToolCommandResult {
    const output = context.output;
    const meta = command.metadata;

    output.info(`=== /${meta.name} ===`);
    output.info(meta.description);

    if (meta.aliases && meta.aliases.length > 0) {
      output.info(`\nAliases: ${meta.aliases.map((a) => "/" + a).join(", ")}`);
    }

    // Usage line
    let usage = `/${meta.name}`;
    if (meta.arguments) {
      for (const arg of meta.arguments) {
        usage += arg.required ? ` <${arg.name}>` : ` [${arg.name}]`;
      }
    }
    if (meta.flags) {
      for (const flag of meta.flags) {
        const flagStr = flag.isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        usage += flag.required ? ` ${flagStr}` : ` [${flagStr}]`;
      }
    }
    output.info(`\nUsage: ${usage}`);

    // Arguments
    if (meta.arguments && meta.arguments.length > 0) {
      output.info("\nArguments:");
      for (const arg of meta.arguments) {
        const required = arg.required ? "(required)" : "(optional)";
        let line = `  ${arg.name} ${required} - ${arg.description}`;
        if (arg.defaultValue) {
          line += ` [default: ${arg.defaultValue}]`;
        }
        if (arg.choices) {
          line += ` [choices: ${arg.choices.join(", ")}]`;
        }
        output.info(line);
      }
    }

    // Flags
    if (meta.flags && meta.flags.length > 0) {
      output.info("\nFlags:");
      for (const flag of meta.flags) {
        const shortName = flag.shortName ? `, -${flag.shortName}` : "";
        let line = `  --${flag.name}${shortName} - ${flag.description}`;
        if (flag.defaultValue !== undefined) {
          line += ` [default: ${flag.defaultValue}]`;
        }
        if (flag.choices) {
          line += ` [choices: ${flag.choices.join(", ")}]`;
        }
        output.info(line);
      }
    }

    // Examples
    if (meta.examples && meta.examples.length > 0) {
      output.info("\nExamples:");
      for (const example of meta.examples) {
        output.info(`  ${example}`);
      }
    }

    // Requirements
    const reqs: string[] = [];
    if (meta.requiresProject) reqs.push("project");
    if (meta.requiresMinecraft) reqs.push("Minecraft server");
    if (reqs.length > 0) {
      output.info(`\nRequires: ${reqs.join(", ")}`);
    }

    return this.success(`Help for ${meta.name}`);
  }

  /**
   * Override getCompletions to provide command name suggestions.
   */
  async getCompletions(
    context: IToolCommandContext,
    args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    if (argIndex !== 0) return [];

    const lower = partialArg.toLowerCase();
    const registry = ToolCommandRegistry.instance;

    // Combine ToolCommand names with Bedrock commands
    const toolCommands = registry.getCommandNames();
    const allCommands = [...toolCommands, ...BEDROCK_COMMANDS];

    return allCommands.filter((name) => name.toLowerCase().startsWith(lower));
  }
}

export const helpCommand = new HelpCommand();
