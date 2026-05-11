import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import MCWorld from "../../../minecraft/MCWorld";
import StorageUtilities from "../../../storage/StorageUtilities";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemStorageType, ProjectItemType } from "../../../app/IProjectItemData";
import { FolderContext } from "../../../app/Project";

/**
 * Display or set world settings.
 *
 * Usage: mct world [set] [--betaApis] [--editor] [--dataDrivenItems] [-b <behaviorPack>] [-r <resourcePack>]
 */
export class WorldCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "world",
    description: "Display or set world settings",
    taskType: TaskType.world,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: false,
    category: "World",
    arguments: [
      {
        name: "mode",
        description: "Use 'set' to modify world settings",
        required: false,
        contextField: "mode",
      },
    ],
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd
      .option("--betaApis <value>", "Set beta APIs experiment (true/false)")
      .option("--editor <value>", "Set is created in editor (true/false)")
      .option("--dataDrivenItems <value>", "Set data driven items experiment (true/false)")
      .option("-b, --behaviorPack <pack>", "Behavior pack to associate")
      .option("-r, --resourcePack <pack>", "Resource pack to associate");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { projects, log } = context;
    const isEnsure = context.mode === "set";

    for (const project of projects) {
      const itemsCopy = project.getItemsCopy();
      let foundWorld = false;

      for (const item of itemsCopy) {
        if (item.isWorld) {
          await this.processWorld(item, context, log, isEnsure);
          foundWorld = true;
        }
      }

      // If mode is "set" and no world was found, create a new one
      if (isEnsure && !foundWorld && context.outputFolder) {
        await this.createAndProcessNewWorld(project, context, log);
      }
    }

    return;
  }

  /**
   * Create a new world in the output folder and process it.
   */
  private async createAndProcessNewWorld(
    project: any, // Using any to avoid circular dependency issues
    context: ICommandContext,
    log: { info: (msg: string) => void; error: (msg: string) => void }
  ): Promise<void> {
    const wcf = await project.ensureWorldContainer();

    if (!wcf || !project.projectFolder) {
      log.error("Could not create world container folder.");
      return;
    }

    // Determine the destination folder for the world
    let destF = project.projectFolder;
    const targetName = destF.name;

    if (context.outputFolder) {
      let targetFolder = context.outputFolder;

      if (context.inputFolder && targetFolder.startsWith(context.inputFolder)) {
        // Output folder is under the input folder — use the relative portion
        targetFolder = targetFolder.substring(context.inputFolder.length);

        if (targetFolder.length > 2) {
          destF = await wcf.ensureFolderFromRelativePath(StorageUtilities.ensureEndsDelimited(targetFolder));
        }
      }
      // If the output folder is NOT under the input folder (e.g., default -o value
      // pointing to CWD/out), skip the relative path logic and use the default
      // project folder. Passing an absolute path to ensureFolderFromRelativePath
      // would create a garbled path like "<project>\C:\...".
    }

    if (!destF) {
      log.error("Could not determine destination folder for world.");
      return;
    }

    let path = destF.getFolderRelativePath(project.projectFolder);

    if (path) {
      path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

      const pi = project.ensureItemByProjectPath(
        path,
        ProjectItemStorageType.folder,
        targetName,
        ProjectItemType.worldFolder,
        FolderContext.unknown
      );

      if (!pi.isContentLoaded) {
        await pi.loadContent();
      }

      await this.processWorld(pi, context, log, true);
    }
  }

  private async processWorld(
    item: ProjectItem,
    context: ICommandContext,
    log: { info: (msg: string) => void; error: (msg: string) => void },
    isSettable: boolean = false
  ): Promise<void> {
    const mcworld: MCWorld | undefined = await item.getManager();

    if (!mcworld) {
      return;
    }

    await mcworld.loadMetaFiles(false);

    // Determine if we should apply settings
    const shouldSet = isSettable || context.world.betaApis === true || context.world.editor === true;

    if (shouldSet) {
      if (mcworld.name === "" && mcworld.storageFullPath) {
        mcworld.name = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(mcworld.storageFullPath));
      }

      log.info("Updating mcworld at '" + mcworld.storageFullPath + "'");
      const levelDat = mcworld.ensureLevelData();
      if (!levelDat) {
        log.error("Could not read level data from world");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      let hasSet = false;

      if (context.world.betaApis === true) {
        if (context.world.betaApis !== levelDat.betaApisExperiment) {
          levelDat.betaApisExperiment = context.world.betaApis;
          log.info("Set beta APIs to " + context.world.betaApis);
          hasSet = true;
        }
      }

      if (context.world.editor === true) {
        if (context.world.editor !== levelDat.isCreatedInEditor) {
          levelDat.isCreatedInEditor = context.world.editor;
          log.info("Set is editor to " + context.world.editor);
          hasSet = true;
        }
      }

      if (hasSet) {
        await mcworld.save();
      }
    }

    if (context.json) {
      // CI/automation friendly: emit world metadata as structured JSON.
      context.log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "world",
          world: {
            name: mcworld.name,
            path: item.projectPath,
            betaApis: mcworld.betaApisExperiment ?? null,
            dataDrivenItems: mcworld.levelData?.dataDrivenItemsExperiment ?? null,
          },
        })
      );
      return;
    }

    log.info("World name: " + mcworld.name);
    log.info("World path: " + item.projectPath);

    if (mcworld.betaApisExperiment !== undefined) {
      log.info("Beta APIs: " + mcworld.betaApisExperiment);
    }

    if (mcworld.levelData) {
      if (mcworld.levelData.dataDrivenItemsExperiment !== undefined) {
        log.info("Data Driven items (holiday experimental): " + mcworld.levelData.dataDrivenItemsExperiment);
      }
    }
  }
}

export const worldCommand = new WorldCommand();
