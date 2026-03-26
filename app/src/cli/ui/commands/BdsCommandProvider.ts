/**
 * =============================================================================
 * BDS COMMAND PROVIDER - Bedrock Dedicated Server Commands
 * =============================================================================
 *
 * Loads BDS command definitions from the form data files:
 * - public/data/forms/command/cmd_*.form.json - Command definitions
 * - public/data/forms/command/type_*.form.json - Type definitions for parameters
 *
 * Provides autocomplete and help for all BDS commands including:
 * - Server commands (stop, reload, save, etc.)
 * - World commands (weather, time, difficulty, etc.)
 * - Player commands (give, effect, kill, etc.)
 * - And many more from the command forms
 *
 * Also parses structured responses from commands like:
 * - querytarget (JSON entity data)
 * - listd (player list)
 * - testfor (player match results)
 * =============================================================================
 */

import { ICommandProvider, ICommandDefinition, ICommandParameter, ICommandSuggestion, ICommandResponse } from "./ICommandProvider";
import * as fs from "fs";
import * as path from "path";

/**
 * BDS Command Provider - loads commands from form definitions
 */
export class BdsCommandProvider implements ICommandProvider {
  readonly name = "bds";
  readonly displayName = "Bedrock Dedicated Server";
  readonly priority = 50; // Lower than MCT built-ins

  private commands: Map<string, ICommandDefinition> = new Map();
  private initialized = false;

  private static readonly COMMAND_CATEGORIES: Record<string, string> = {
    stop: "Server", reload: "Server", save: "Server", list: "Server",
    setmaxplayers: "Server", changesetting: "Server", reloadconfig: "Server",
    reloadpacketlimitconfig: "Server",
    say: "Communication", tell: "Communication", me: "Communication",
    tellraw: "Communication", titleraw: "Communication", title: "Communication",
    kick: "Player", op: "Player", deop: "Player", allowlist: "Player",
    permission: "Player", inputpermission: "Player",
    give: "Items", clear: "Items", replaceitem: "Items", loot: "Items",
    recipe: "Items", enchant: "Items",
    effect: "Entity", kill: "Entity", tp: "Entity", teleport: "Entity",
    summon: "Entity", tag: "Entity", ride: "Entity", damage: "Entity",
    event: "Entity", playanimation: "Entity",
    gamemode: "World", difficulty: "World", time: "World", weather: "World",
    gamerule: "World", setblock: "World", fill: "World", clone: "World",
    setworldspawn: "World", spawnpoint: "World", clearspawnpoint: "World",
    spreadplayers: "World", daylock: "World", mobevent: "World",
    tickingarea: "World",
    execute: "Advanced", function: "Advanced", scoreboard: "Advanced",
    testfor: "Advanced", testforblock: "Advanced", testforblocks: "Advanced",
    schedule: "Advanced", scriptevent: "Advanced", script: "Advanced",
    gametest: "Advanced",
    structure: "Building", place: "Building",
    playsound: "Effects", stopsound: "Effects", particle: "Effects",
    music: "Effects", camerashake: "Effects", fog: "Effects", hud: "Effects",
    camera: "Effects", aimassist: "Effects",
    dialogue: "Other", locate: "Other", xp: "Other",
    wsserver: "Other", transfer: "Other", toggledownfall: "Other",
    sendshowstoreoffer: "Other", packstack: "Other", project: "Other",
    controlscheme: "Other", help: "Other",
  };

