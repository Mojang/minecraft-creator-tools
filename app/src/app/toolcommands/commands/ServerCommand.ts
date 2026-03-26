// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ServerCommand - Manage Bedrock Dedicated Server lifecycle
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Provides subcommands for starting, stopping, and querying the status of
 * a Bedrock Dedicated Server (BDS) instance via the MCT ToolCommand system.
 *
 * WORKFLOW:
 *   /server start              → Starts BDS with default settings
 *   /server start --project .  → Starts BDS and deploys the current project
 *   /server start --slot 1     → Starts on a specific slot (port offset)
 *   /server stop               → Stops the running BDS instance
 *   /server status             → Reports current BDS status
 *
 * INFRASTRUCTURE:
 * - Uses ServerManager.ensureActiveServer() to orchestrate BDS lifecycle
 * - ServerManager handles downloading BDS, provisioning slot folders,
 *   deploying the creator_tools_ingame addon, and managing the process
 * - Each slot maps to a port via getBasePortForSlot (19132 + slot * 32)
 * - The creator_tools_ingame addon is always deployed, providing action set
 *   execution and scripting infrastructure inside the running server
 *
 * RELATED FILES:
 * - src/local/ServerManager.ts — BDS download, provisioning, and lifecycle
 * - src/local/DedicatedServer.ts — Single BDS process management
 * - src/local/ServerMinecraft.ts — IMinecraft wrapper for DedicatedServer
 * - src/app/toolcommands/commands/ScriptCommand.ts — Injects code into running BDS
 * - src/app/IMinecraftStartMessage.ts — Start configuration
 *
 * SCOPES:
 * - ui: Electron app, where DedicatedServerCommandHandler manages BDS
 * - serveTerminal: `mct serve` mode with direct ServerManager access
 * - mcp: MCP server sessions with serverManager in context
 * - serverApi: HTTP API endpoints
 *
 * SLOT SYSTEM:
 * ServerManager supports multiple concurrent BDS instances via slots (0-79).
 * Each slot gets its own port range and runtime folder. Typical prefixes:
 * - "mcp" for MCP sessions
 * - "serve" for serve mode
 * - "vscode" for VS Code extension
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase, ToolCommandScope, ToolCommandExitCode } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import type { IMinecraftStartMessage } from "../../IMinecraftStartMessage";
import type { IWorldSettings, IPackageReference } from "../../../minecraft/IWorldSettings";

/**
 * DedicatedServerStatus.started value. Imported dynamically along with other
 * server dependencies to avoid pulling in the full DedicatedServer module
 * (which has heavy transitive dependencies) at module initialization time.
 */

// These value imports are lazy-loaded at runtime to avoid pulling in heavy
// module dependency chains (WorldLevelDat → NbtBinary → FileBase, etc.)
// at module initialization time — which causes issues in test runners.
async function getServerDependencies() {
  const [
    { DedicatedServerMode },
    { GameType, Generator, Difficulty, PlayerPermissionsLevel },
    PackageModule,
    { DedicatedServerStatus },
  ] = await Promise.all([
    import("../../ICreatorToolsData"),
    import("../../../minecraft/WorldLevelDat"),
    import("../../Package"),
    import("../../../local/DedicatedServer"),
  ]);
  return {
    DedicatedServerMode,
    GameType,
    Generator,
    Difficulty,
    PlayerPermissionsLevel,
    Package: PackageModule.default,
    DedicatedServerStatus,
  };
}

