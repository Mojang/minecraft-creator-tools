// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandParser - Parse Minecraft commands for editor intelligence
 *
 * Provides parsing and analysis of mcfunction command syntax.
 */

import { IBedrockKnowledge, IKnowledgeCommandOverload } from "../../knowledge/IBedrockKnowledge";
import {
  formatCommandOverloads,
  getBedrockKnowledge,
  onDidChangeBedrockKnowledge,
} from "../../knowledge/BedrockKnowledge";

/**
 * A parsed command with its parts
 */
export interface IParsedCommand {
  /** Full command text */
  text: string;
  /** Command name (without leading /) */
  command: string;
  /** Command arguments */
  arguments: ICommandArgument[];
  /** Position of cursor (if relevant) */
  cursorPosition?: number;
  /** Whether command starts with / */
  hasSlashPrefix: boolean;
  /** Line number in file */
  lineNumber: number;
  /** Whether this is a comment line */
  isComment: boolean;
}

/**
 * A command argument
 */
export interface ICommandArgument {
  /** Argument value */
  value: string;
  /** Start offset in command */
  start: number;
  /** End offset in command */
  end: number;
  /** Argument type (if determined) */
  type?: ArgumentType;
  /** Selector data (if this is a selector) */
  selector?: IParsedSelector;
}

/**
 * Argument types
 */
export type ArgumentType =
  | "selector"
  | "position"
  | "block"
  | "item"
  | "entity"
  | "string"
  | "number"
  | "boolean"
  | "json"
  | "nbt"
  | "unknown";

/**
 * A parsed selector (@a, @e, etc.)
 */
export interface IParsedSelector {
  /** Selector type (a, e, p, r, s, n, initiator) */
  type: string;
  /** Full selector text */
  fullText: string;
  /** Selector arguments */
  arguments: Map<string, string>;
  /** Start offset */
  start: number;
  /** End offset */
  end: number;
}

/**
 * Command information
 */
export interface ICommandInfo {
  /** Command name (or alias) */
  name: string;
  /** Short description */
  description: string;
  /** Usage syntax of the first overload */
  syntax: string;
  /** Usage syntax of every overload, as reported by the engine */
  usages?: string[];
  /** Example usage */
  examples?: string[];
  /** Permission level required */
  permissionLevel?: number;
  /** Whether this is operator-only */
  operatorOnly?: boolean;
  /** Whether cheats must be enabled for the command to run */
  requiresCheats?: boolean;
  /** Other names the engine accepts for this command */
  aliases?: string[];
  /** When this entry is an alias, the canonical command name */
  aliasOf?: string;
  /** Engine overload data, for argument-aware completions and diagnostics */
  overloads?: IKnowledgeCommandOverload[];
}

/**
 * Hand-curated examples layered on top of engine command data.
 */
export const COMMAND_EXAMPLES: { [command: string]: string[] } = {
  setblock: ["setblock ~ ~1 ~ stone", "setblock 0 64 0 air destroy"],
  fill: ["fill ~-5 ~ ~-5 ~5 ~5 ~5 stone hollow"],
  summon: ["summon pig", "summon minecraft:zombie ~ ~ ~"],
  kill: ["kill @e[type=zombie]", "kill @s"],
  teleport: ["tp @s 0 64 0", "tp @a @p"],
  effect: ["effect @a speed 30 2"],
  execute: ["execute as @a at @s run say Hello"],
  gamemode: ["gamemode creative", "gamemode 0 @a"],
  give: ["give @s diamond 64"],
  xp: ["xp 100L @s", "xp -5 @a"],
  say: ["say Hello World!"],
  title: ["title @a title Welcome!"],
  tag: ["tag @s add vip", "tag @e remove temp"],
  time: ["time set day", "time add 1000"],
  gamerule: ["gamerule keepInventory true"],
  function: ["function myaddon/setup"],
  event: ["event entity @s minecraft:ageable_grow_up"],
};

/** Commands that only operators/hosts may run (engine permission level above game directors). */
const OPERATOR_PERMISSION_LEVEL = 2;

/**
 * Build command info entries (canonical commands plus one entry per alias) from engine knowledge.
 */
