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
 * - retail:   Minecraft Bedrock GDK retail (%appdata%\Minecraft Bedrock\...\com.mojang)
 * - preview:  Minecraft Bedrock GDK Preview (%appdata%\Minecraft Bedrock Preview\...\com.mojang)
 * - mcuwp:    Legacy alias for retail (UWP-era naming, same path)
 * - mcpreview: Legacy alias for preview
 * - layout:   Flat pack layout to a custom folder (-o). Packs are placed directly as
 *             {name}_bp/ and {name}_rp/ without development_ wrappers. Suitable for
 *             dedicated servers, test automation, or custom deployment targets.
 * - server:   Dedicated server path (use --server-path to specify)
 * - folder/output: Use the -o output folder (with development_* pack folders)
 * - Custom path: Any other existing directory is treated as a direct target
 *
 * ENVIRONMENT-BASED MODE:
 * - env:      Reads MINECRAFT_PRODUCT from the project's .env file to determine
 *             the target. Maps "BedrockGDK" to retail and "PreviewGDK" to preview.
 *             This is compatible with @minecraft/core-build-tasks .env conventions.
 *
 * OPTIONS:
 * --test-world: Instead of copying raw packs, generate a test world
 *               containing the project packs (uses ProjectExporter).
 * --launch:     Launch the world in Minecraft after deployment
 *               (only meaningful with --test-world).
 *
 * USAGE:
 * npx mct deploy retail -i ./my-addon
 * npx mct deploy preview -i ./my-addon --test-world --launch
 * npx mct deploy layout -i ./my-addon -o ./server/content
 * npx mct deploy env -i .   (reads MINECRAFT_PRODUCT from .env)
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalTools from "../../../local/LocalTools";
import NodeStorage from "../../../local/NodeStorage";
import ProjectExporter, { FolderDeploy } from "../../../app/ProjectExporter";
import { IWorldSettings } from "../../../minecraft/IWorldSettings";
import * as fs from "fs";
import * as path from "path";

