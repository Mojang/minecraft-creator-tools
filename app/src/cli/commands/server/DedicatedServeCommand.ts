import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";

/**
 * Start only the Bedrock Dedicated Server (no web UI).
 *
 * Usage: mct dedicatedserve [--source-server-path <path>] [--direct-server-path <path>]
 */
export class DedicatedServeCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "dedicatedserve",
    description: "Start only the Bedrock Dedicated Server (no web UI)",
    taskType: TaskType.runDedicatedServer,
    aliases: ["bds", "dedicated"],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Server",
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd
      .option("--source-server-path <path>", "Path to source BDS installation")
      .option("--direct-server-path <path>", "Path to run BDS directly")
      .option("--gametest", "Enable GameTest framework")
      .option("--slot <slot>", "Server slot to use (default: 0)");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !creatorTools.local || !localEnv) {
      log.error("Not configured correctly to run a server.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await localEnv.load();

    // Create server manager with BDS-only features
    const sm = new ServerManager(localEnv, creatorTools);
    sm.features = ServerManagerFeatures.dedicatedServerOnly;

    // Check EULA acceptance
    if (!localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      // Check for environment variable
      if (!this.checkEnvEula()) {
        log.error(
          "EULA not accepted. Accept it via:\n" +
            "  Interactive:    mct eula\n" +
            "  Non-interactive: mct eula --accept   (or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true)"
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
      await localEnv.save();
    }

    await sm.prepare();

    // Start BDS
    const slot = context.server.slot || 0;
    const startInfo = await this.getStartInfo(context.projects, context);

    if (context.world.editor) {
      log.info("Editor mode enabled — BDS will launch with Editor=true");
    }

    const srvr = await sm.ensureActiveServer(slot, startInfo);
    if (!srvr) {
      log.error("Failed to create server instance.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }
    try {
      srvr.startServer(true, startInfo);
    } catch (err) {
      log.error("Server startup failed: " + (err instanceof Error ? err.message : String(err)));
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    log.info("Bedrock Dedicated Server started.");
    log.info("\nPress Ctrl+C to stop the server.\n");

    // Keep the process alive until signaled to stop
    await new Promise<void>((resolve) => {
      const shutdown = async () => {
        log.info("Shutting down server...");
        try {
          if (srvr) {
            await srvr.stopServer();
          }
          await sm.shutdown("signal");
        } catch (e) {
          log.error("Error during shutdown: " + e);
        }
        resolve();
      };

      process.on("SIGINT", () => {
        shutdown();
      });
      process.on("SIGTERM", () => {
        shutdown();
      });
    });
  }

  private checkEnvEula(): boolean {
    const envValue = process.env.MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA;
    return envValue?.toLowerCase() === "true";
  }

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

export const dedicatedServeCommand = new DedicatedServeCommand();
