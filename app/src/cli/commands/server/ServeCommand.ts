import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import { getMessageCategoryPrefix } from "../../../local/ServerMessage";

// Dynamic import of Ink UI to avoid loading TSX files at module load time
// This allows tests to import ServeCommand without needing JSX support
let inkUIModule: typeof import("../../ui") | null = null;

/**
 * Check if terminal supports interactive Ink UI
 */
function supportsInkUI(): boolean {
  // Check if stdout is a TTY (terminal)
  if (!process.stdout.isTTY) {
    return false;
  }

  // Check for CI environment variables that indicate non-interactive mode
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.JENKINS) {
    return false;
  }

  // Check for dumb terminal
  if (process.env.TERM === "dumb") {
    return false;
  }

  return true;
}

/**
 * Dynamically import and render the Ink UI
 */
async function renderInkUI(
  sm: ServerManager,
  options: { httpPort: number; bdsPort: number; welcomeMessage: string; timeoutSeconds?: number; creatorTools?: any }
): Promise<void> {
  if (!inkUIModule) {
    // Dynamic import to avoid loading TSX at module load time
    inkUIModule = await import("../../ui");
  }
  await inkUIModule.renderServeScreen(sm, options);
}

/**
 * Start a full web server with Bedrock Dedicated Server support.
 *
 * Usage: mct serve [--port <port>] [--adminpc <passcode>] [--source-server-path <path>]
 */
