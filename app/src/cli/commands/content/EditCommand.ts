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
 * Start a local web server to edit Minecraft content in the browser.
 * Unlike view, this allows modifying files through the editor.
 *
 * Usage: mct edit -i <contentPath>
 */
export class EditCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "edit",
    description: "Edit Minecraft content in the browser (read-write)",
    taskType: TaskType.edit,
    aliases: [],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: true,
    category: "Content",
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !localEnv) {
      log.error("Not properly configured.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Get the content path from input
    let contentPath = context.inputFolder;

    if (!contentPath) {
      log.error("No input path specified. Use the -i flag to specify content to edit.");
      log.error("Example: mct edit -i ./my-addon");
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
    const editPort = await LocalUtilities.findAvailablePort(6136, 6236, "localhost");

    if (!editPort) {
      log.error(
        "Failed to find an available port in range 6136-6236. Please close other applications using these ports."
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Generate passcodes for authentication
    await localEnv.setDefaults();

    // Set the port AFTER setDefaults() to ensure it's not overwritten
    localEnv.serverHostPort = editPort;
    localEnv.serverDomainName = "localhost";
    localEnv.serverTitle = "Minecraft Content Editor";

    // Use the admin passcode for full permissions
    const editPasscode = localEnv.adminPasscode;

    if (!editPasscode) {
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

    // Enable edit mode
    httpServer.setEditMode(true);

    // Build the URL with auto-login passcode
    const editUrl = `http://localhost:${editPort}/?mode=project&contentUrl=/api/content/#tempPasscode=${editPasscode}`;

    log.info(`\nStarting content editor server on http://localhost:${editPort}`);
    log.info(`Opening browser to: ${editUrl}`);
    log.warn(
      `Authenticated users of http://localhost:${editPort} can edit files at ${path.resolve(contentPath)} in this mode.`
    );
    log.info(`\nPress Ctrl+C to stop the server.\n`);

    // Open the browser unless MCT_NO_OPEN_BROWSER is set
    if (!process.env.MCT_NO_OPEN_BROWSER) {
      this.openBrowser(editUrl);
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

export const editCommand = new EditCommand();
