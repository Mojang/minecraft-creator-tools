// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToolCommand System - Unified command interface for MCT
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * ToolCommands provide a unified way to expose MCT functionality across multiple surfaces:
 * - CLI commands (via thin adapter to Commander.js)
 * - MCP tools (via auto-registration with Zod schemas)
 * - In-game edit bar (via SearchCommandEditor)
 * - Serve mode terminal (via stdin processing)
 * - Server management UI (via HTTP API)
 * - Home page command bar
 *
 * DESIGN PRINCIPLES:
 * 1. Commands exist in the same "/" namespace as Bedrock server commands
 * 2. The /help command is the only one we override from Bedrock (unified help)
 * 3. All other unrecognized commands pass through to Bedrock server
 * 4. Commands support tab-completion via autocomplete providers
 * 5. Commands use a flag syntax for optional parameters (--flag value)
 *
 * RELATIONSHIP TO CLI COMMANDS:
 * - CLI commands (ICommand in cli/core/) handle CLI-specific concerns (workers, etc.)
 * - ToolCommands use the same core libraries (ProjectItemCreateManager, etc.)
 * - CLI commands can delegate to ToolCommands for argument parsing
 * - New commands should prefer ToolCommand implementation
 *
 * RELATED FILES:
 * - IToolCommandArgument.ts: Argument/flag definitions
 * - IToolCommandContext.ts: Execution context
 * - ToolCommandRegistry.ts: Central registry
 * - ToolCommandParser.ts: Parsing and autocomplete
 * - cli/core/ToolCommandCliAdapter.ts: CLI integration
 */

import type { IToolCommandArgument, IToolCommandFlag } from "./IToolCommandArgument";
import type { IToolCommandContext } from "./IToolCommandContext";

/**
 * Scopes where a ToolCommand can be invoked.
 * By default, commands are available in all scopes.
 */
export enum ToolCommandScope {
  /** Available in web/Electron UI (SearchCommandEditor, Home page) */
  ui = "ui",

  /** Available as MCP tool */
  mcp = "mcp",

  /** Available in serve mode interactive terminal */
  serveTerminal = "serveTerminal",

  /** Available in server management HTTP API */
  serverApi = "serverApi",

  /** Available as CLI command (via adapter) */
  cli = "cli",
}

/**
 * Standard exit codes for ToolCommands.
 * These align with Unix conventions and enable intelligent error handling in CI/CD scripts.
 */
export enum ToolCommandExitCode {
  Success = 0,
  GenericError = 1,
  PortConflict = 2,
  EulaNotAccepted = 3,
  NetworkError = 4,
  CrashOnStartup = 5,
  Timeout = 6,
  InvalidArguments = 7,
  PermissionDenied = 8,
}

/**
 * Result of executing a ToolCommand.
 */
export interface IToolCommandResult {
  /** Whether the command succeeded */
  success: boolean;

  /** Human-readable result message */
  message?: string;

  /** Structured data returned by the command */
  data?: unknown;

  /** Process exit code for CLI consumers */
  exitCode?: ToolCommandExitCode;

  /** Error information if success is false */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Category for grouping commands in help output.
 */
export type ToolCommandCategory = "General" | "Project" | "Content" | "Server" | "Validation" | "World" | "Render";

/**
 * Metadata for a ToolCommand.
 * Mirrors ICommandMetadata from CLI but simplified for ToolCommand use.
 */
export interface IToolCommandMetadata {
  /** Command name (e.g., 'create', 'add', 'help') - without leading slash */
  name: string;

  /** Short description for help text */
  description: string;

  /** Command aliases (e.g., ['c'] for 'create') */
  aliases?: string[];

  /** Category for grouping in help output */
  category: ToolCommandCategory;

  /** Positional arguments for this command */
  arguments?: IToolCommandArgument[];

  /** Named flags for this command (--flag value) */
  flags?: IToolCommandFlag[];

  /** Whether this command requires a project context */
  requiresProject?: boolean;

  /** Whether this command requires an active Minecraft server connection */
  requiresMinecraft?: boolean;

  /** Whether this command modifies content (vs read-only) */
  isWriteCommand?: boolean;

  /** Scopes where this command is available (default: all) */
  scopes?: ToolCommandScope[];

  /** Example usages for help text */
  examples?: string[];
}

/**
 * IToolCommand is the interface all ToolCommands must implement.
 */
export interface IToolCommand {
  /**
   * Command metadata for registration and help.
   */
  readonly metadata: IToolCommandMetadata;

  /**
   * Execute the command with the provided context.
   *
   * @param context The execution context with project, server, and output access
   * @param args Parsed positional arguments (in order of metadata.arguments)
   * @param flags Parsed flag values (keyed by flag name without --)
   * @returns Result indicating success/failure and any return data
   */
  execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult>;

  /**
   * Get autocomplete suggestions for a partial argument.
   * Default implementation uses argument autocompleteProviders.
   *
   * @param context The execution context
   * @param args Arguments provided so far
   * @param partialArg The partial argument being typed
   * @param argIndex Index of the argument being completed
   * @returns Array of completion suggestions
   */
  getCompletions?(
    context: IToolCommandContext,
    args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]>;
}

/**
 * Base class for ToolCommands providing common functionality.
 */
export abstract class ToolCommandBase implements IToolCommand {
  abstract readonly metadata: IToolCommandMetadata;

  abstract execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult>;

  /**
   * Default completion implementation using argument autocompleteProviders.
   */
  async getCompletions(
    context: IToolCommandContext,
    args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    const argDef = this.metadata.arguments?.[argIndex];
    if (!argDef?.autocompleteProvider) {
      return [];
    }

    return argDef.autocompleteProvider(partialArg, context);
  }

  /**
   * Helper to create a success result.
   */
  protected success(message?: string, data?: unknown): IToolCommandResult {
    return { success: true, message, data };
  }

  /**
   * Helper to create an error result.
   */
  protected error(code: string, message: string, details?: unknown): IToolCommandResult {
    return {
      success: false,
      error: { code, message, details },
    };
  }

  /**
   * Helper to validate required arguments.
   */
  protected validateRequiredArgs(args: string[]): IToolCommandResult | undefined {
    const requiredArgs = this.metadata.arguments?.filter((a) => a.required) ?? [];

    for (let i = 0; i < requiredArgs.length; i++) {
      if (!args[i] || args[i].trim() === "") {
        return this.error("MISSING_ARGUMENT", `Missing required argument: ${requiredArgs[i].name}`, {
          argumentName: requiredArgs[i].name,
          argumentIndex: i,
        });
      }
    }

    return undefined;
  }
}
