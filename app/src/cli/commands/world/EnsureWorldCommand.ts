import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { ProjectItemStorageType, ProjectItemType } from "../../../app/IProjectItemData";
import { FolderContext } from "../../../app/Project";
import StorageUtilities from "../../../storage/StorageUtilities";
import MCWorld from "../../../minecraft/MCWorld";

/**
 * Create/ensure a flat GameTest world if one doesn't exist.
 *
 * Usage: mct ensureworld -i <projectPath> [-o <outputFolder>]
 */
export class EnsureWorldCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "ensureworld",
    description: "Create/ensure a flat GameTest world for a project",
    taskType: TaskType.ensureRefWorld,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "World",
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { projects, log } = context;

    for (const project of projects) {
      // Check if world already exists
      const itemsCopy = project.getItemsCopy();
      let existingWorld = false;

      for (const item of itemsCopy) {
        if (item.isWorld) {
          existingWorld = true;
          log.info("World already exists at: " + item.projectPath);
        }
      }

      if (!existingWorld) {
        // Create a new world
        const wcf = await project.ensureWorldContainer();

        if (!wcf || !project.projectFolder) {
          log.error("Could not create world container or project folder is missing.");
          context.setExitCode(ErrorCodes.INIT_ERROR);
          return;
        }

        if (wcf && project.projectFolder) {
          // Create a new folder for the world
          let destF = project.projectFolder;
          const targetName = destF.name;

          // If only an output folder is specified, put the world there
          // If an input and an output folder is specified, put the world at a subfolder of the input folder
          if (context.outputFolder) {
            let targetFolder = context.outputFolder;

            if (context.inputFolder && targetFolder.startsWith(context.inputFolder)) {
              targetFolder = targetFolder.substring(context.inputFolder.length);
            }

            if (targetFolder.length > 2) {
              destF = await wcf.ensureFolderFromRelativePath(StorageUtilities.ensureEndsDelimited(targetFolder));
            }
          }

          if (!destF) {
            log.error("Could not determine destination folder for world.");
            context.setExitCode(ErrorCodes.INIT_ERROR);
            return;
          }

          if (destF) {
            let path = destF.getFolderRelativePath(project.projectFolder);

            if (!path) {
              log.error("Could not determine relative path for world folder.");
              context.setExitCode(ErrorCodes.INIT_ERROR);
              return;
            }

            if (path) {
              path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

              const pi = project.ensureItemByProjectPath(
                path,
                ProjectItemStorageType.folder,
                targetName,
                ProjectItemType.worldFolder,
                FolderContext.world
              );

              if (!pi.isContentLoaded) {
                await pi.loadContent();
              }

              // Set up and display world
              if (pi.isWorld) {
                const mcworld: MCWorld | undefined = await pi.getManager();

                if (mcworld) {
                  await mcworld.loadMetaFiles(false);

                  if (mcworld.name === "" && mcworld.storageFullPath) {
                    mcworld.name = StorageUtilities.getBaseFromName(
                      StorageUtilities.getLeafName(mcworld.storageFullPath)
                    );
                  }

                  log.info("Created world at '" + mcworld.storageFullPath + "'");
                  log.info("World name: " + mcworld.name);
                  log.info("World path: " + pi.projectPath);
                }
              }
            }
          }
        }
      }
    }

    return;
  }
}

export const ensureWorldCommand = new EnsureWorldCommand();
