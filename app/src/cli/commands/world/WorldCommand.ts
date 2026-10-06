import { Command as Commander, Option } from "commander";
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
 * Usage: mct world [set] [--betaapis | --no-betaapis] [--editor | --no-editor]
 */
/**
 * Applies --betaapis/--no-betaapis and --editor/--no-editor to a world's level data. Each value is
 * tri-state: true turns the setting on, false turns it off, undefined leaves it as is. Returns a
 * message per setting that changed; an empty list means there is nothing to save.
 */
export function applyWorldSettings(
  levelData: { betaApisExperiment?: boolean; isCreatedInEditor?: boolean },
  settings: { betaApis?: boolean; editor?: boolean }
): string[] {
  const changes: string[] = [];

  if (settings.betaApis !== undefined && settings.betaApis !== levelData.betaApisExperiment) {
    levelData.betaApisExperiment = settings.betaApis;
    changes.push("Set beta APIs to " + settings.betaApis);
  }

  if (settings.editor !== undefined && settings.editor !== levelData.isCreatedInEditor) {
    levelData.isCreatedInEditor = settings.editor;
    changes.push("Set is editor to " + settings.editor);
  }

  return changes;
}

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
    globalOptionGroups: ["input", "projects", "outputFolder", "betaApis", "editor", "json"],
    examples: [
      { description: "Show the world's settings", command: "mct world -i ./my-world" },
      { description: "Turn on the Beta APIs experiment", command: "mct world set --betaapis -i ./my-world" },
    ],
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
    // Nothing reads these older options (use --betaapis/--no-betaapis and --editor/--no-editor);
    // they stay registered so existing scripts still parse, but are hidden from help.
    for (const [flags, description] of [
      ["--betaApis <value>", "Set beta APIs experiment (true/false)"],
      ["--editor <value>", "Set is created in editor (true/false)"],
      ["--dataDrivenItems <value>", "Set data driven items experiment (true/false)"],
      ["-b, --behaviorPack <pack>", "Behavior pack to associate"],
      ["-r, --resourcePack <pack>", "Resource pack to associate"],
    ]) {
      cmd.addOption(new Option(flags, description).hideHelp());
    }
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
    const { betaApis, editor } = context.world;
    const shouldSet = isSettable || betaApis !== undefined || editor !== undefined;

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
      const changes = applyWorldSettings(levelDat, { betaApis, editor });
      changes.forEach((change) => log.info(change));

      if (changes.length > 0) {
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
