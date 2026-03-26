import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ServerManager from "../../../local/ServerManager";
import DedicatedServer, { DedicatedServerStatus } from "../../../local/DedicatedServer";
import ServerMessage, { ServerMessageCategory } from "../../../local/ServerMessage";
import NodeStorage from "../../../local/NodeStorage";
import Log from "../../../core/Log";

/**
 * Run auto-tests by deploying projects to Bedrock Dedicated Server and capturing output.
 *
 * Usage: mct autotest -i <projectPath> [-o <outputFolder>]
 */
export class AutotestCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "autotest",
    description: "Run auto-tests by deploying projects to BDS",
    taskType: TaskType.autoTest,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Content",
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { projects, creatorTools, localEnv, log } = context;

    if (!localEnv || !creatorTools) {
      log.error("Local environment is not properly set up.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await localEnv.load();

    if (!localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      log.error(
        "To run auto-tests, you must first accept the Minecraft End User License Agreement.\n" +
          "Run 'mct eula' to accept it, or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    let outputStorage: NodeStorage | undefined;
    const outputLines: string[] = [];
    const csvHeader = "Project,Date,Category,Message";

    if (context.outputFolder) {
      outputStorage = new NodeStorage(context.outputFolder, "");
    }

    const sm = new ServerManager(localEnv, creatorTools);

    for (const project of projects) {
      const localLines: string[] = [];
      const localDistill: string[] = [];

      Log.message("Auto-testing '" + project.name + "' within dedicated server.");

      await project.inferProjectItemsFromFiles();

      // Get start info from project
      const startInfo = this.getStartInfoFromProject(project);

      if (!startInfo) {
        log.error("Could not start the server with appropriate server start information.");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      const srv = await sm.ensureActiveServer(0, startInfo);

      if (!srv) {
        log.error("Could not start the server with appropriate server start information.");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      if (!project.projectFolder) {
        log.error("Could not start a project with a project folder");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      await project.ensureProjectFolder();

      // Subscribe to server output
      srv.onServerOutput.subscribe((dedicatedServer: DedicatedServer, message: ServerMessage) => {
        let mess = message.message;

        if (mess.includes(",")) {
          mess = '"' + mess + '"';
        }

        const csl = message.date + "," + message.category.toString() + "," + mess;
        outputLines.push(project.name + "," + csl);
        localLines.push(csl);

        if (message.category === ServerMessageCategory.general) {
          localDistill.push(message.category.toString() + "," + mess);
        }
      });

      try {
        await srv.deploy(project.projectFolder, false, true);
      } catch (err) {
        log.error("Deploy failed: " + (err instanceof Error ? err.message : String(err)));
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      // Wait for server to start
      let secondsWaiting = 0;
      while (srv.status !== DedicatedServerStatus.started && secondsWaiting < 120) {
        secondsWaiting++;
        await this.sleep(1000);
      }

      // Let the server breathe for 15 seconds after start
      await this.sleep(15000);

      await srv.stopServer();

      if (outputStorage) {
        const csvFile = outputStorage.rootFolder.ensureFile(project.name + ".csv");
        const content = csvHeader + "\n" + localLines.join("\n");
        csvFile.setContent(content);
        csvFile.saveContent();

        const csvDistillFile = outputStorage.rootFolder.ensureFile(project.name + ".distill.csv");
        const distillContent = "Category,Message\n" + localDistill.join("\n");
        csvDistillFile.setContent(distillContent);
        csvDistillFile.saveContent();
      }

      project.dispose();
    }

    if (outputStorage) {
      const csvFile = outputStorage.rootFolder.ensureFile("runs.csv");
      const content = csvHeader + "\n" + outputLines.join("\n");
      csvFile.setContent(content);
      csvFile.saveContent();
    }

    return;
  }

  private getStartInfoFromProject(project: any): any {
    // Get behavior pack modules and scripts info for starting the server
    // This is a simplified version - the actual implementation would need
    // to analyze the project structure
    return {
      projectName: project.name,
      projectFolder: project.projectFolder,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const autotestCommand = new AutotestCommand();
