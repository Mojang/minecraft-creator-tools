import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import LocalUtilities from "../../../local/LocalUtilities";
import Log from "../../../core/Log";
import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";

/**
 * Start a local web server to view Minecraft content in read-only project editor mode.
 * Opens a browser to the served content with auto-login via a temporary passcode.
 *
 * Usage: mct view -i <contentPath>
 */
export class ViewCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "view",
    description: "View Minecraft content in the browser (read-only)",
    taskType: TaskType.view,
    aliases: [],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Content",
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !creatorTools.local || !localEnv) {
      log.error("Not configured correctly to start content viewer.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Get the content path from input
    let contentPath = context.inputFolder;

    if (!contentPath) {
      log.error("No input path specified. Use the -i flag to specify content to view.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Ensure the path exists
    if (!fs.existsSync(contentPath)) {
      log.error("Content path does not exist: " + contentPath);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Normalize to folder path
    const stat = fs.statSync(contentPath);
    if (!stat.isDirectory()) {
      contentPath = path.dirname(contentPath);
    }

    // Find an available port in the 6136-6236 range
    const viewPort = await LocalUtilities.findAvailablePort(6136, 6236, "localhost");

    if (!viewPort) {
      log.error(
        "Failed to find an available port in range 6136-6236. Please close other applications using these ports."
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Generate passcodes for authentication
    await localEnv.setDefaults();

    // Set the port AFTER setDefaults() to ensure it's not overwritten
    localEnv.serverHostPort = viewPort;
    localEnv.serverDomainName = "localhost";
    localEnv.serverTitle = "Minecraft Content Viewer";

    // Get the full read-only passcode for auto-login
    const viewPasscode = localEnv.fullReadOnlyPasscode;

    if (!viewPasscode) {
      log.error("Failed to generate authentication passcode.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Create server manager with full features
    const sm = new ServerManager(localEnv, creatorTools);
    sm.features = ServerManagerFeatures.all;

    const httpServer = sm.ensureHttpServer();
    if (!httpServer) {
      log.error("Failed to create HTTP server.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Set the content path for serving via /api/content
    httpServer.setContentPath(contentPath);
    httpServer.creatorTools = creatorTools;

    // Enable view mode
    httpServer.setViewMode(true);

    // Build the URL with auto-login passcode
    const viewUrl = `http://localhost:${viewPort}/?mode=project&contentUrl=/api/content/#tempPasscode=${viewPasscode}`;

    log.info(`\nStarting content viewer server on http://localhost:${viewPort}`);
    log.info(`Opening browser to: ${viewUrl}`);
    log.info(`\nPress Ctrl+C to stop the server.\n`);

    // Open the browser unless MCT_NO_OPEN_BROWSER is set
    if (!process.env.MCT_NO_OPEN_BROWSER) {
      this.openBrowser(viewUrl);
    } else {
      log.info("Browser auto-open disabled (MCT_NO_OPEN_BROWSER is set)");
    }

    // Keep the process alive until terminated by signal
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => {
        resolve();
      });
      process.on("SIGTERM", () => {
        resolve();
      });
    });

    return;
  }

  private openBrowser(url: string): void {
    const platform = process.platform;

    try {
      if (platform === "darwin") {
        childProcess.spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
      } else if (platform === "win32") {
        childProcess
          .spawn("rundll32", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore" })
          .unref();
      } else {
        childProcess.spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
      }
    } catch {
      Log.debug("Could not automatically open browser. Please navigate to: " + url);
    }
  }
}

export const viewCommand = new ViewCommand();
