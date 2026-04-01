import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectExporter from "../../../app/ProjectExporter";
import LocalTools from "../../../local/LocalTools";
import NodeStorage from "../../../local/NodeStorage";
import { IWorldSettings } from "../../../minecraft/IWorldSettings";

/**
 * Deploy a test world with the project packs to a Minecraft folder.
 *
 * Usage: mct deploytestworld -i <projectPath> [mode] [--launch]
 */
export class DeployTestWorldCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "deploytestworld",
    description: "Deploy a test world with project packs to Minecraft",
    taskType: TaskType.deployTestWorld,
    aliases: ["deploytest"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "World",
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd.option("--launch", "Launch the world after deployment");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { projects, creatorTools, log } = context;

    if (!creatorTools || !creatorTools.local) {
      log.error("Not configured correctly to sync a project.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const mode = context.mode;

    for (const project of projects) {
      const ns = this.getTargetFolder(mode, context, creatorTools);

      if (!ns) {
        log.error("Could not determine storage for this project.");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      await ns.rootFolder.ensureExists();

      const worldSettings: IWorldSettings = {
        commandsEnabled: true,
      };

      const worldName = await ProjectExporter.deployProjectAndGeneratedWorldTo(
        creatorTools,
        project,
        worldSettings,
        ns.rootFolder
      );

      log.info(`Deployed test world: ${worldName}`);

      if (worldName && typeof worldName === "string") {
        await LocalTools.launchWorld(creatorTools, worldName);
      }
    }

    return;
  }

  private getTargetFolder(
    mode: string | undefined,
    context: ICommandContext,
    creatorTools: any
  ): NodeStorage | undefined {
    let ns: NodeStorage | undefined;

    switch (mode) {
      case "mcuwp":
      case undefined:
      case "":
        ns = new NodeStorage(creatorTools.local.minecraftPath, "");
        break;
      case "mcpreview":
        ns = new NodeStorage(creatorTools.local.minecraftPreviewPath, "");
        break;
      case "server":
        if (!context.outputFolder) {
          return undefined;
        }
        ns = new NodeStorage(context.outputFolder, "");
        break;
      case "output":
      case "folder":
        if (!context.outputFolder) {
          return undefined;
        }
        ns = new NodeStorage(context.outputFolder, "");
        break;
      default:
        ns = new NodeStorage(mode, "");
        break;
    }

    return ns;
  }
}

export const deployTestWorldCommand = new DeployTestWorldCommand();
