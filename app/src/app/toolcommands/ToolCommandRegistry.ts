// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToolCommandRegistry - Central registry for all ToolCommands
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This registry is the central hub for ToolCommand management:
 *
 * RESPONSIBILITIES:
 * 1. Hold all registered IToolCommand instances
 * 2. Provide lookup by command name or alias
 * 3. Execute commands with parsed arguments
 * 4. Provide autocomplete suggestions
 * 5. Filter commands by scope
 * 6. Generate help documentation
 *
 * SINGLETON PATTERN:
 * Use ToolCommandRegistry.instance to access the global registry.
 * Commands are registered at module load time.
 *
 * RELATED FILES:
 * - IToolCommand.ts: Command interface
 * - IToolCommandContext.ts: Execution context
 * - ToolCommandParser.ts: Command line parsing
 * - commands/: Individual command implementations
 */

import type { IToolCommand, IToolCommandResult } from "./IToolCommand";
import { ToolCommandScope } from "./IToolCommand";
import type { IToolCommandContext } from "./IToolCommandContext";
import { ToolCommandParser } from "./ToolCommandParser";

/**
 * Central registry for ToolCommands.
 */
export class ToolCommandRegistry {
  private static _instance: ToolCommandRegistry | undefined;

  private commands: Map<string, IToolCommand> = new Map();

  /**
   * Get the singleton instance.
   */
  static get instance(): ToolCommandRegistry {
    if (!this._instance) {
      this._instance = new ToolCommandRegistry();
    }
    return this._instance;
  }

  /**
   * Register a ToolCommand.
   * @param command The command to register
   */
  register(command: IToolCommand): void {
    const { name, aliases } = command.metadata;

    // Register by name (lowercase for case-insensitive lookup)
    const lowerName = name.toLowerCase();
    if (this.commands.has(lowerName)) {
      throw new Error(`ToolCommand '${name}' is already registered`);
    }
    this.commands.set(lowerName, command);

    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase();
        if (this.commands.has(lowerAlias)) {
          throw new Error(`ToolCommand alias '${alias}' conflicts with existing command`);
        }
        this.commands.set(lowerAlias, command);
      }
    }
  }

  /**
   * Register multiple commands.
   */
  registerAll(commands: IToolCommand[]): void {
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (!command) {
        throw new Error(`ToolCommand at index ${i} is undefined or null (out of ${commands.length} commands)`);
      }
      this.register(command);
    }
  }

  /**
   * Get a command by name or alias.
   * @param name Command name or alias (case-insensitive)
   */
  get(name: string): IToolCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Check if a command exists.
   */
  has(name: string): boolean {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Get all unique commands (excluding alias duplicates).
   * Optionally filter by scope.
   */
  getAll(scope?: ToolCommandScope): IToolCommand[] {
    const seen = new Set<IToolCommand>();
    const result: IToolCommand[] = [];

    for (const command of this.commands.values()) {
      if (seen.has(command)) continue;
      seen.add(command);

      // Filter by scope if specified
      if (scope) {
        const scopes = command.metadata.scopes;
        // If no scopes defined, command is available everywhere
        if (scopes && !scopes.includes(scope)) {
          continue;
        }
      }

      result.push(command);
    }

    // Sort by category then name
    result.sort((a, b) => {
      const catCmp = a.metadata.category.localeCompare(b.metadata.category);
      if (catCmp !== 0) return catCmp;
      return a.metadata.name.localeCompare(b.metadata.name);
    });

    return result;
  }

  /**
   * Get all command names (for autocomplete).
   */
  getCommandNames(scope?: ToolCommandScope): string[] {
    return this.getAll(scope).map((c) => c.metadata.name);
  }

  /**
   * Execute a command from a command string.
   * @param commandText Full command text (e.g., "/create template myproject --traits mob")
   * @param context Execution context
   * @returns Command result, or undefined if command not found
   */
  async execute(commandText: string, context: IToolCommandContext): Promise<IToolCommandResult | undefined> {
    const parsed = ToolCommandParser.parse(commandText);

    if (!parsed) {
      return undefined;
    }

    return this.executeCommand(parsed.commandName, parsed.args, parsed.flags, context);
  }

  /**
   * Execute a command with pre-parsed arguments.
   */
  async executeCommand(
    name: string,
    args: string[],
    flags: Record<string, string | boolean | string[]>,
    context: IToolCommandContext
  ): Promise<IToolCommandResult | undefined> {
    const command = this.get(name);

    if (!command) {
      return undefined;
    }

    // Check scope restrictions
    const scopes = command.metadata.scopes;
    if (scopes && !scopes.includes(context.scope as ToolCommandScope)) {
      return {
        success: false,
        error: {
          code: "SCOPE_RESTRICTED",
          message: `Command '${name}' is not available in ${context.scope} context`,
        },
      };
    }

    // Check project requirement
    if (command.metadata.requiresProject && !context.project) {
      return {
        success: false,
        error: {
          code: "PROJECT_REQUIRED",
          message: `Command '${name}' requires an active project`,
        },
      };
    }

    // Check Minecraft requirement
    if (command.metadata.requiresMinecraft && !context.minecraft) {
      return {
        success: false,
        error: {
          code: "MINECRAFT_REQUIRED",
          message: `Command '${name}' requires an active Minecraft server connection`,
        },
      };
    }

    try {
      return await command.execute(context, args, flags);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: `Error executing '${name}': ${message}`,
        },
      };
    }
  }

  /**
   * Get autocomplete suggestions for a partial command.
   * @param text The partial command text being typed
   * @param cursorPos The cursor position in the text
   * @param context Execution context
   */
  async getCompletions(text: string, cursorPos: number, context: IToolCommandContext): Promise<string[]> {
    return ToolCommandParser.getCompletions(text, cursorPos, this, context);
  }

  /**
   * Clear all registered commands (for testing).
   */
  clear(): void {
    this.commands.clear();
  }
}