  // Fallback commands if form loading fails
  private static readonly FALLBACK_COMMANDS: Partial<ICommandDefinition>[] = [
    { name: "stop", description: "Stop the server", category: "Server" },
    { name: "reload", description: "Reload behavior packs, resource packs, and functions", category: "Server" },
    { name: "save", description: "Save the world", category: "Server" },
    { name: "say", description: "Broadcast a message to all players", category: "Communication" },
    { name: "tell", description: "Send a private message to a player", category: "Communication" },
    { name: "list", description: "List connected players", category: "Server" },
    { name: "kick", description: "Kick a player from the server", category: "Player" },
    { name: "op", description: "Grant operator status to a player", category: "Player" },
    { name: "deop", description: "Remove operator status from a player", category: "Player" },
    { name: "ban", description: "Ban a player from the server", category: "Player" },
    { name: "pardon", description: "Remove a player from the ban list", category: "Player" },
    { name: "give", description: "Give an item to a player", category: "Items" },
    { name: "clear", description: "Clear items from player inventory", category: "Items" },
    { name: "effect", description: "Add or remove status effects", category: "Entity" },
    { name: "kill", description: "Kill entities", category: "Entity" },
    { name: "tp", description: "Teleport entities", category: "Entity" },
    { name: "teleport", description: "Teleport entities", category: "Entity" },
    { name: "summon", description: "Summon an entity", category: "Entity" },
    { name: "gamemode", description: "Set player game mode", category: "World" },
    { name: "difficulty", description: "Set world difficulty", category: "World" },
    { name: "time", description: "Set or query world time", category: "World" },
    { name: "weather", description: "Set weather", category: "World" },
    { name: "gamerule", description: "Set or query game rules", category: "World" },
    { name: "setblock", description: "Place a block", category: "World" },
    { name: "fill", description: "Fill a region with blocks", category: "World" },
    { name: "clone", description: "Clone a region", category: "World" },
    { name: "structure", description: "Save or load structures", category: "World" },
    { name: "execute", description: "Execute a command as another entity", category: "Advanced" },
    { name: "function", description: "Run a function file", category: "Advanced" },
    { name: "scoreboard", description: "Manage scoreboard objectives and players", category: "Advanced" },
    { name: "tag", description: "Manage entity tags", category: "Entity" },
    { name: "testfor", description: "Test for entities matching selectors", category: "Advanced" },
    { name: "querytarget", description: "Query target entity data (JSON output)", category: "Advanced" },
  ];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromForms();
    } catch (error) {
      // Fall back to built-in command list when forms unavailable
      this.loadFallbackCommands();
    }

    this.initialized = true;
  }

  private async loadFromForms(): Promise<void> {
    const cwd = process.cwd();

    // Try multiple paths to find form files
    const candidatePaths = [
      path.join(cwd, "toolbuild", "jsn", "data", "forms", "command"),
      path.join(cwd, "public", "data", "forms", "command"),
    ];

    for (const formsDir of candidatePaths) {
      try {
        if (fs.existsSync(formsDir)) {
          await this.loadFormsFromDir(formsDir);
          return;
        }
      } catch {
        continue;
      }
    }

    throw new Error("Forms directory not found in any candidate path");
  }

  private async loadFormsFromDir(
    formsDir: string
  ): Promise<void> {
    const files = (await fs.promises.readdir(formsDir)).filter((f: string) => f.startsWith("cmd_") && f.endsWith(".form.json"));

    if (files.length === 0) {
      throw new Error("No command form files found");
    }

    // Load type definitions for enum values
    const typeValues = new Map<string, string[]>();
    const typeFiles = (await fs.promises.readdir(formsDir)).filter((f: string) => f.startsWith("type_") && f.endsWith(".form.json"));

    for (const typeFile of typeFiles) {
      try {
        const content = await fs.promises.readFile(path.join(formsDir, typeFile), "utf-8");
        const typeForm = JSON.parse(content);
        const typeId = typeForm.id;

        if (typeForm.samples?.values) {
          const values = typeForm.samples.values.map((v: any) => v.content).filter(Boolean);
          if (values.length > 0) {
            typeValues.set(typeId, values);
          }
        }
        // Also collect shorthands
        if (typeForm.samples?.shorthands) {
          const existing = typeValues.get(typeId) || [];
          const shorthands = typeForm.samples.shorthands.map((v: any) => v.content).filter(Boolean);
          typeValues.set(typeId, [...existing, ...shorthands]);
        }
      } catch {
        // Skip invalid type files
      }
    }

    // Load command definitions
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(path.join(formsDir, file), "utf-8");
        const form = JSON.parse(content);

        const cmdName = form.title || form.id?.replace("cmd_", "");
        if (!cmdName) continue;

        const parameters: ICommandParameter[] = [];

        if (form.fields) {
          for (const field of form.fields) {
            const param: ICommandParameter = {
              name: field.id || field.title,
              description: field.description?.replace(/`/g, "").replace(/\[.*?\]\(.*?\)/g, "$1") || field.commandType,
              required: !field.isOptional,
              type: field.commandType || field.type || "string",
            };

            // Load enum values from type file
            if (field.subFormId && typeValues.has(field.subFormId)) {
              param.enumValues = typeValues.get(field.subFormId);
            }

            // Add common examples for well-known command types
            if (field.commandType === "SELECTION") {
              param.examples = ["@a", "@p", "@s", "@e", "@r"];
            } else if (field.commandType === "POSITION" || field.commandType === "BLOCKPOS") {
              param.examples = ["~ ~ ~", "0 64 0", "~10 ~ ~-5"];
            }

            parameters.push(param);
          }
        }

        const category = BdsCommandProvider.COMMAND_CATEGORIES[cmdName.toLowerCase()] || "Other";

        const cmd: ICommandDefinition = {
          name: cmdName,
          description:
            form.description
              ?.replace(/\[.*?\]\(.*?\)/g, "")
              .replace(/See more in the.*$/, "")
              .trim() || "",
          helpText: form.description,
          parameters,
          permissionLevel: form.permissionLevel,
          requiresCheats: form.requiresCheats,
          category,
          source: "bds",
        };

        this.commands.set(cmd.name.toLowerCase(), cmd);
      } catch {
        // Skip invalid command files
      }
    }

    if (this.commands.size === 0) {
      throw new Error("No commands loaded from forms");
    }
  }

  private loadFallbackCommands(): void {
    for (const cmdData of BdsCommandProvider.FALLBACK_COMMANDS) {
      const cmd: ICommandDefinition = {
        name: cmdData.name!,
        description: cmdData.description || "",
        helpText: cmdData.description,
        parameters: [],
        category: cmdData.category || "BDS",
        source: "bds",
      };
      this.commands.set(cmd.name, cmd);
    }
  }

  getCommands(): ICommandDefinition[] {
    return Array.from(this.commands.values());
  }

  getCommand(name: string): ICommandDefinition | undefined {
    return this.commands.get(name.toLowerCase());
  }

  getSuggestions(input: string, cursorPosition: number): ICommandSuggestion[] {
    const suggestions: ICommandSuggestion[] = [];
    const inputLower = input.toLowerCase().trim();

    // If input starts with /, remove it for matching
    const cleanInput = inputLower.startsWith("/") ? inputLower.slice(1) : inputLower;

    if (cleanInput.length === 0) {
      // Show all commands
      for (const cmd of this.commands.values()) {
        suggestions.push({
          value: cmd.name,
          display: cmd.name,
          description: cmd.description,
          isComplete: false,
        });
      }
      return suggestions;
    }

    const parts = cleanInput.split(/\s+/);
    if (parts.length === 1) {
      // Partial command name match
      for (const cmd of this.commands.values()) {
        if (cmd.name.startsWith(parts[0])) {
          suggestions.push({
            value: cmd.name,
            display: cmd.name,
            description: cmd.description,
            isComplete: false,
          });
        }
      }
    } else {
      // Command with parameters - show parameter help
      const cmd = this.getCommand(parts[0]);
      if (cmd && cmd.parameters.length > 0) {
        const paramIndex = parts.length - 2; // Which parameter we're on
        if (paramIndex < cmd.parameters.length) {
          const param = cmd.parameters[paramIndex];
          // Show parameter hint
          suggestions.push({
            value: input,
            display: `<${param.name}>`,
            description: param.description || param.type,
            isComplete: false,
          });

          // If enum, show values
          if (param.enumValues) {
            const partialValue = parts[parts.length - 1] || "";
            for (const enumVal of param.enumValues) {
              if (enumVal.toLowerCase().startsWith(partialValue)) {
                const baseCmd = parts.slice(0, -1).join(" ");
                suggestions.push({
                  value: `${baseCmd} ${enumVal}`,
                  display: enumVal,
                  description: `${param.name} value`,
                  isComplete: false,
                });
              }
            }
          }

          // Show examples
          if (param.examples) {
            for (const example of param.examples.slice(0, 5)) {
              const baseCmd = parts.slice(0, -1).join(" ");
              suggestions.push({
                value: `${baseCmd} ${example}`,
                display: example,
                description: `Example ${param.name}`,
                isComplete: false,
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  handlesCommand(commandName: string): boolean {
    const normalizedName = commandName.toLowerCase().replace(/^\//, "");
    return this.commands.has(normalizedName);
  }

  // BDS commands are sent to the server, not executed locally
  // execute() is not implemented - commands pass through to BDS

  parseResponse(message: string, commandName: string): ICommandResponse | undefined {
    // Parse structured responses from specific commands
    const cmdLower = commandName.toLowerCase();

    // querytarget returns JSON
    if (cmdLower === "querytarget") {
      return this.parseQueryTargetResponse(message);
    }

    // listd returns player list
    if (cmdLower === "listd" || cmdLower === "list") {
      return this.parseListResponse(message);
    }

    // testfor returns match results
    if (cmdLower === "testfor") {
      return this.parseTestForResponse(message);
    }

    // Generic response
    return {
      success: !message.toLowerCase().includes("unknown command"),
      message: message,
      type: "text",
    };
  }

  private parseQueryTargetResponse(message: string): ICommandResponse | undefined {
    // querytarget returns JSON data about entities
    // Format: [{"dimension":"overworld","position":{"x":0.5,"y":64.0,"z":0.5},...}]
    try {
      const jsonMatch = message.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          message: message,
          data: data,
          type: "json",
        };
      }
    } catch {
      // Not JSON, return as text
    }

    return {
      success: true,
      message: message,
      type: "text",
    };
  }

  private parseListResponse(message: string): ICommandResponse | undefined {
    // list returns: "There are X/Y players online: player1, player2"
    const match = message.match(/There are (\d+)\/(\d+) players online:(.*)/i);
    if (match) {
      const current = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      const players = match[3]
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      return {
        success: true,
        message: message,
        data: { current, max, players },
        type: "json",
      };
    }

    return {
      success: true,
      message: message,
      type: "text",
    };
  }

  private parseTestForResponse(message: string): ICommandResponse | undefined {
    // testfor returns: "Found player1" or "No targets matched selector"
    const foundMatch = message.match(/Found (.+)/i);
    if (foundMatch) {
      return {
        success: true,
        message: message,
        data: { found: true, target: foundMatch[1] },
        type: "json",
      };
    }

    if (message.toLowerCase().includes("no targets matched")) {
      return {
        success: true,
        message: message,
        data: { found: false },
        type: "json",
      };
    }

    return {
      success: true,
      message: message,
      type: "text",
    };
  }
}

// Export singleton instance
export const bdsCommandProvider = new BdsCommandProvider();