export class ServerCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "server",
    description: "Manage Bedrock Dedicated Server (start, stop, status)",
    aliases: ["srv", "bds"],
    category: "Server",
    arguments: [
      {
        name: "action",
        description: "Action to perform: start, stop, or status",
        type: "string",
        required: true,
        autocompleteProvider: async (partial: string, _context) => {
          const actions = ["start", "stop", "status"];
          if (!partial) return actions;
          return actions.filter((a) => a.startsWith(partial.toLowerCase()));
        },
      },
    ],
    flags: [
      {
        name: "slot",
        shortName: "l",
        description: "Server slot number (default: 0). Each slot runs on a separate port.",
        type: "string",
        required: false,
      },
      {
        name: "project",
        shortName: "p",
        description: "Path to project to deploy (default: current project if available)",
        type: "string",
        required: false,
      },
      {
        name: "session",
        shortName: "s",
        description: "Session name (required for MCP/API scope)",
        type: "string",
        required: false,
      },
      {
        name: "fresh",
        shortName: "f",
        description: "Force a fresh world (discard existing world data)",
        type: "boolean",
        required: false,
      },
      {
        name: "json",
        shortName: "j",
        description: "Output results in JSON format for scripts and CI/CD pipelines",
        type: "boolean",
        required: false,
      },
      {
        name: "wait-ready",
        shortName: "w",
        description: "Wait for server to be fully ready before returning",
        type: "boolean",
        required: false,
      },
      {
        name: "timeout",
        shortName: "t",
        description: "Timeout in seconds for --wait-ready (default: 60)",
        type: "string",
        required: false,
      },
      {
        name: "editor",
        shortName: "e",
        description: "Launch BDS in Minecraft Editor mode",
        type: "boolean",
        required: false,
      },
    ],
    scopes: [ToolCommandScope.ui, ToolCommandScope.serveTerminal, ToolCommandScope.mcp, ToolCommandScope.serverApi],
    examples: [
      "/server start",
      "/server start --project ./myAddon",
      "/server start --slot 1 --fresh",
      "/server start --wait-ready --timeout 120",
      "/server start --editor",
      "/server start --json",
      "/server stop",
      "/server status",
      "/server status --json",
    ],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const action = (args[0] || "").toLowerCase();
    const slot = parseInt(flags.slot as string, 10) || 0;

    if (!action || !["start", "stop", "status"].includes(action)) {
      return this.error("INVALID_ACTION", 'Invalid action. Use "start", "stop", or "status".');
    }

    let result: IToolCommandResult;

    switch (action) {
      case "start":
        result = await this._startServer(context, slot, flags);
        break;
      case "stop":
        result = await this._stopServer(context, slot, flags);
        break;
      case "status":
        result = await this._getStatus(context, slot, flags);
        break;
      default:
        result = this.error("INVALID_ACTION", `Unknown action: ${action}`);
        break;
    }

    if (flags.json === true) {
      const jsonOutput = result.success
        ? { ...(result.data as Record<string, unknown>), message: result.message }
        : { status: "error", code: result.error?.code, message: result.error?.message };
      context.output.info(JSON.stringify(jsonOutput));
    }

    return result;
  }

  private async _startServer(
    context: IToolCommandContext,
    slot: number,
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const serverManager = this._getServerManager(context);
    if (!serverManager) {
      return this.error(
        "NO_SERVER_MANAGER",
        "No ServerManager available. This command requires a serve-mode or Electron context with BDS support."
      );
    }

    context.output.info("Preparing Bedrock Dedicated Server...");

    try {
      // Prepare ServerManager (downloads BDS if needed)
      await serverManager.prepare();

      // Lazy-load heavy dependencies to avoid circular import issues at module init time
      const deps = await getServerDependencies();

      // Build world settings with creator tools infrastructure addon
      const packRefs: IPackageReference[] = [];
      deps.Package.ensureMinecraftCreatorToolsPackageReference(packRefs);

      const worldSettings: IWorldSettings = {
        gameType: deps.GameType.creative,
        generator: deps.Generator.flat,
        cheatsEnabled: true,
        difficulty: deps.Difficulty.peaceful,
        playerPermissionLevel: deps.PlayerPermissionsLevel.operator,
        permissionLevel: deps.PlayerPermissionsLevel.operator,
        randomSeed: "2000",
        packageReferences: packRefs,
        worldTemplateReferences: undefined,
        isEditor: flags.editor === true,
      };

      const forceNewWorld = flags.fresh === true || flags.fresh === "true";

      const startMessage: IMinecraftStartMessage = {
        mode: deps.DedicatedServerMode.auto,
        path: undefined,
        forceStartNewWorld: forceNewWorld,
        worldSettings,
        transientWorld: true,
      };

      // If a project path or current project is available, add it as additional content
      const projectPath = flags.project as string | undefined;
      if (projectPath) {
        startMessage.additionalContentPath = projectPath;
      } else if (context.project?.projectFolder) {
        // Deploy current project's content if available
        const folderPath = context.project.projectFolder.fullPath;
        if (folderPath) {
          startMessage.additionalContentPath = folderPath;
        }
      }

      context.output.progress(1, 4, "Provisioning server slot...");

      if (flags.editor === true) {
        context.output.info("Editor mode enabled — BDS will launch with Editor=true");
      }

      const server = await serverManager.ensureActiveServer(slot, startMessage);

      if (!server) {
        return this.error("SERVER_FAILED", "Failed to create server instance");
      }

      context.output.progress(2, 4, "Starting Bedrock Dedicated Server...");

      await server.startServer(false, startMessage);

      context.output.progress(3, 4, "Waiting for server to be ready...");

      await server.waitUntilStarted();

      context.output.progress(4, 4, "Server started!");

      const port = serverManager.getBasePortForSlot(slot);

      // --wait-ready: additional verification that the server is fully ready
      if (flags["wait-ready"] === true) {
        const startTime = Date.now();
        const timeoutSec = parseInt(flags.timeout as string, 10) || 60;
        const deadline = startTime + timeoutSec * 1000;

        while (server.status !== deps.DedicatedServerStatus.started && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (server.status !== deps.DedicatedServerStatus.started) {
          return {
            ...this.error("TIMEOUT", `Server did not reach ready state within ${timeoutSec}s`),
            exitCode: ToolCommandExitCode.Timeout,
          };
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        context.output.info(`Server ready after ${elapsed}s`);
      }

      context.output.success(`Server started on slot ${slot} (port ${port})`);

      return this.success(`Server started on slot ${slot} (port ${port})`, {
        slot,
        port,
        status: "started",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...this.error("START_FAILED", `Failed to start server: ${message}`),
        exitCode: this._categorizeError(message),
      };
    }
  }

  private async _stopServer(
    context: IToolCommandContext,
    slot: number,
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const serverManager = this._getServerManager(context);
    if (!serverManager) {
      return this.error("NO_SERVER_MANAGER", "No ServerManager available.");
    }

    try {
      const server = serverManager.getActiveServer(slot);

      if (!server) {
        return this.error("NO_SERVER", `No active server on slot ${slot}`);
      }

      context.output.info(`Stopping server on slot ${slot}...`);

      await server.stopServer();

      context.output.success(`Server stopped on slot ${slot}`);

      return this.success(`Server stopped on slot ${slot}`, {
        slot,
        status: "stopped",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...this.error("STOP_FAILED", `Failed to stop server: ${message}`),
        exitCode: this._categorizeError(message),
      };
    }
  }

  private async _getStatus(
    context: IToolCommandContext,
    slot: number,
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const serverManager = this._getServerManager(context);
    if (!serverManager) {
      return this.error("NO_SERVER_MANAGER", "No ServerManager available.");
    }

    const server = serverManager.getActiveServer(slot);

    if (!server) {
      context.output.info(`No active server on slot ${slot}`);
      return this.success(`No active server on slot ${slot}`, {
        slot,
        status: "none",
        running: false,
      });
    }

    const status = server.status;
    const port = serverManager.getBasePortForSlot(slot);

    const deps = await getServerDependencies();

    context.output.info(`Server on slot ${slot}: status=${status}, port=${port}`);

    return this.success(`Server status: ${status}`, {
      slot,
      port,
      status: String(status),
      running: status === deps.DedicatedServerStatus.started,
    });
  }

  /**
   * Categorize an error message into a standard exit code.
   */
  _categorizeError(message: string): ToolCommandExitCode {
    const lower = message.toLowerCase();

    if ((lower.includes("port") && lower.includes("in use")) || lower.includes("eaddrinuse")) {
      return ToolCommandExitCode.PortConflict;
    }
    if (lower.includes("eula")) {
      return ToolCommandExitCode.EulaNotAccepted;
    }
    if (lower.includes("download") || lower.includes("network") || lower.includes("econnrefused")) {
      return ToolCommandExitCode.NetworkError;
    }
    if (lower.includes("crash") || lower.includes("unexpected exit")) {
      return ToolCommandExitCode.CrashOnStartup;
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return ToolCommandExitCode.Timeout;
    }

    return ToolCommandExitCode.GenericError;
  }

  /**
   * Get the ServerManager from whichever context is available.
   * Priority: session.serverManager > minecraft (if it wraps a server) > undefined
   */
  private _getServerManager(context: IToolCommandContext) {
    // Session-based (MCP/API mode)
    if (context.session?.serverManager) {
      return context.session.serverManager;
    }

    // For UI/serve modes, we need to get or create a ServerManager.
    // The ServerManager is typically created by the hosting environment
    // (Electron DedicatedServerCommandHandler, MinecraftMcpServer, etc.)
    // We can create one on-demand for the creatorTools instance.
    return undefined;
  }
}

export const serverCommand = new ServerCommand();
