import Carto from "../app/Carto";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import Project from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectUtilities from "../app/ProjectUtilities";
import Utilities from "../core/Utilities";
import BlockbenchModel from "../integrations/BlockbenchModel";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import { PackType } from "../minecraft/Pack";
import FileSystemFolder from "../storage/FileSystemFolder";
import FileSystemStorage from "../storage/FileSystemStorage";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";

export const MaxModeActions = 7;
export enum ProjectEditorMode {
  properties,
  inspector,
  minecraftToolSettings,
  activeItem,
  cartoSettings,
  minecraft,
  actions,
}

export enum ProjectEditorAction {
  worldPropertiesDialog,
  projectListUp,
  projectListDown,
  projectListCommit,
}

export default class ProjectEditorUtilities {
  static convertStoragePathToBrowserSafe(path: string) {
    path = path.replace(/#/gi, "|");

    return path;
  }

  static convertStoragePathFromBrowserSafe(path: string) {
    path = path.replace(/\|/gi, "#");
    path = decodeURI(path);

    return path;
  }

  static getProjectEditorModeString(mode: ProjectEditorMode) {
    switch (mode) {
      case ProjectEditorMode.activeItem:
        return "activeitem";
      case ProjectEditorMode.properties:
        return "properties";
      case ProjectEditorMode.inspector:
        return "inspector";
      case ProjectEditorMode.actions:
        return "actions";
      case ProjectEditorMode.cartoSettings:
        return "appsettings";
      case ProjectEditorMode.minecraft:
        return "minecraft";
      case ProjectEditorMode.minecraftToolSettings:
        return "minecrafttoolsettings";
    }
  }

  static getProjectEditorFromString(modeString: string) {
    switch (modeString.toLowerCase().trim()) {
      case "activeitem":
        return ProjectEditorMode.activeItem;
      case "properties":
        return ProjectEditorMode.properties;
      case "inspector":
        return ProjectEditorMode.inspector;
      case "actions":
        return ProjectEditorMode.actions;
      case "appsettings":
        return ProjectEditorMode.cartoSettings;
      case "minecraft":
        return ProjectEditorMode.minecraft;
      case "minecrafttoolsettings":
        return ProjectEditorMode.minecraftToolSettings;

      default:
        return undefined;
    }
  }

  static getIsLinkShareable(proj: Project) {
    if (
      !(
        (proj.gitHubOwner && proj.gitHubRepoName) ||
        (proj.originalGitHubOwner !== undefined && proj.originalGitHubRepoName !== undefined)
      )
    ) {
      return false;
    }

    if (proj.projectCabinetFile) {
      return false;
    }

    for (let projectItem of proj.items) {
      if (projectItem.isFileContainerStorageItem) {
        return false;
      }
    }

    return true;
  }

  public static async launchFlatWorldWithPacksDownload(carto: Carto, project: Project) {
    const operId = await carto.notifyOperationStarted("Starting export of flat world with packs.");

    const projName = await project.loc.getTokenValue(project.name);

    const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;

    const name = nameCore + " Flat GameTest";
    const fileName = nameCore + "-flatpack.mcworld";

    await carto.notifyStatusUpdate("Packing " + fileName);

    const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(carto, project, name);

    if (!newBytes) {
      await carto.notifyOperationEnded(operId);
      return;
    }

    await carto.notifyStatusUpdate("Now downloading " + fileName);

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    await carto.notifyOperationEnded(operId, "Done with save " + fileName);
  }

  public static async launchWorldWithPacksDownload(carto: Carto, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcworld";

    const mcworld = await ProjectExporter.generateWorldWithPacks(carto, project, project.ensureWorldSettings());

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    await carto.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  static getIntegrateBrowserFileDefaultActionDescription(
    project: Project,
    path: string,
    file: File,
    content?: string | Uint8Array | undefined
  ) {
    if (!project.projectFolder) {
      return undefined;
    }

    const fileName = file.name.toLowerCase();
    const extension = StorageUtilities.getTypeFromName(file.name);

    if (
      fileName === "level.dat" ||
      extension === "db" ||
      fileName === "current" ||
      fileName.startsWith("manifest-") ||
      fileName === "level.dat_old" ||
      fileName === "levelname.txt" ||
      fileName.startsWith("world_")
    ) {
      return "Add as new world";
    } else if (extension === "snbt") {
      return "Add '" + file.name + "' as new structure";
    } else if (extension === "mcworld") {
      return "Add '" + file.name + "' as new world";
    } else if (extension === "mcproject") {
      return "Add '" + file.name + "' as new project";
    } else if (extension === "mctemplate") {
      return "Add '" + file.name + "' as new world template";
    } else if (extension === "mcaddon") {
      return "Add '" + file.name + "' as new addon pack";
    } else if (extension === "zip") {
      return "Add '" + file.name + "' as new folder";
    } else if (extension === "mcpack") {
      return "Add '" + file.name + "' as new pack folder";
    } else if (extension === "ogg" || extension === "mp3" || extension === "wav") {
      return "Add '" + file.name + "' as new sound";
    } else if (extension === "mcstructure") {
      return "Add '" + file.name + "' as new structure";
    } else if (extension === "bbmodel") {
      let descrip = "Integrate '" + file.name + "' as a model ";

      if (content && typeof content === "string") {
        const bd = BlockbenchModel.ensureFromContent(content);

        if (bd.id) {
          descrip += "(" + bd.id + ") ";
        }

        descrip += "and textures";

        if (bd.data && bd.data.textures) {
          descrip += " (";
          let first = true;

          for (const texture of bd.data.textures) {
            if (!first) {
              descrip += ", ";
            }

            descrip += texture.name;
            first = false;
          }

          descrip += ")";
        }
      } else {
        descrip += "and textures";
      }

      return descrip;
    } else if (extension === "json") {
      if (content && typeof content === "string") {
        const typeInfo = ProjectItemUtilities.inferTypeFromJsonContent(content, fileName);

        let packType = typeInfo.packType;

        if (packType === undefined) {
          packType = PackType.behavior;
        }

        const typeDescriptor = ProjectItemUtilities.getDescriptionForType(typeInfo.itemType);

        return "Add '" + file.name + "' as new " + typeDescriptor;
      } else {
        return "Add '" + file.name + "' as new  data file";
      }
    }

    return undefined;
  }

  static async integrateBrowserFileDefaultAction(project: Project, path: string, file: File) {
    if (!project.projectFolder) {
      return;
    }

    const pathCanon = path.toLowerCase();
    const fileName = file.name.toLowerCase();
    const extension = StorageUtilities.getTypeFromName(file.name);

    if (
      fileName === "level.dat" ||
      extension === "db" ||
      fileName === "current" ||
      fileName.startsWith("manifest-") ||
      fileName === "level.dat_old" ||
      fileName === "levelname.txt" ||
      fileName.startsWith("world_")
    ) {
      if (path.length < 2) {
        path = "/default";
      }

      if (pathCanon.indexOf("worlds") < 0) {
        path = StorageUtilities.joinPath("worlds", path);
      }

      path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

      const folder = await project.projectFolder.ensureFolderFromRelativePath(path);

      if (fileName === "level.dat") {
        project.ensureItemByProjectPath(
          path,
          ProjectItemStorageType.folder,
          folder.name,
          ProjectItemType.worldFolder,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      const buffer = await file.arrayBuffer();

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();
    } else if (extension === "snbt") {
      const operId = await project.carto.notifyOperationStarted("Saving new SNBT structure file '" + file.name + "'");

      const text = await file.text();

      const folder = project.projectFolder.ensureFolder("packs");
      const contentFile = folder.ensureFile(file.name);
      contentFile.setContent(text);
      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.structure,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.carto.notifyOperationEnded(operId, "New SNBT structure file '" + file.name + "' added");
    } else if (extension === "mcworld") {
      const operId = await project.carto.notifyOperationStarted("Saving new MCWorld file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("worlds");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCWorld,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New MCWorld file '" + file.name + "' added");
    } else if (extension === "mcproject") {
      const operId = await project.carto.notifyOperationStarted("Saving new MCProject file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("editorworlds");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCProject,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New MCProject file '" + file.name + "' added");
    } else if (extension === "mctemplate") {
      const operId = await project.carto.notifyOperationStarted("Saving new MCTemplate file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("templates");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCTemplate,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New MCTemplate file '" + file.name + "' added");
    } else if (extension === "mcaddon") {
      const operId = await project.carto.notifyOperationStarted("Saving new MCAddon file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("addons");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCAddon,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New MCAddon file '" + file.name + "' added");
    } else if (extension === "zip") {
      const operId = await project.carto.notifyOperationStarted("Saving new zip file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("zips");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.zip,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New zip file '" + file.name + "' added");
    } else if (extension === "mcpack") {
      const operId = await project.carto.notifyOperationStarted("Saving new MCPack file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("packs");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCPack,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.carto.notifyOperationEnded(operId, "New zip file '" + file.name + "' added");
    } else if (extension === "mcstructure") {
      const operId = await project.carto.notifyOperationStarted("Saving new structure file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const bpFolder = await project.ensureDefaultBehaviorPackFolder();

      const folder = bpFolder.ensureFolder("structures");

      const contentFile = folder.ensureFile(file.name);
      contentFile.setContent(new Uint8Array(buffer));
      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.structure,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.carto.notifyOperationEnded(operId, "New structure file '" + file.name + "' added");
    } else if (extension === "mp3" || extension === "ogg" || extension === "wav") {
      const operId = await project.carto.notifyOperationStarted("Saving new audio file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const rpFolder = await project.ensureDefaultResourcePackFolder();

      const folder = rpFolder.ensureFolder("sounds");

      const contentFile = folder.ensureFile(file.name);
      contentFile.setContent(new Uint8Array(buffer));
      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        const item = project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.audio,
          undefined,
          ProjectItemCreationType.normal
        );

        await MinecraftDefinitions.ensureFoundationalDependencies(item);
      }

      await project.carto.notifyOperationEnded(operId, "New audio file '" + file.name + "' added");
    } else if (extension === "json") {
      const operId = await project.carto.notifyOperationStarted("Saving new JSON file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const item = await ProjectUtilities.ensureJsonItem(project, jsonContentStr, fileName);

      let description = "";

      if (item) {
        description = " as " + ProjectItemUtilities.getDescriptionForType(item.itemType) + " to " + item.projectPath;
      }

      await project.carto.notifyOperationEnded(operId, "New JSON file '" + file.name + "' added" + description);
    } else if (extension === "bbmodel") {
      const operId = await project.carto.notifyOperationStarted("Integrating bbmodel file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const bbm = BlockbenchModel.ensureFromContent(jsonContentStr);

      bbm.integrateIntoProject(project);

      await project.carto.notifyOperationEnded(operId, "Integrated bbmodel '" + file.name + "'.");
    }
  }

  public static async launchEditorWorldWithPacksDownload(carto: Carto, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcproject";

    const mcworld = await ProjectExporter.generateWorldWithPacks(carto, project, project.ensureEditorWorldSettings());

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    await carto.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  public static async launchLocalExport(carto: Carto, project: Project) {
    if (project === null || project.projectFolder === null) {
      return;
    }

    const result = (await window.showDirectoryPicker({
      mode: "readwrite",
    })) as FileSystemDirectoryHandle | undefined;

    if (result) {
      const storage = new FileSystemStorage(result);

      const operId = await carto.notifyOperationStarted("Exporting project to  '" + result.name + "'");

      const safeMessage = await (storage.rootFolder as FileSystemFolder).getFirstUnsafeError();

      if (safeMessage) {
        await carto.notifyOperationEnded(operId, "Could not export to a folder on your device: " + safeMessage);
      } else {
        await StorageUtilities.syncFolderTo(
          project.projectFolder,
          storage.rootFolder,
          true,
          true,
          false,
          [],
          undefined,
          async (message: string) => {
            await carto.notifyStatusUpdate(message);
          },
          true
        );

        await storage.rootFolder.saveAll();
        await carto.notifyOperationEnded(operId, "Export completed.");
      }
    }
  }

  public static async launchZipExport(carto: Carto, project: Project) {
    if (project == null) {
      return;
    }
    const projName = await project.loc.getTokenValue(project.name);

    const operId = await carto.notifyOperationStarted("Exporting '" + projName + "' as zip.");

    const zipStorage = new ZipStorage();

    const projectFolder = await project.ensureLoadedProjectFolder();

    await StorageUtilities.syncFolderTo(projectFolder, zipStorage.rootFolder, true, true, false);

    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    await carto.notifyOperationEnded(operId, "Export zip of '" + projName + "' created; downloading.");

    saveAs(zipBinary, projName + ".zip");
  }
}