export function buildCommandInfos(knowledge: IBedrockKnowledge = getBedrockKnowledge()): ICommandInfo[] {
  const infos: ICommandInfo[] = [];
  for (const cmd of knowledge.commands) {
    const usages = formatCommandOverloads(cmd);
    const base: ICommandInfo = {
      name: cmd.name,
      description: cmd.description,
      syntax: usages[0] ?? cmd.name,
      usages,
      examples: COMMAND_EXAMPLES[cmd.name],
      permissionLevel: cmd.permissionLevel,
      operatorOnly: cmd.permissionLevel >= OPERATOR_PERMISSION_LEVEL,
      requiresCheats: cmd.requiresCheats,
      aliases: cmd.aliases,
      overloads: cmd.overloads,
    };
    infos.push(base);
    for (const alias of cmd.aliases) {
      infos.push({
        ...base,
        name: alias,
        aliasOf: cmd.name,
        description: `${cmd.description} (alias of /${cmd.name})`,
        syntax: base.syntax.replace(cmd.name, alias),
        usages: usages.map((u) => u.replace(cmd.name, alias)),
      });
    }
  }
  return infos.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Known Minecraft commands, derived from engine metadata for the active Bedrock channel.
 * The array instance is stable; its contents are refreshed in place when the knowledge changes.
 */
export const MINECRAFT_COMMANDS: ICommandInfo[] = buildCommandInfos();

onDidChangeBedrockKnowledge((knowledge) => {
  MINECRAFT_COMMANDS.splice(0, MINECRAFT_COMMANDS.length, ...buildCommandInfos(knowledge));
});

/**
 * Selector types and their meanings
 */
export const SELECTOR_TYPES: { [key: string]: { description: string; example: string } } = {
  a: { description: "All players", example: "@a[r=10]" },
  e: { description: "All entities", example: "@e[type=zombie]" },
  p: { description: "Nearest player", example: "@p" },
  r: { description: "Random player(s)", example: "@r[c=3]" },
  s: { description: "Executing entity (self)", example: "@s" },
  n: { description: "Nearest entity", example: "@n[type=minecraft:cow]" },
  initiator: { description: "Player who triggered NPC dialogue", example: "@initiator" },
};

/**
 * Selector arguments
 */
export const SELECTOR_ARGUMENTS: { name: string; description: string; example: string }[] = [
  { name: "x", description: "X coordinate for selection center", example: "x=100" },
  { name: "y", description: "Y coordinate for selection center", example: "y=64" },
  { name: "z", description: "Z coordinate for selection center", example: "z=100" },
  { name: "r", description: "Maximum radius from center", example: "r=10" },
  { name: "rm", description: "Minimum radius from center", example: "rm=5" },
  { name: "dx", description: "X dimension of selection box", example: "dx=10" },
  { name: "dy", description: "Y dimension of selection box", example: "dy=5" },
  { name: "dz", description: "Z dimension of selection box", example: "dz=10" },
  { name: "c", description: "Count/limit of entities", example: "c=5" },
  { name: "type", description: "Entity type filter", example: "type=zombie" },
  { name: "name", description: "Entity name filter", example: 'name="Steve"' },
  { name: "tag", description: "Tag filter (prefix ! to exclude)", example: "tag=boss" },
  { name: "scores", description: "Scoreboard score filter", example: "scores={health=10..}" },
  { name: "m", description: "Game mode filter", example: "m=creative" },
  { name: "l", description: "Maximum experience level", example: "l=30" },
  { name: "lm", description: "Minimum experience level", example: "lm=10" },
  { name: "rx", description: "Maximum X rotation (pitch)", example: "rx=90" },
  { name: "rxm", description: "Minimum X rotation (pitch)", example: "rxm=-90" },
  { name: "ry", description: "Maximum Y rotation (yaw)", example: "ry=180" },
  { name: "rym", description: "Minimum Y rotation (yaw)", example: "rym=-180" },
  { name: "family", description: "Entity family filter", example: "family=monster" },
  { name: "hasitem", description: "Item in inventory filter", example: "hasitem={item=diamond}" },
  { name: "haspermission", description: "Permission filter", example: "haspermission={camera=enabled}" },
];

/**
 * Parse a command line
 */
export class CommandParser {
  /**
   * Parse a single command line
   */
  public parseLine(line: string, lineNumber: number): IParsedCommand {
    const trimmed = line.trim();

    // Check for comment
    if (trimmed.startsWith("#")) {
      return {
        text: line,
        command: "",
        arguments: [],
        hasSlashPrefix: false,
        lineNumber,
        isComment: true,
      };
    }

    // Remove leading /
    const hasSlash = trimmed.startsWith("/");
    const commandText = hasSlash ? trimmed.slice(1) : trimmed;

    // Parse command name and arguments
    const args = this.parseArguments(commandText);
    const commandName = args.length > 0 ? args[0].value : "";

    return {
      text: line,
      command: commandName,
      arguments: args.slice(1),
      hasSlashPrefix: hasSlash,
      lineNumber,
      isComment: false,
    };
  }

  /**
   * Parse command arguments
   */
  private parseArguments(text: string): ICommandArgument[] {
    const args: ICommandArgument[] = [];
    let current = "";
    let start = 0;
    let inString = false;
    let stringChar = "";
    let bracketDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i <= text.length; i++) {
      const char = text[i];
      const isEnd = i === text.length;

      // Handle end of text or whitespace separator
      if (isEnd || (char === " " && !inString && bracketDepth === 0 && braceDepth === 0)) {
        if (current.length > 0) {
          const arg = this.createArgument(current, start, i);
          args.push(arg);
          current = "";
        }
        start = i + 1;
        continue;
      }

      // Track string state. A quote is escaped only by an odd run of backslashes; an even run is
      // a sequence of escaped backslashes, so the quote after it still opens or closes the string.
      if ((char === '"' || char === "'") && countBackslashesBefore(text, i) % 2 === 0) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Track brackets and braces
      if (!inString) {
        if (char === "[") bracketDepth++;
        if (char === "]") bracketDepth--;
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }

      current += char;
    }

    return args;
  }

  /**
   * Create a command argument with type detection
   */
  private createArgument(value: string, start: number, end: number): ICommandArgument {
    const arg: ICommandArgument = { value, start, end };

    // Detect type
    if (value.startsWith("@")) {
      arg.type = "selector";
      arg.selector = this.parseSelector(value, start);
    } else if (value.match(/^~?-?\d*\.?\d*$/)) {
      arg.type = value.includes(".") ? "number" : "number";
    } else if (value.startsWith("{") || value.startsWith("[")) {
      arg.type = "json";
    } else if (value === "true" || value === "false") {
      arg.type = "boolean";
    } else if (value.includes(":")) {
      // Namespaced ID (block, item, entity)
      arg.type = "entity";
    } else {
      arg.type = "string";
    }

    return arg;
  }

  /**
   * Parse a selector (@a[...])
   */
  public parseSelector(text: string, offset: number = 0): IParsedSelector {
    const match = text.match(/^@([aeprsn]|initiator)(?:\[(.*)\])?$/);

    if (!match) {
      return {
        type: "unknown",
        fullText: text,
        arguments: new Map(),
        start: offset,
        end: offset + text.length,
      };
    }

    const type = match[1];
    const argsText = match[2] || "";
    const args = new Map<string, string>();

    // Parse selector arguments
    if (argsText) {
      const argPattern = /(\w+)=([^,\]]+|\{[^}]+\}|\[[^\]]+\])/g;
      let argMatch;
      while ((argMatch = argPattern.exec(argsText)) !== null) {
        args.set(argMatch[1], argMatch[2]);
      }
    }

    return {
      type,
      fullText: text,
      arguments: args,
      start: offset,
      end: offset + text.length,
    };
  }

  /**
   * Get command info by name
   */
  public getCommandInfo(name: string): ICommandInfo | undefined {
    const lower = name.toLowerCase();
    return MINECRAFT_COMMANDS.find((cmd) => cmd.name === lower);
  }

  /**
   * Get cursor context in a command
   */
  public getCursorContext(
    line: string,
    cursorOffset: number
  ): { command: string; argumentIndex: number; inSelector: boolean; selectorContext?: string } {
    const parsed = this.parseLine(line, 0);
    parsed.cursorPosition = cursorOffset;

    // Find which argument the cursor is in
    let argumentIndex = -1;
    let inSelector = false;
    let selectorContext: string | undefined;

    // Check if cursor is in command name
    const commandEnd = line.indexOf(" ");
    if (commandEnd === -1 || cursorOffset <= commandEnd) {
      return { command: "", argumentIndex: -1, inSelector: false };
    }

    // Find the argument at cursor position
    for (let i = 0; i < parsed.arguments.length; i++) {
      const arg = parsed.arguments[i];
      if (cursorOffset >= arg.start && cursorOffset <= arg.end) {
        argumentIndex = i;

        if (arg.selector) {
          inSelector = true;
          // Determine if cursor is in selector arguments
          if (arg.value.includes("[") && cursorOffset > arg.start + arg.value.indexOf("[")) {
            selectorContext = "arguments";
          } else {
            selectorContext = "type";
          }
        }
        break;
      }
    }

    return {
      command: parsed.command,
      argumentIndex,
      inSelector,
      selectorContext,
    };
  }
}

function countBackslashesBefore(text: string, index: number): number {
  let count = 0;
  while (index - count - 1 >= 0 && text[index - count - 1] === "\\") {
    count++;
  }
  return count;
}

// Singleton instance
export const commandParser = new CommandParser();
