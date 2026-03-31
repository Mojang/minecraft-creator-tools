// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type Project from "../Project";
import type CreatorTools from "../CreatorTools";
import type IMinecraft from "../IMinecraft";
import type ServerManager from "../../local/ServerManager";
import Log from "../../core/Log";

/**
 * Session context for ToolCommands that interact with Minecraft servers.
 * Maps to the MCP concept of "session" for managing server instances.
 */
export interface IToolCommandSession {
  /**
   * Session name - identifies this server instance.
   * In MCP context, this is the sessionName parameter.
   */
  sessionName: string;

  /**
   * The ServerManager that owns this session.
   */
  serverManager?: ServerManager;

  /**
   * The slot ID where this server is running.
   */
  slot?: number;
}

/**
 * Output writer for ToolCommand messages.
 * Abstraction that works across different surfaces (terminal, UI, etc.)
 */
export interface IToolCommandOutput {
  /** Write an informational message */
  info(message: string): void;

  /** Write a success message */
  success(message: string): void;

  /** Write a warning message */
  warn(message: string): void;

  /** Write an error message */
  error(message: string): void;

  /** Write a debug/verbose message */
  debug(message: string): void;

  /** Update progress (for long-running operations) */
  progress(current: number, total: number, message?: string): void;
}

/**
 * Execution context for ToolCommands.
 *
 * Provides access to:
 * - Optional project context
 * - Optional Minecraft server connection
 * - CreatorTools instance for gallery, preferences, etc.
 * - Output writer for command feedback
 */
export interface IToolCommandContext {
  /**
   * The CreatorTools instance.
   * Provides gallery, preferences, storage, etc.
   * May be undefined in contexts where CreatorTools is not available (e.g., serve terminal).
   */
  creatorTools?: CreatorTools;

  /**
   * The active project, if one is loaded.
   * Undefined when running commands from Home page or without project context.
   */
  project?: Project;

  /**
   * Active Minecraft server connection, if available.
   * Used for commands that interact with Bedrock Dedicated Server.
   */
  minecraft?: IMinecraft;

  /**
   * Session context for server-based commands.
   * Provides access to the server manager and session info.
   */
  session?: IToolCommandSession;

  /**
   * Output writer for command messages.
   */
  output: IToolCommandOutput;

  /**
   * The scope from which this command was invoked.
   */
  scope: "ui" | "mcp" | "serveTerminal" | "serverApi" | "cli";

  /**
   * Whether verbose/debug output is enabled.
   */
  verbose?: boolean;

  /**
   * Intermediate output messages collected during command execution.
   * Used by command providers to capture output for the response.
   */
  messages?: string[];
}

/**
 * Factory to create ToolCommandContext from various sources.
 */
export class ToolCommandContextFactory {
  /**
   * Create a minimal context for commands that don't need a project.
   */
  static createMinimal(creatorTools: CreatorTools, output: IToolCommandOutput): IToolCommandContext {
    return {
      creatorTools,
      output,
      scope: "ui",
    };
  }

  /**
   * Create a context with a project.
   */
  static createWithProject(
    creatorTools: CreatorTools,
    project: Project,
    output: IToolCommandOutput
  ): IToolCommandContext {
    return {
      creatorTools,
      project,
      output,
      scope: "ui",
    };
  }

  /**
   * Create a context for serve mode with Minecraft connection.
   */
  static createServeContext(
    creatorTools: CreatorTools,
    project: Project | undefined,
    minecraft: IMinecraft | undefined,
    output: IToolCommandOutput
  ): IToolCommandContext {
    return {
      creatorTools,
      project,
      minecraft,
      output,
      scope: "serveTerminal",
    };
  }

  /**
   * Create a context for MCP or HTTP API with session support.
   */
  static createSessionContext(
    creatorTools: CreatorTools,
    session: IToolCommandSession,
    minecraft: IMinecraft | undefined,
    output: IToolCommandOutput,
    scope: "mcp" | "serverApi"
  ): IToolCommandContext {
    return {
      creatorTools,
      session,
      minecraft,
      output,
      scope,
    };
  }

  /**
   * Create a context with a ServerManager for BDS lifecycle operations.
   * Used when the caller has a ServerManager (e.g., Electron app, serve mode, tests).
   */
  static createWithServer(
    creatorTools: CreatorTools,
    serverManager: ServerManager,
    output: IToolCommandOutput,
    scope: "ui" | "serveTerminal" | "mcp" | "serverApi" | "cli" = "ui",
    options?: {
      project?: Project;
      sessionName?: string;
      slot?: number;
    }
  ): IToolCommandContext {
    return {
      creatorTools,
      project: options?.project,
      session: {
        sessionName: options?.sessionName || "default",
        serverManager,
        slot: options?.slot ?? 0,
      },
      output,
      scope,
    };
  }

  /**
   * Create a console-based output writer for terminal use.
   */
  static createConsoleOutput(): IToolCommandOutput {
    return {
      info: (msg) => Log.message(msg),
      success: (msg) => Log.message(`✓ ${msg}`),
      warn: (msg) => Log.debug(`⚠ ${msg}`),
      error: (msg) => Log.error(msg),
      debug: (msg) => Log.verbose(`  ${msg}`),
      progress: (current, total, msg) => {
        const pct = Math.round((current / total) * 100);
        Log.message(`[${pct}%] ${msg || ""}`);
      },
    };
  }
}
