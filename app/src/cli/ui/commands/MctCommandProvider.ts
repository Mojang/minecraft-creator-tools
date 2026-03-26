/**
 * =============================================================================
 * MCT COMMAND PROVIDER - Built-in Console Commands
 * =============================================================================
 *
 * Provides built-in commands for the MCT interactive console:
 * - help: Show available commands
 * - status: Show server status
 * - exit/quit/stop: Shutdown the server
 * - players: List connected players
 * - clear: Clear the log display
 * - version: Show MCT version
 *
 * These commands are handled locally and don't require BDS.
 * =============================================================================
 */

import { constants } from "../../../core/Constants";
import { DedicatedServerStatus } from "../../../local/DedicatedServer";
import {
  ICommandProvider,
  ICommandDefinition,
  ICommandSuggestion,
  ICommandResponse,
  ICommandContext,
} from "./ICommandProvider";

export class MctCommandProvider implements ICommandProvider {
  readonly name = "mct";
  readonly displayName = "MCT Console";
  readonly priority = 100; // High priority - check before BDS

  private commands: Map<string, ICommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    this.registerBuiltinCommands();
  }

  private registerBuiltinCommands(): void {
    // Help command
    this.registerCommand({
      name: "help",
      description: "Show available commands",
      helpText: "Usage: help [command]\n\nShows help for all commands or a specific command.",
      parameters: [
        {
          name: "command",
          description: "Command to get help for",
          required: false,
          type: "string",
        },
      ],
      aliases: ["?", "commands"],
      category: "Console",
      source: "mct",
    });

    // Status command
    this.registerCommand({
      name: "status",
      description: "Show server status",
      helpText: "Shows current server status including state, uptime, players, and version.",
      parameters: [],
      aliases: ["info", "server"],
      category: "Console",
      source: "mct",
    });

    // Exit command
    this.registerCommand({
      name: "exit",
      description: "Shutdown the server and exit",
      helpText: "Gracefully stops the Bedrock Dedicated Server and exits MCT.",
      parameters: [],
      aliases: ["quit", "stop", "shutdown"],
      category: "Console",
      source: "mct",
    });

    // Players command
    this.registerCommand({
      name: "players",
      description: "List connected players",
      helpText: "Shows all currently connected players with their connection info.",
      parameters: [],
      aliases: ["who", "online"],
      category: "Console",
      source: "mct",
    });

    // Clear command
    this.registerCommand({
      name: "clear",
      description: "Clear the log display",
      helpText: "Clears the console log output.",
      parameters: [],
      aliases: ["cls"],
      category: "Console",
      source: "mct",
    });

    // Version command
    this.registerCommand({
      name: "version",
      description: "Show MCT version",
      helpText: "Displays the current Minecraft Creator Tools version.",
      parameters: [],
      aliases: ["ver", "about"],
      category: "Console",
      source: "mct",
    });

    // Search command
    this.registerCommand({
      name: "search",
      description: "Filter logs by search term",
      helpText: "Usage: search <pattern>\n\nFilters the log display to show lines matching the pattern.\nUse 'search' with no argument to clear the filter.\n\nSearch modes:\n  search hello      Case-insensitive substring match\n  search /pattern/i  Regex match (use /pattern/flags syntax)",
      parameters: [
        {
          name: "pattern",
          description: "Text to search for (case-insensitive)",
          required: false,
          type: "string",
        },
      ],
      aliases: ["grep", "find", "filter"],
      category: "Console",
      source: "mct",
    });

    // Logs command
    this.registerCommand({
      name: "logs",
      description: "Export log buffer to a file",
      helpText: "Usage: logs save <path>\n\nExports the current log buffer to a text file.\nDefault path: ./mct-serve.log",
      parameters: [
        {
          name: "action",
          description: "'save' to export logs",
          required: false,
          type: "string",
        },
        {
          name: "path",
          description: "File path for export",
          required: false,
          type: "string",
        },
      ],
      aliases: ["dump", "export-log"],
      category: "Console",
      source: "mct",
    });

    // Restart command
    this.registerCommand({
      name: "restart",
      description: "Restart the Bedrock Dedicated Server",
      helpText: "Gracefully stops the BDS server, then starts it again.\nContent changes are reloaded on restart.",
      parameters: [],
      aliases: ["reboot"],
      category: "Console",
      source: "mct",
    });
  }

  private registerCommand(cmd: ICommandDefinition): void {
    this.commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliases.set(alias, cmd.name);
      }
    }
  }

  getCommands(): ICommandDefinition[] {
    return Array.from(this.commands.values());
  }

  getCommand(name: string): ICommandDefinition | undefined {
    const normalizedName = name.toLowerCase();
    // Check direct match
    if (this.commands.has(normalizedName)) {
      return this.commands.get(normalizedName);
    }
    // Check aliases
    const aliasTarget = this.aliases.get(normalizedName);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }
    return undefined;
  }

  getSuggestions(input: string, cursorPosition: number): ICommandSuggestion[] {
    const suggestions: ICommandSuggestion[] = [];
    const inputLower = input.toLowerCase().trim();

    // If empty or at start, suggest all commands
    if (inputLower.length === 0) {
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

    // Partial command match
    const parts = inputLower.split(/\s+/);
    if (parts.length === 1) {
      // Matching command name
      for (const cmd of this.commands.values()) {
        if (cmd.name.startsWith(parts[0])) {
          suggestions.push({
            value: cmd.name,
            display: cmd.name,
            description: cmd.description,
            isComplete: cmd.parameters.length === 0,
          });
        }
        // Also check aliases
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            if (alias.startsWith(parts[0]) && alias !== cmd.name) {
              suggestions.push({
                value: alias,
                display: `${alias} (→ ${cmd.name})`,
                description: cmd.description,
                isComplete: cmd.parameters.length === 0,
              });
            }
          }
        }
      }
    } else {
      // Command with parameters - suggest parameter help
      const cmd = this.getCommand(parts[0]);
      if (cmd && parts.length === 2) {
        // help <command> - suggest command names
        if (cmd.name === "help") {
          const partialCmd = parts[1] || "";
          for (const c of this.commands.values()) {
            if (c.name.startsWith(partialCmd)) {
              suggestions.push({
                value: `help ${c.name}`,
                display: c.name,
                description: c.description,
                isComplete: true,
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  handlesCommand(commandName: string): boolean {
    return this.getCommand(commandName) !== undefined;
  }

  async execute(input: string, context: ICommandContext): Promise<ICommandResponse | undefined> {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);

    const cmd = this.getCommand(commandName);
    if (!cmd) {
      return undefined;
    }

    switch (cmd.name) {
      case "help":
        return this.executeHelp(args, context);

      case "status":
        return this.executeStatus(context);

      case "exit":
        return this.executeExit(context);

      case "players":
        return this.executePlayers(context);

      case "clear":
        return this.executeClear(context);

      case "version":
        return this.executeVersion();

      case "search":
        return this.executeSearch(args, context);

      case "restart":
        return this.executeRestart(context);

      case "logs":
        return this.executeLogs(args, context);

      default:
        return undefined;
    }
  }

  private executeHelp(args: string[], context: ICommandContext): ICommandResponse {
    if (args.length > 0) {
      // Help for specific command
      const cmdName = args[0].toLowerCase();

      // Check all providers
      for (const provider of context.getProviders()) {
        const cmd = provider.getCommand(cmdName);
        if (cmd) {
          let helpText = `${cmd.name} - ${cmd.description}\n`;
          if (cmd.helpText) {
            helpText += `\n${cmd.helpText}\n`;
          }
          if (cmd.parameters.length > 0) {
            helpText += "\nParameters:\n";
            for (const param of cmd.parameters) {
              const reqText = param.required ? "(required)" : "(optional)";
              helpText += `  ${param.name} ${reqText}: ${param.description || param.type}\n`;
              if (param.examples && param.examples.length > 0) {
                helpText += `    Examples: ${param.examples.join(", ")}\n`;
              }
            }
          }
          if (cmd.aliases && cmd.aliases.length > 0) {
            helpText += `\nAliases: ${cmd.aliases.join(", ")}\n`;
          }
          return {
            success: true,
            message: helpText,
            type: "help",
          };
        }
      }

      return {
        success: false,
        message: `Unknown command: ${cmdName}. Type 'help' for a list of commands.`,
        type: "error",
      };
    }

    // General help - list all commands by category
    const allCommands: ICommandDefinition[] = [];
    for (const provider of context.getProviders()) {
      allCommands.push(...provider.getCommands());
    }

    // Group by category
    const categories = new Map<string, ICommandDefinition[]>();
    for (const cmd of allCommands) {
      const category = cmd.category || "Other";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(cmd);
    }

    let helpText = "Minecraft Creator Tools - Console Commands\n\n";
    helpText += "Type 'help <command>' for detailed help on a specific command.\n\n";

    // Sort categories, with Console first
    const sortedCategories = Array.from(categories.keys()).sort((a, b) => {
      if (a === "Console") return -1;
      if (b === "Console") return 1;
      return a.localeCompare(b);
    });

    for (const category of sortedCategories) {
      const cmds = categories.get(category)!;
      helpText += `${category}:\n`;
      for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
        const aliasText = cmd.aliases && cmd.aliases.length > 0 ? ` (${cmd.aliases.join(", ")})` : "";
        helpText += `  ${cmd.name}${aliasText} - ${cmd.description}\n`;
      }
      helpText += "\n";
    }

    helpText += "Keyboard Shortcuts:\n";
    helpText += "  Ctrl+C        Exit\n";
    helpText += "  Ctrl+L        Clear logs\n";
    helpText += "  Ctrl+1-5      Log filter (all/errors/players/tests/server)\n";
    helpText += "  Tab           Accept autocomplete suggestion\n";
    helpText += "  Up/Down       Navigate suggestions or history\n";
    helpText += "  Escape        Hide suggestions or clear input\n";

    return {
      success: true,
      message: helpText,
      type: "help",
    };
  }

  private executeStatus(context: ICommandContext): ICommandResponse {
    const status = context.getServerStatus();

    let statusText = "Server Status\n\n";

    statusText += `  State: ${status.state}\n`;

    if (status.version) {
      statusText += `  Version: ${status.version}\n`;
    }

    if (status.worldName) {
      statusText += `  World: ${status.worldName}\n`;
    }

    if (status.port) {
      statusText += `  Port: ${status.port}\n`;
    }

    statusText += `  Players: ${status.playerCount}`;
    if (status.maxPlayers) {
      statusText += `/${status.maxPlayers}`;
    }
    statusText += "\n";

    if (status.uptimeSeconds !== undefined) {
      const uptime = this.formatUptime(status.uptimeSeconds);
      statusText += `  Uptime: ${uptime}\n`;
    }

    return {
      success: true,
      message: statusText,
      type: "text",
    };
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  private executeExit(context: ICommandContext): ICommandResponse {
    context.requestExit();
    return {
      success: true,
      message: "Shutting down...",
      type: "text",
    };
  }

  private executePlayers(context: ICommandContext): ICommandResponse {
    const players = context.getPlayers();

    if (players.length === 0) {
      return {
        success: true,
        message: "No players connected.",
        type: "text",
      };
    }

    let text = `Connected Players (${players.length})\n\n`;
    for (const player of players) {
      text += `  ${player.name}`;
      if (player.xuid) {
        text += ` (${player.xuid})`;
      }
      if (player.connectedAt) {
        const duration = Math.floor((Date.now() - player.connectedAt.getTime()) / 1000);
        text += ` - connected ${this.formatUptime(duration)}`;
      }
      text += "\n";
    }

    return {
      success: true,
      message: text,
      type: "text",
    };
  }

  private executeSearch(args: string[], context: ICommandContext): ICommandResponse {
    if (args.length === 0) {
      if (context.setSearchFilter) {
        context.setSearchFilter(undefined);
      }
      return {
        success: true,
        message: "Search filter cleared. Showing all logs.",
        type: "text",
      };
    }

    const pattern = args.join(" ");
    if (context.setSearchFilter) {
      context.setSearchFilter(pattern);
    }
    return {
      success: true,
      message: `Filtering logs for: "${pattern}" (use 'search' to clear)`,
      type: "text",
    };
  }

  private executeClear(context: ICommandContext): ICommandResponse {
    context.clearLog();
    return {
      success: true,
      message: "",
      type: "text",
    };
  }

  private async executeRestart(context: ICommandContext): Promise<ICommandResponse> {
    const sm = context.serverManager;
    if (!sm) {
      return {
        success: false,
        message: "No server manager available.",
        type: "error",
      };
    }

    const server = sm.primaryActiveServer;
    if (!server) {
      return {
        success: false,
        message: "No active server to restart.",
        type: "error",
      };
    }

    // Stop the server
    try {
      await server.stopServer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: "Failed to stop server: " + msg,
        type: "error",
      };
    }

    // Wait for server to fully stop (poll every 200ms, up to 10 seconds)
    const maxWaitMs = 10000;
    const pollIntervalMs = 200;
    let waited = 0;
    while (waited < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      waited += pollIntervalMs;
      // Check if the server process has exited
      const currentServer = sm.primaryActiveServer;
      if (!currentServer || currentServer.status === DedicatedServerStatus.stopped) {
        break;
      }
    }

    // Restart
    try {
      await server.startServer(false, {});
      return {
        success: true,
        message: "Server restarting... (world and configuration preserved)",
        type: "text",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: "Failed to restart server: " + msg,
        type: "error",
      };
    }
  }

  private executeLogs(args: string[], context: ICommandContext): ICommandResponse {
    if (args.length === 0 || args[0] !== "save") {
      return {
        success: true,
        message: "Usage: logs save [path]\n  Exports the log buffer to a file.\n  Default: ./mct-serve.log",
        type: "help",
      };
    }

    const filePath = args[1] || "mct-serve.log";

    // Use exportLogs from context (handles file I/O in the Node.js layer)
    if (context.exportLogs) {
      try {
        const count = context.exportLogs(filePath);
        const truncated = count >= 2000;
        return {
          success: true,
          message: truncated
            ? `Exported ${count} log entries to ${filePath} (buffer full — oldest entries may have been evicted)`
            : `Exported ${count} log entries to ${filePath}`,
          type: "text",
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          message: `Failed to export logs: ${msg}`,
          type: "error",
        };
      }
    }

    return {
      success: false,
      message: "Log export not available in this context.",
      type: "error",
    };
  }

  private executeVersion(): ICommandResponse {
    return {
      success: true,
      message: `Minecraft Creator Tools v${constants.version}`,
      type: "text",
    };
  }
}

// Export singleton instance
export const mctCommandProvider = new MctCommandProvider();