export class DeployCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "deploy",
    description:
      "Deploys Minecraft project packs to a destination. Use 'retail' or 'preview' for local Minecraft GDK folders, 'layout' for a flat pack layout to a custom folder.",
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
          "Deployment target: 'retail' (Minecraft GDK), 'preview' (Minecraft Preview GDK), " +
          "'env' (reads MINECRAFT_PRODUCT from .env), " +
          "'layout' (flat packs to -o folder), 'server' (dedicated server, use --server-path), " +
          "'folder'/'output' (dev packs to -o folder), 'mcuwp'/'mcpreview' (legacy aliases), or a custom path.",
        required: true,
        contextField: "mode",
      },
    ],
  };

  configure(cmd: Command): void {
    cmd.option("--test-world", "Deploy as a generated test world containing the project packs");
    cmd.option("--launch", "Launch the world in Minecraft after deployment (requires --test-world)");
    cmd.option(
      "--env-file <path>",
      "Custom .env file path for `deploy env` mode. Default: <project>/.env. Useful when the .env lives elsewhere (CI runners, monorepos)."
    );
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const mode = context.mode;

    if (!mode) {
      context.log.error("No deployment mode specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    let resolvedMode: string = mode;

    if (mode === "env") {
      const envMode = this.resolveModeFromEnv(context);

      if (!envMode) {
        return;
      }

      resolvedMode = envMode;
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

    const ns = this.getTargetFolderFromMode(context, resolvedMode);

    if (!ns) {
      context.log.error(
        `Could not determine target storage for deployment mode '${mode}'. Verify your --mode flag or output path.`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const isLayoutMode = mode === "layout";

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

        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "deploy",
              project: project.name,
              mode: "testWorld",
              success: true,
              outputPath: ns.rootFolder.fullPath,
              worldName,
            })
          );
        } else {
          context.log.info(`Deployed test world: ${worldName}`);
        }

        if (context.world.launch && worldName && typeof worldName === "string") {
          await LocalTools.launchWorld(context.creatorTools, worldName);
        }
      } else if (isLayoutMode) {
        if (!context.json) {
          context.log.info(`Deploying layout for project '${project.name}' to '${ns.rootFolder.fullPath}'...`);
        }

        await ProjectExporter.deployProject(context.creatorTools, project, ns.rootFolder, FolderDeploy.noFolders);

        await ns.rootFolder.saveAll();

        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "deploy",
              project: project.name,
              mode: "layout",
              success: true,
              outputPath: ns.rootFolder.fullPath,
            })
          );
        } else {
          context.log.success(`Deployed layout: ${project.name}`);
        }
      } else {
        if (!context.json) {
          context.log.info(`Deploying project '${project.name}' to '${ns.rootFolder.fullPath}'...`);
        }

        await LocalTools.deploy(context.creatorTools, project, ns, ns.rootFolder, project.name);

        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "deploy",
              project: project.name,
              mode,
              success: true,
              outputPath: ns.rootFolder.fullPath,
            })
          );
        } else {
          context.log.success(`Deployed: ${project.name}`);
        }
      }
    }

    this.logComplete(context);
  }

  private resolveModeFromEnv(context: ICommandContext): string | undefined {
    const inputFolder = context.inputFolder || process.cwd();
    // Allow callers to point at an explicit .env file via --env-file (CI / monorepo friendly).
    let envPath = path.join(inputFolder, ".env");
    const explicit = context.commandOptions?.envFile as string | undefined;
    if (explicit) {
      envPath = path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
    }

    if (!fs.existsSync(envPath)) {
      context.log.error(
        `No .env file found at ${envPath}. Create one with MINECRAFT_PRODUCT set to BedrockGDK or PreviewGDK, or pass --env-file <path> to point at an alternate location.`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    let envContent: string;

    try {
      envContent = fs.readFileSync(envPath, "utf-8");
    } catch (err) {
      context.log.error(`Failed to read .env file: ${err instanceof Error ? err.message : String(err)}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    const match = envContent.match(/MINECRAFT_PRODUCT\s*=\s*"?([^"\r\n]+)"?/);

    if (!match) {
      context.log.error(
        'MINECRAFT_PRODUCT not found in .env file. Add MINECRAFT_PRODUCT="BedrockGDK" or MINECRAFT_PRODUCT="PreviewGDK".'
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    const product = match[1].trim();

    switch (product) {
      case "BedrockGDK":
        context.log.info("Resolved deployment target from .env: retail (BedrockGDK)");
        return "retail";
      case "PreviewGDK":
        context.log.info("Resolved deployment target from .env: preview (PreviewGDK)");
        return "preview";
      default:
        context.log.error(
          `Unrecognized MINECRAFT_PRODUCT value '${product}' in .env. Expected 'BedrockGDK' or 'PreviewGDK'.`
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return undefined;
    }
  }

  private getTargetFolderFromMode(context: ICommandContext, mode: string): NodeStorage | undefined {
    const local = context.creatorTools.local;

    if (!local) {
      context.log.error("Local tools not available.");
      return undefined;
    }

    switch (mode) {
      case "retail":
      case "mcuwp":
      case undefined:
      case "":
        return new NodeStorage(local.minecraftPath, "");

      case "preview":
      case "mcpreview":
        return new NodeStorage(local.minecraftPreviewPath, "");

      case "layout":
        if (!context.outputFolder) {
          context.log.error("Layout mode requires an output folder. Use -o option.");
          return undefined;
        }
        return new NodeStorage(context.outputFolder, "");

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
              `Valid targets: retail, preview, env, layout, server, output, folder`
          );
          return undefined;
        }
        context.log.warn(`'${mode}' is not a recognized deploy target. Treating as custom folder path.`);
        return new NodeStorage(mode, "");
    }
  }
}

export const deployCommand = new DeployCommand();
