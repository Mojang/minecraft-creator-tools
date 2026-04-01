/**
 * =============================================================================
 * COMMAND PROVIDER SYSTEM FOR INK CLI
 * =============================================================================
 *
 * This module defines the extensible command provider interface for the Ink CLI.
 * Command providers supply command definitions, autocomplete suggestions, and
 * response parsing for different command sources (BDS, MCT built-ins, custom).
 *
 * Architecture:
 * - ICommandProvider: Interface for command sources
 * - ICommandDefinition: Describes a command with parameters and help text
 * - ICommandParameter: Describes command parameters for autocomplete
 * - ICommandSuggestion: Autocomplete suggestion with display info
 * - ICommandResponse: Parsed response from command execution
 *
 * Providers:
 * - BdsCommandProvider: Loads BDS commands from form definitions
 * - MctCommandProvider: Built-in MCT console commands (help, status, exit)
 * - Custom providers can be added for extensions
 * =============================================================================
 */

/**
 * Represents a parameter for a command
 */
export interface ICommandParameter {
  /** Parameter name */
  name: string;
  /** Parameter description */
  description?: string;
  /** Whether this parameter is required */
  required: boolean;
  /** Parameter type (string, number, selector, enum, etc.) */
  type: string;
  /** For enum types, the allowed values */
  enumValues?: string[];
  /** Default value if not provided */
  defaultValue?: string;
  /** Example values for autocomplete hints */
  examples?: string[];
}

/**
 * Represents a command definition
 */
export interface ICommandDefinition {
  /** Command name (e.g., "give", "help") */
  name: string;
  /** Short description for help output */
  description: string;
  /** Detailed help text */
  helpText?: string;
  /** Command parameters */
  parameters: ICommandParameter[];
  /** Command aliases (e.g., ["?"]) for "help" */
  aliases?: string[];
  /** Permission level required (0=all, 1=op, 2=console) */
  permissionLevel?: number;
  /** Whether cheats must be enabled */
  requiresCheats?: boolean;
  /** Category for grouping in help (e.g., "Server", "World", "Player") */
  category?: string;
  /** Source provider name (e.g., "bds", "mct") */
  source: string;
}

/**
 * Autocomplete suggestion for command input
 */
export interface ICommandSuggestion {
  /** The text to insert */
  value: string;
  /** Display text (may include formatting) */
  display: string;
  /** Description/hint text */
  description?: string;
  /** Whether this completes the command */
  isComplete: boolean;
  /** Cursor position after insertion */
  cursorOffset?: number;
}

/**
 * Parsed response from command execution
 */
export interface ICommandResponse {
  /** Whether the command succeeded */
  success: boolean;
  /** Response message */
  message: string;
  /** Structured data (for JSON responses like querytarget) */
  data?: any;
  /** Response type for specialized rendering */
  type: "text" | "json" | "table" | "error" | "help";
}

/**
 * Command provider interface - sources provide commands and handle responses
 */
export interface ICommandProvider {
  /** Provider name (e.g., "bds", "mct") */
  readonly name: string;

  /** Provider display name */
  readonly displayName: string;

  /** Priority for command resolution (higher = checked first) */
  readonly priority: number;

  /**
   * Initialize the provider (load command definitions, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Get all commands from this provider
   */
  getCommands(): ICommandDefinition[];

  /**
   * Get a specific command by name
   */
  getCommand(name: string): ICommandDefinition | undefined;

  /**
   * Get autocomplete suggestions for partial input
   * @param input Current input text
   * @param cursorPosition Cursor position in input
   */
  getSuggestions(input: string, cursorPosition: number): ICommandSuggestion[];

  /**
   * Check if this provider handles the given command
   * @param commandName Command name to check
   */
  handlesCommand(commandName: string): boolean;

  /**
   * Execute a command (for local commands like MCT built-ins)
   * Returns undefined if the command should be passed to BDS
   * @param input Full command input
   * @param context Execution context
   */
  execute?(input: string, context: ICommandContext): Promise<ICommandResponse | undefined>;

