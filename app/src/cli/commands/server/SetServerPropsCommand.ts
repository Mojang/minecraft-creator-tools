import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";

/**
 * Display or set server properties (domain name, port, title, MOTD).
 *
 * Usage: mct setserverprops [--domain <name>] [--port <port>] [--title <title>] [--motd <message>]
 */
export class SetServerPropsCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "setserverprops",
    description: "Display or set server properties",
    taskType: TaskType.setServerProperties,
    aliases: ["serverprops"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Server",
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd
      .option("--domain <name>", "Server domain name")
      .option("--port <port>", "Server port")
      .option("--title <title>", "Server title")
      .option("--motd <message>", "Server message of the day");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { localEnv, log } = context;

    if (!localEnv) {
      log.error("Local environment not configured.");
      context.setExitCode(1);
      return;
    }

    await localEnv.load();

    // Check if any properties are being set
    const isSettingProps =
      context.server.domainName !== undefined ||
      context.server.port !== undefined ||
      context.server.title !== undefined ||
      context.server.messageOfTheDay !== undefined;

    if (isSettingProps) {
      if (context.server.domainName !== undefined) {
        localEnv.serverDomainName = context.server.domainName;
        log.info("Set server domain name to: " + context.server.domainName);
      }

      if (context.server.port !== undefined) {
        if (context.server.port < 1 || context.server.port > 65535) {
          log.error("Port must be between 1 and 65535");
          context.setExitCode(ErrorCodes.INIT_ERROR);
          return;
        }
        localEnv.serverHostPort = context.server.port;
        log.info("Set server port to: " + context.server.port);
      }

      if (context.server.title !== undefined) {
        localEnv.serverTitle = context.server.title;
        log.info("Set server title to: " + context.server.title);
      }

      if (context.server.messageOfTheDay !== undefined) {
        localEnv.serverMessageOfTheDay = context.server.messageOfTheDay;
        log.info("Set server message of the day to: " + context.server.messageOfTheDay);
      }

      try {
        await localEnv.save();
      } catch (err) {
        log.error("Failed to save server properties: " + (err instanceof Error ? err.message : String(err)));
        context.setExitCode(ErrorCodes.INIT_ERROR);
      }
    }

    // Display current properties
    let domainName = localEnv.serverDomainName;
    if (!domainName) {
      domainName = "(unspecified; used for display purposes only)";
    }

    let port = localEnv.serverHostPort;
    if (port === undefined || port === null) {
      port = 80;
    }

    let title = localEnv.serverTitle;
    if (!title) {
      title = "(unspecified; used for display purposes only)";
    }

    let motd = localEnv.serverMessageOfTheDay;
    if (!motd) {
      motd = "(unspecified; used for display purposes only)";
    }

    if (context.json) {
      // CI / scripting friendly: emit current properties as structured JSON
      // with the now-standard schemaVersion + command discriminator.
      log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "setserverprops",
          properties: {
            domainName: localEnv.serverDomainName ?? null,
            port: localEnv.serverHostPort ?? null,
            title: localEnv.serverTitle ?? null,
            messageOfTheDay: localEnv.serverMessageOfTheDay ?? null,
          },
        })
      );
      return;
    }

    log.info("\nServer Properties:");
    log.info("  Domain name: " + domainName);
    log.info("  Port: " + port);
    log.info("  Title: " + title);
    log.info("  Message of the day: " + motd);

    return;
  }
}

export const setServerPropsCommand = new SetServerPropsCommand();
