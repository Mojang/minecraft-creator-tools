// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandParser - Parse Minecraft commands for editor intelligence
 *
 * Provides parsing and analysis of mcfunction command syntax.
 */

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
  /** Selector type (a, e, p, r, s, initiator) */
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
  /** Command name */
  name: string;
  /** Short description */
  description: string;
  /** Usage syntax */
  syntax: string;
  /** Example usage */
  examples?: string[];
  /** Permission level required */
  permissionLevel?: number;
  /** Whether this is operator-only */
  operatorOnly?: boolean;
}

/**
 * Known Minecraft commands with metadata
 */
export const MINECRAFT_COMMANDS: ICommandInfo[] = [
  // World commands
  {
    name: "setblock",
    description: "Places a block",
    syntax: "setblock <position> <block> [replace|destroy|keep]",
    examples: ["setblock ~ ~1 ~ stone", "setblock 0 64 0 air destroy"],
  },
  {
    name: "fill",
    description: "Fills a region with blocks",
    syntax: "fill <from> <to> <block> [replace|hollow|outline|destroy|keep]",
    examples: ["fill ~-5 ~ ~-5 ~5 ~5 ~5 stone hollow"],
  },
  {
    name: "clone",
    description: "Copies blocks from one region to another",
    syntax: "clone <begin> <end> <destination> [replace|masked] [force|move|normal]",
  },
  { name: "structure", description: "Manages structures", syntax: "structure save|load|delete <name> ..." },

  // Entity commands
  {
    name: "summon",
    description: "Summons an entity",
    syntax: "summon <entity> [position] [facing|spawnEvent] [nameTag]",
    examples: ["summon pig", "summon minecraft:zombie ~ ~ ~"],
  },
  {
    name: "kill",
    description: "Kills entities",
    syntax: "kill [target]",
    examples: ["kill @e[type=zombie]", "kill @s"],
  },
  {
    name: "tp",
    description: "Teleports entities",
    syntax: "tp <target> <destination>|<x y z> [facing]",
    examples: ["tp @s 0 64 0", "tp @a @p"],
  },
  {
    name: "teleport",
    description: "Teleports entities (alias for tp)",
    syntax: "teleport <target> <destination>|<x y z> [facing]",
  },
  {
    name: "effect",
    description: "Manages status effects",
    syntax: "effect <target> <effect> [seconds] [amplifier] [hideParticles]",
    examples: ["effect @a speed 30 2"],
  },
  {
    name: "execute",
    description: "Executes commands with modified context",
    syntax: "execute <subcommand> ...",
    examples: ["execute as @a at @s run say Hello"],
  },

  // Player commands
  {
    name: "gamemode",
    description: "Sets a player's game mode",
    syntax: "gamemode <mode> [player]",
    examples: ["gamemode creative", "gamemode 0 @a"],
  },
  {
    name: "give",
    description: "Gives items to players",
    syntax: "give <player> <item> [amount] [data] [components]",
    examples: ["give @s diamond 64"],
  },
  { name: "clear", description: "Clears items from inventory", syntax: "clear [player] [item] [data] [maxCount]" },
  {
    name: "xp",
    description: "Manages experience",
    syntax: "xp <amount>[L] [player]",
    examples: ["xp 100L @s", "xp -5 @a"],
  },
  { name: "spawnpoint", description: "Sets spawn point", syntax: "spawnpoint [player] [position]" },
  {
    name: "spreadplayers",
    description: "Spreads players randomly",
    syntax: "spreadplayers <x> <z> <spreadDistance> <maxRange> <target>",
  },

  // Communication commands
  { name: "say", description: "Sends a message", syntax: "say <message>", examples: ["say Hello World!"] },
  { name: "tell", description: "Sends a private message", syntax: "tell <player> <message>" },
  { name: "msg", description: "Sends a private message (alias)", syntax: "msg <player> <message>" },
  { name: "w", description: "Whispers a message (alias)", syntax: "w <player> <message>" },
  { name: "me", description: "Displays an action message", syntax: "me <message>" },
  {
    name: "title",
    description: "Manages screen titles",
    syntax: "title <player> <title|subtitle|actionbar|clear|reset|times> ...",
    examples: ["title @a title Welcome!"],
  },
  { name: "tellraw", description: "Sends a JSON message", syntax: "tellraw <player> <rawJsonMessage>" },
  { name: "titleraw", description: "Displays a JSON title", syntax: "titleraw <player> <type> <rawJsonMessage>" },

  // Scoreboard commands
  { name: "scoreboard", description: "Manages scoreboards", syntax: "scoreboard objectives|players <subcommand> ..." },
  {
    name: "tag",
    description: "Manages entity tags",
    syntax: "tag <target> add|remove|list <tagName>",
    examples: ["tag @s add vip", "tag @e remove temp"],
  },

  // World state
  {
    name: "time",
    description: "Changes world time",
    syntax: "time add|query|set <value>",
    examples: ["time set day", "time add 1000"],
  },
  { name: "weather", description: "Changes weather", syntax: "weather <clear|rain|thunder> [duration]" },
  { name: "difficulty", description: "Sets difficulty", syntax: "difficulty <peaceful|easy|normal|hard>" },
  {
    name: "gamerule",
    description: "Manages game rules",
    syntax: "gamerule <rule> [value]",
    examples: ["gamerule keepInventory true"],
  },
  { name: "setworldspawn", description: "Sets world spawn", syntax: "setworldspawn [position]" },
  { name: "worldborder", description: "Manages world border", syntax: "worldborder <subcommand> ..." },

  // Functions and logic
  {
    name: "function",
    description: "Runs a function file",
    syntax: "function <name>",
    examples: ["function myaddon:setup"],
  },
  { name: "schedule", description: "Schedules a function", syntax: "schedule on_area_loaded add ..." },
  {
    name: "event",
    description: "Triggers an entity event",
    syntax: "event entity <target> <eventName>",
    examples: ["event entity @s minecraft:ageable_grow_up"],
  },

  // Technical commands
  { name: "testfor", description: "Tests for entities", syntax: "testfor <target>" },
  { name: "testforblock", description: "Tests for a block", syntax: "testforblock <position> <block> [dataValue]" },
  {
    name: "testforblocks",
    description: "Compares block regions",
    syntax: "testforblocks <begin> <end> <destination> [all|masked]",
  },
  { name: "locate", description: "Locates structures/biomes", syntax: "locate structure|biome <name>" },

  // Particle and sound
  { name: "particle", description: "Creates particles", syntax: "particle <effect> <position>" },
  {
    name: "playsound",
    description: "Plays a sound",
    syntax: "playsound <sound> [player] [position] [volume] [pitch] [minVolume]",
  },
  { name: "stopsound", description: "Stops sounds", syntax: "stopsound <player> [sound]" },
  { name: "music", description: "Controls music", syntax: "music play|queue|stop|volume <trackName> ..." },

  // Camera
  { name: "camera", description: "Controls camera", syntax: "camera <player> set|clear|fade ..." },
  { name: "fog", description: "Manages fog settings", syntax: "fog <player> push|pop|remove <fogId>" },

  // Misc
  { name: "dialogue", description: "Controls NPC dialogue", syntax: "dialogue open|change <npc> <player> [sceneName]" },
  {
    name: "ride",
    description: "Manages riding",
    syntax: "ride <rider> start_riding|stop_riding|summon_ride|summon_rider ...",
  },
  {
    name: "replaceitem",
    description: "Replaces items in slots",
    syntax: "replaceitem block|entity <target> slot.<slotType> <slotId> <item> [amount] [data] [components]",
  },
  { name: "loot", description: "Spawns loot", syntax: "loot spawn|give|insert|replace ..." },
  { name: "tickingarea", description: "Manages ticking areas", syntax: "tickingarea add|remove|list ..." },
  {
    name: "inputpermission",
    description: "Controls input permissions",
    syntax: "inputpermission query|set <player> <permission> ...",
  },
];

/**
 * Selector types and their meanings
 */
export const SELECTOR_TYPES: { [key: string]: { description: string; example: string } } = {
  a: { description: "All players", example: "@a[r=10]" },
  e: { description: "All entities", example: "@e[type=zombie]" },
  p: { description: "Nearest player", example: "@p" },
  r: { description: "Random player(s)", example: "@r[c=3]" },
  s: { description: "Executing entity (self)", example: "@s" },
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

      // Track string state
      if ((char === '"' || char === "'") && text[i - 1] !== "\\") {
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
    const match = text.match(/^@([aeprs]|initiator)(?:\[(.*)\])?$/);

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
    return MINECRAFT_COMMANDS.find((cmd) => cmd.name === name.toLowerCase());
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

// Singleton instance
export const commandParser = new CommandParser();
