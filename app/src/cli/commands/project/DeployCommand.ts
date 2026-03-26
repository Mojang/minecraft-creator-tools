/**
 * DeployCommand - Deploy project to Minecraft folders
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command copies a project's behavior and resource packs to
 * a Minecraft installation folder for testing.
 *
 * DEPLOYMENT MODES:
 * - mcuwp: Minecraft Bedrock UWP (Windows 10/11)
 * - mcpreview: Minecraft Bedrock Preview
 * - server: Dedicated server path (use -s to specify)
 * - folder/output: Use the -o output folder
 * - Custom path: Any other string is treated as a path
 *
 * OPTIONS:
 * --test-world: Instead of copying raw packs, generate a test world
 *               containing the project packs (uses ProjectExporter).
 * --launch:     Launch the world in Minecraft after deployment
 *               (only meaningful with --test-world).
 *
 * USAGE:
 * npx mct deploy <mode> -i <project-folder>
 * npx mct deploy mcuwp -i ./my-addon --test-world --launch
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalTools from "../../../local/LocalTools";
import NodeStorage from "../../../local/NodeStorage";
import ProjectExporter from "../../../app/ProjectExporter";
import { IWorldSettings } from "../../../minecraft/IWorldSettings";
import * as fs from "fs";

export class DeployCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "deploy",
    description: "Copies Minecraft files to a destination folder.",
    taskType: TaskType.deploy,
    aliases: ["dp"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Project",
    arguments: [
      {
        name: "mode",
        description:
          "Determines where to copy Minecraft files to. Use 'mcuwp' for Minecraft Bedrock UWP, 'mcpreview' for Minecraft Bedrock Preview, 'server' for the server path, or use a custom path.",
        required: true,
        contextField: "mode",
      },
    ],
  };

  configure(cmd: Command): void {
    cmd.option("--test-world", "Deploy as a generated test world containing the project packs");
    cmd.option("--launch", "Launch the world in Minecraft after deployment (requires --test-world)");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const mode = context.mode;

    if (!mode) {
      context.log.error("No deployment mode specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (context.projectCount === 0) {
      context.log.error("No projects to deploy. Use -i to specify a project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (!context.creatorTools.local) {
      context.log.error("Deploy requires local environment (not available in web mode)");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const ns = this.getTargetFolderFromMode(context, mode);

    if (!ns) {
      context.log.error(`Could not determine target storage for deployment mode '${mode}'. Verify your --mode flag or output path.`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      try {
        await project.inferProjectItemsFromFiles();
      } catch (err) {
        context.log.error("Failed to load project: " + (err instanceof Error ? err.message : String(err)));
        context.setExitCode(ErrorCodes.INIT_ERROR);
        continue;
      }

      await ns.rootFolder.ensureExists();

      if (context.world.testWorld) {
        // Deploy as a generated test world with packs included
        const worldSettings: IWorldSettings = {
          commandsEnabled: true,
        };

        const worldName = await ProjectExporter.deployProjectAndGeneratedWorldTo(
          context.creatorTools,
          project,
          worldSettings,
          ns.rootFolder
        );

        context.log.info(`Deployed test world: ${worldName}`);

        if (context.world.launch && worldName && typeof worldName === "string") {
          await LocalTools.launchWorld(context.creatorTools, worldName);
        }
      } else {
        context.log.info(`Deploying project '${project.name}' to '${ns.rootFolder.fullPath}'...`);

        await LocalTools.deploy(context.creatorTools, project, ns, ns.rootFolder, project.name);

        context.log.success(`Deployed: ${project.name}`);
      }
    }

    this.logComplete(context);
  }

  private getTargetFolderFromMode(context: ICommandContext, mode: string): NodeStorage | undefined {
    const local = context.creatorTools.local;

    if (!local) {
      context.log.error("Local tools not available.");
      return undefined;
    }

    switch (mode) {
      case "mcuwp":
      case undefined:
      case "":
        return new NodeStorage(local.minecraftPath, "");

      case "mcpreview":
        return new NodeStorage(local.minecraftPreviewPath, "");

      case "server":
        if (!context.server.serverPath) {
          context.log.error("No server path specified. Use --server-path option.");
          return undefined;
        }
        return new NodeStorage(context.server.serverPath, "");

      case "output":
      case "folder":
        if (!context.outputFolder) {
          context.log.error("No output folder specified. Use -o option.");
          return undefined;
        }
        return new NodeStorage(context.outputFolder, "");

      default:
        // Treat as a custom folder path — validate it exists
        if (!fs.existsSync(mode)) {
          context.log.error(
            `'${mode}' is not a recognized deploy target and does not exist as a folder path. ` +
              `Valid targets: mcuwp, mcpreview, server, output, folder`
          );
          return undefined;
        }
        context.log.warn(`'${mode}' is not a recognized deploy target. Treating as custom folder path.`);
        return new NodeStorage(mode, "");
    }
  }
}

export const deployCommand = new DeployCommand();