export class ServeCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "serve",
    description: "Start web server with Bedrock Dedicated Server support",
    taskType: TaskType.serve,
    aliases: ["server"],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Server",
    arguments: [
      {
        name: "features",
        description: "Server features: all, allwebservices, basicwebservices, dedicatedserver",
        required: false,
        contextField: "features",
      },
    ],
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (arguments are already added by CommandRegistry from metadata)
    cmd
      .option("--port <port>", "Server port (default: 6126)")
      .option("--adminpc <passcode>", "Admin passcode")
      .option("--displaypc <passcode>", "Display read-only passcode")
      .option("--fullropc <passcode>", "Full read-only passcode")
      .option("--updatepc <passcode>", "Update state passcode")
      .option("--source-server-path <path>", "Path to source BDS installation")
      .option("--direct-server-path <path>", "Path to run BDS directly")
      .option("--gametest", "Enable GameTest framework")
      .option("--slot <slot>", "Server slot to use (default: 0)")
      .option("--timeout <seconds>", "Auto-exit after N seconds (for testing)")
      .option("--force-ink", "Force Ink UI even if not a TTY (for testing)")
      .option("--mcp-require-auth", "Require authentication for MCP endpoint even from localhost")
      .option("--log-file <path>", "Write all server output to a log file continuously");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !creatorTools.local || !localEnv) {
      log.error("Not configured correctly to run a server.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await localEnv.load();

    // Apply passcodes if provided via command line
    if (context.server.adminPasscode) {
      localEnv.setAdminPasscodeAndRandomizeComplement(context.server.adminPasscode);
    }
    if (context.server.displayReadOnlyPasscode) {
      localEnv.setDisplayReadOnlyPasscodeAndRandomizeComplement(context.server.displayReadOnlyPasscode);
    }
    if (context.server.fullReadOnlyPasscode) {
      localEnv.setFullReadOnlyPasscodeAndRandomizeComplement(context.server.fullReadOnlyPasscode);
    }
    if (context.server.updateStatePasscode) {
      localEnv.setUpdateStatePasscodeAndRandomizeComplement(context.server.updateStatePasscode);
    }
    if (context.server.port) {
      if (context.server.port < 1 || context.server.port > 65535) {
        log.error("Port must be between 1 and 65535, got: " + context.server.port);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      localEnv.serverHostPort = context.server.port;
    }
    if (context.server.title) {
      localEnv.serverTitle = context.server.title;
    }
    if (context.server.domainName) {
      localEnv.serverDomainName = context.server.domainName;
    }
    if (context.server.messageOfTheDay) {
      localEnv.serverMessageOfTheDay = context.server.messageOfTheDay;
    }

    // Create server manager
    const sm = new ServerManager(localEnv, creatorTools);

    // Handle process signals for graceful shutdown (Docker, systemd, etc.)
    const onSigterm = () => signalHandler("SIGTERM");
    const onSigint = () => signalHandler("SIGINT");
    const onSighup = () => signalHandler("SIGHUP");

    const signalHandler = async (signal: string) => {
      log.info(`Received ${signal}, shutting down gracefully...`);

      // Remove signal handlers to prevent accumulation
      process.removeListener("SIGTERM", onSigterm);
      process.removeListener("SIGINT", onSigint);
      if (process.platform !== "win32") {
        process.removeListener("SIGHUP", onSighup);
      }

      await sm.shutdown(signal);
    };

    process.on("SIGTERM", onSigterm);
    process.on("SIGINT", onSigint);
    if (process.platform !== "win32") {
      process.on("SIGHUP", onSighup);
    }

    // Set up continuous log file if requested
    let logFileStream: import("fs").WriteStream | undefined;
    if (context.server.logFile) {
      try {
        const fs = await import("fs");
        const logPath = context.server.logFile;
        logFileStream = fs.createWriteStream(logPath, { flags: "a" });
        logFileStream.write(`\n=== MCT Serve Log Started ${new Date().toISOString()} ===\n`);
        log.info(`Logging to file: ${logPath}`);

        sm.onServerOutput.subscribe((_sender, message) => {
          if (logFileStream && message.message) {
            const prefix = getMessageCategoryPrefix(message.category);
            logFileStream.write(`[${new Date().toISOString()}] [${prefix}] ${message.message}\n`);
          }
        });

        sm.onShutdown.subscribe(() => {
          if (logFileStream) {
            logFileStream.write(`=== MCT Serve Log Ended ${new Date().toISOString()} ===\n`);
            logFileStream.end();
            logFileStream = undefined;
          }
        });
      } catch (err: unknown) {
        log.warn(`Could not open log file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Set features based on context (default to all)
    if (context.server.features) {
      switch (context.server.features.toLowerCase()) {
        case "all":
          sm.features = ServerManagerFeatures.all;
          break;
        case "allwebservices":
          sm.features = ServerManagerFeatures.allWebServices;
          break;
        case "basicwebservices":
          sm.features = ServerManagerFeatures.basicWebServices;
          break;
        case "dedicatedserver":
        case "dedicatedserveronly":
          sm.features = ServerManagerFeatures.dedicatedServerOnly;
          break;
        default:
          sm.features = ServerManagerFeatures.all;
      }
    } else {
      sm.features = ServerManagerFeatures.all;
    }
    sm.runOnce = context.server.runOnce;

    // Set up shutdown handler - this allows the command to complete when shutdown is triggered
    let shutdownResolve: (() => void) | undefined;
    const shutdownPromise = new Promise<void>((resolve) => {
      shutdownResolve = resolve;
    });

    let hasShutdown = false;
    sm.onShutdown.subscribe((_sm: ServerManager, reason: string) => {
      if (hasShutdown) return;
      hasShutdown = true;
      log.info("Server shutting down: " + reason);
      if (shutdownResolve) {
        shutdownResolve();
      }
    });

    // Start the HTTP server first (doesn't require EULA) - unless dedicatedServerOnly
    if (sm.features !== ServerManagerFeatures.dedicatedServerOnly) {
      await this.applyServerProps(localEnv);
      // Configure MCP auth requirement
      const httpServer = sm.ensureHttpServer();
      if (context.server.mcpRequireAuth) {
        httpServer.setMcpRequireAuth(true);
      }

      const port = localEnv.serverHostPort || 6126;
      const adminPc = localEnv.adminPasscode;
      const webUiUrl = adminPc ? `http://localhost:${port}/#tempPasscode=${adminPc}` : `http://localhost:${port}`;

      log.info("\nWeb UI available at: " + webUiUrl);
      log.info("MCP endpoint available at: http://localhost:" + port + "/mcp");
    }

    // Only start BDS if features require it (not basicWebServices)
    if (sm.features !== ServerManagerFeatures.basicWebServices) {
      // Check BDS prerequisites
      const bdsReady = await this.prepareBds(localEnv, sm, log);

      if (!bdsReady) {
        if (sm.features !== ServerManagerFeatures.dedicatedServerOnly) {
          log.info("\nBedrock Dedicated Server features require EULA acceptance.");
          log.info("Admins can accept the EULA via the web UI to enable BDS features.");
        } else {
          // dedicatedServerOnly mode requires EULA - can't continue
          log.error("Bedrock Dedicated Server requires EULA acceptance. Run 'mct eula' to accept.");
          context.setExitCode(ErrorCodes.INIT_ERROR);
          return;
        }
      } else {
        await sm.prepare();

        // Start BDS
        const slot = context.server.slot || 0;
        const startInfo = await this.getStartInfo(context.projects, context);

        if (context.world.editor) {
          log.info("Editor mode enabled — BDS will launch with Editor=true");
        }

        if (startInfo && Object.keys(startInfo).length > 0) {
          const srvr = await sm.ensureActiveServer(slot, startInfo);
          if (!srvr) {
            log.error("Failed to create server instance");
            context.setExitCode(ErrorCodes.INIT_ERROR);
            return;
          }
          try {
            srvr.startServer(false, startInfo);
          } catch (err) {
            log.error("Server startup failed: " + (err instanceof Error ? err.message : String(err)));
            context.setExitCode(ErrorCodes.INIT_ERROR);
          }
        }
      }
    }

    // Keep the process alive until shutdown
    if (context.server.runOnce) {
      // In runOnce mode, wait for the HTTP server to complete one operation and trigger shutdown
      log.info("\nServer running in single-request mode (--once). Will shut down after processing one request.\n");
      await shutdownPromise;
    } else if (context.quiet) {
      // In quiet mode, just start the server without interactive UI
      log.info("Server started on port " + (localEnv.serverHostPort || 6126));
      await shutdownPromise;
    } else if (supportsInkUI() || context.server.forceInk) {
      // Use rich Ink UI for interactive terminal
      const httpPort = localEnv.serverHostPort || 6126;
      const adminPcInk = localEnv.adminPasscode;
      const welcomeMsg = adminPcInk
        ? `Web UI: http://localhost:${httpPort}/#tempPasscode=${adminPcInk}`
        : `Web UI: http://localhost:${httpPort}`;
      await renderInkUI(sm, {
        httpPort: httpPort,
        bdsPort: 19132, // Default BDS port
        welcomeMessage: welcomeMsg,
        timeoutSeconds: context.server.timeout, // Pass timeout to Ink component
        creatorTools: creatorTools,
      });
    } else {
      // Fallback: In normal mode, inform user and wait indefinitely
      // Set up timeout if specified (for non-Ink mode)
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (context.server.timeout && context.server.timeout > 0) {
        const timeoutSeconds = context.server.timeout;
        log.info(`\nServer will auto-exit in ${timeoutSeconds} seconds.\n`);
        timeoutHandle = setTimeout(async () => {
          log.info("Timeout reached, shutting down.");
          await sm.shutdown("timeout");
        }, timeoutSeconds * 1000);
      } else {
        log.info("\nPress Ctrl+C to stop the server.\n");
      }
      await shutdownPromise;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }

    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyServerProps(localEnv: any): Promise<void> {
    // Ensure default passcodes are set if not provided
    if (
      localEnv.displayReadOnlyPasscode === undefined ||
      localEnv.adminPasscode === undefined ||
      localEnv.fullReadOnlyPasscode === undefined ||
      localEnv.updateStatePasscode === undefined
    ) {
      await localEnv.setDefaults();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async prepareBds(
    localEnv: any,
    _sm: ServerManager,
    _log: { info: (msg: string) => void; error: (msg: string) => void }
  ): Promise<boolean> {
    // Check EULA acceptance
    if (!localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      return false;
    }

    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getStartInfo(projects: any[], context: ICommandContext): Promise<any> {
    const startInfo: any = {};

    if (projects.length > 0) {
      const project = projects[0];
      startInfo.projectName = project.name;
      startInfo.projectFolder = project.projectFolder;
    }

    if (context.world.editor) {
      startInfo.worldSettings = {
        ...(startInfo.worldSettings || {}),
        isEditor: true,
      };
    }

    return startInfo;
  }
}

export const serveCommand = new ServeCommand();