  /**
   * Parse a response message from command execution
   * @param message Raw response message
   * @param commandName The command that was executed
   */
  parseResponse?(message: string, commandName: string): ICommandResponse | undefined;
}

/**
 * Context for command execution
 */
export interface ICommandContext {
  /** Send command to BDS */
  sendToBds: (command: string) => void;
  /** Request application exit */
  requestExit: () => void;
  /** Get current server status */
  getServerStatus: () => IServerStatus;
  /** Get connected players */
  getPlayers: () => IPlayerInfo[];
  /** Clear log display */
  clearLog: () => void;
  /** Set a text search filter for log display (undefined to clear) */
  setSearchFilter?: (pattern: string | undefined) => void;
  /** Get all registered command providers */
  getProviders: () => ICommandProvider[];
  /** CreatorTools instance, if available */
  creatorTools?: any;
  /** ServerManager instance, if available */
  serverManager?: any;
  /** Get current log entries for export */
  getLogs?: () => Array<{ timestamp: Date; message: string; category: number }>;
  /** Export logs to a file, returns entry count */
  exportLogs?: (filePath: string) => number;
}

/**
 * Server status information
 */
export interface IServerStatus {
  /** Server state */
  state: "starting" | "running" | "stopping" | "stopped";
  /** Server version */
  version?: string;
  /** Uptime in seconds */
  uptimeSeconds?: number;
  /** Number of connected players */
  playerCount: number;
  /** Maximum players */
  maxPlayers?: number;
  /** Server port */
  port?: number;
  /** World name */
  worldName?: string;
}

/**
 * Player information
 */
export interface IPlayerInfo {
  /** Player name */
  name: string;
  /** Player XUID */
  xuid?: string;
  /** Connection time */
  connectedAt?: Date;
}

/**
 * Registry for managing multiple command providers
 */
export class CommandProviderRegistry {
  private providers: ICommandProvider[] = [];
  private initialized = false;

  /**
   * Register a command provider
   */
  register(provider: ICommandProvider): void {
    this.providers.push(provider);
    // Sort by priority (descending)
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Initialize all providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all(this.providers.map((p) => p.initialize()));
    this.initialized = true;
  }

  /**
   * Get all registered providers
   */
  getProviders(): ICommandProvider[] {
    return [...this.providers];
  }

  /**
   * Get all commands from all providers
   */
  getAllCommands(): ICommandDefinition[] {
    const commands: ICommandDefinition[] = [];
    for (const provider of this.providers) {
      commands.push(...provider.getCommands());
    }
    return commands;
  }

  /**
   * Get a command by name (checks all providers in priority order)
   */
  getCommand(name: string): ICommandDefinition | undefined {
    for (const provider of this.providers) {
      const cmd = provider.getCommand(name);
      if (cmd) return cmd;
    }
    return undefined;
  }

  /**
   * Get autocomplete suggestions from all providers
   */
  getSuggestions(input: string, cursorPosition: number): ICommandSuggestion[] {
    const suggestions: ICommandSuggestion[] = [];
    for (const provider of this.providers) {
      suggestions.push(...provider.getSuggestions(input, cursorPosition));
    }
    return suggestions;
  }

  /**
   * Find a provider that handles the given command
   */
  findHandler(commandName: string): ICommandProvider | undefined {
    return this.providers.find((p) => p.handlesCommand(commandName));
  }

  /**
   * Execute a command (tries local providers first, then BDS)
   */
  async execute(input: string, context: ICommandContext): Promise<ICommandResponse | undefined> {
    const commandName = input.trim().split(/\s+/)[0]?.toLowerCase() || "";

    for (const provider of this.providers) {
      if (provider.handlesCommand(commandName) && provider.execute) {
        const response = await provider.execute(input, context);
        if (response) return response;
      }
    }

    return undefined;
  }

  /**
   * Parse a response using the appropriate provider
   */
  parseResponse(message: string, commandName: string): ICommandResponse | undefined {
    for (const provider of this.providers) {
      if (provider.parseResponse) {
        const response = provider.parseResponse(message, commandName);
        if (response) return response;
      }
    }
    return undefined;
  }
}

// Global registry instance
export const commandProviderRegistry = new CommandProviderRegistry();
