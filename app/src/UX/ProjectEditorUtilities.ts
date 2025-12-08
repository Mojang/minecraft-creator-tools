import CreatorTools from "../app/CreatorTools";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import Project, { FolderContext } from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import ProjectItem from "../app/ProjectItem";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectUtilities from "../app/ProjectUtilities";
import Utilities from "../core/Utilities";
import BlockbenchModel from "../integrations/BlockbenchModel";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import { PackType } from "../minecraft/Pack";
import FileSystemFolder from "../storage/FileSystemFolder";
import FileSystemStorage from "../storage/FileSystemStorage";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";

export const MaxModeActions = 7;

export enum ProjectEditorItemAction {
  downloadBlockbenchModel,
  deleteItem,
  renameItem,
  viewAsJson,
  viewOnMap,
  download,
  focus,
  unfocus,
}

export enum ProjectItemEditorView {
  singleFileEditor = 0,
  diff = 1,
  singleFileRaw = 2,
  map = 3,
}

export enum ProjectEditorMode {
  properties,
  inspector,
  minecraftToolSettings,
  activeItem,
  cartoSettings,
  minecraft,
  actions,
  map,
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
      case ProjectEditorMode.map:
        return "map";
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

  static getItemMenuItems(projectItem: ProjectItem, focusFilterPath: string | undefined) {
    let path = "";

    if (projectItem.projectPath !== null && projectItem.projectPath !== undefined) {
      path = projectItem.projectPath;
    }

    const itemMenu = [
      {
        key: "focusMenu|" + path,
        content: focusFilterPath === projectItem.projectPath ? "Clear focus" : "Focus",
        tag: {
          path: projectItem.projectPath,
          action:
            focusFilterPath === projectItem.projectPath
              ? ProjectEditorItemAction.unfocus
              : ProjectEditorItemAction.focus,
        },
      },
      {
        key: "download|" + path,
        content: "Download",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.download },
      },
      {
        key: "rename|" + path,
        content: "Rename",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.renameItem },
      },
      {
        key: "delete|" + path,
        content: "Delete",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.deleteItem },
      },
    ];

    if (projectItem.itemType === ProjectItemType.modelGeometryJson) {
      itemMenu.push({
        key: "downloadBbmodel|" + path,
        content: "Download Blockbench Model",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.downloadBlockbenchModel },
      });
    }

    if (StorageUtilities.getTypeFromName(path) === "json") {
      itemMenu.push({
        key: "viewAsJson|" + path,
        content: "View as JSON",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewAsJson },
      });
    }

    itemMenu.push({
      key: "viewAsMap|" + path,
      content: "View on map",
      tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewOnMap },
    });

    return itemMenu;
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

  public static async launchFlatWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const operId = await creatorTools.notifyOperationStarted("Starting export of flat world with packs.");

    const projName = await project.loc.getTokenValue(project.name);

    const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;

    const name = nameCore + " Flat";
    const fileName = nameCore + "-flatpack.mcworld";

    await creatorTools.notifyStatusUpdate("Packing " + fileName);

    const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(creatorTools, project, name);

    if (!newBytes) {
      await creatorTools.notifyOperationEnded(operId);
      return;
    }

    await creatorTools.notifyStatusUpdate("Now downloading " + fileName);

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as BlobPart], { type: "application/octet-stream" }), fileName);
    }

    await creatorTools.notifyOperationEnded(operId, "Done with save " + fileName);
  }

  public static async launchWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcworld";

    const mcworld = await ProjectExporter.generateWorldWithPacks(creatorTools, project, project.ensureWorldSettings());

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as BlobPart], { type: "application/octet-stream" }), fileName);
    }

    await creatorTools.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  /**
   * Extracts the contents of a zip-based file (mcworld, mcaddon, mcpack, mctemplate, mcproject, zip)
   * directly to the project root folder, rather than saving the zip file as-is.
   */
  static async extractZipContentsToProject(project: Project, file: File) {
    if (!project.projectFolder) {
      return;
    }

    if (!StorageUtilities.isContainerFile(file.name)) {
      return;
    }

    const operId = await project.creatorTools.notifyOperationStarted(
      "Extracting '" + file.name + "' contents to project"
    );

    const buffer = await file.arrayBuffer();

    // Load the zip contents
    const zipStorage = new ZipStorage();
    await zipStorage.loadFromUint8Array(new Uint8Array(buffer), file.name);

    // Extract contents to project root folder
    await StorageUtilities.syncFolderTo(
      zipStorage.rootFolder,
      project.projectFolder,
      true, // forceFolders
      true, // forceFileUpdates
      false // removeOnTarget - don't remove existing files
    );

    // Re-infer project items from the extracted contents
    await project.inferProjectItemsFromFilesRootFolder(true);

    await project.creatorTools.notifyOperationEnded(operId, "'" + file.name + "' contents extracted to project");
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
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcproject") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mctemplate") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcaddon") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "zip") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcpack") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "ogg" || extension === "mp3" || extension === "wav") {
      return "Add '" + file.name + "' as new sound";
    } else if (extension === "mcstructure") {
      return "Add '" + file.name + "' as new structure";
    } else if (extension === "bbmodel") {
      let descrip = "Integrate '" + file.name + "' as a model ";

      if (content && typeof content === "string") {
        const bd = BlockbenchModel.ensureFromContent(content);

        if (bd.id) {
          descrip += "(" + bd.id + ")";
        }

        if (bd.data?.animations) {
          descrip += ", animations ";

          if (bd.data && bd.data.animations) {
            const name = MinecraftUtilities.removeSubTypeExtensionFromName(bd.data.name);

            descrip += "(" + name + ".animation.json";
            descrip += ") ";
          }
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
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      const buffer = await file.arrayBuffer();

      const contentFile = folder.ensureFile(file.name);

      if (contentFile.setContentIfSemanticallyDifferent(new Uint8Array(buffer))) {
        await contentFile.saveContent();
      }
    } else if (extension === "snbt") {
      const operId = await project.creatorTools.notifyOperationStarted(
        "Saving new SNBT structure file '" + file.name + "'"
      );

      const text = await file.text();

      const folder = project.projectFolder.ensureFolder("packs");
      const contentFile = folder.ensureFile(file.name);

      if (contentFile.setContentIfSemanticallyDifferent(text)) {
        await contentFile.saveContent();
      }

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.structure,
          FolderContext.behaviorPack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(operId, "New SNBT structure file '" + file.name + "' added");
    } else if (extension === "mcworld") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCWorld file '" + file.name + "'");

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
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCWorld file '" + file.name + "' added");
    } else if (extension === "mcproject") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCProject file '" + file.name + "'");

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
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCProject file '" + file.name + "' added");
    } else if (extension === "mctemplate") {
      const operId = await project.creatorTools.notifyOperationStarted(
        "Saving new MCTemplate file '" + file.name + "'"
      );

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
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCTemplate file '" + file.name + "' added");
    } else if (extension === "mcaddon") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCAddon file '" + file.name + "'");

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
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCAddon file '" + file.name + "' added");
    } else if (extension === "zip") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new zip file '" + file.name + "'");

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
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New zip file '" + file.name + "' added");
    } else if (extension === "mcpack") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCPack file '" + file.name + "'");

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
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCPack file '" + file.name + "' added");
    } else if (extension === "mcstructure") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new structure file '" + file.name + "'");

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
          FolderContext.behaviorPack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(operId, "New structure file '" + file.name + "' added");
    } else if (extension === "mp3" || extension === "ogg" || extension === "flac" || extension === "wav") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new audio file '" + file.name + "'");

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
          FolderContext.resourcePack,
          undefined,
          ProjectItemCreationType.normal
        );

        await MinecraftDefinitions.ensureFoundationalDependencies(item);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New audio file '" + file.name + "' added");
    } else if (extension === "json") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new JSON file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const item = await ProjectUtilities.ensureJsonItem(project, jsonContentStr, fileName);

      let description = "";

      if (item) {
        description = " as " + ProjectItemUtilities.getDescriptionForType(item.itemType) + " to " + item.projectPath;
      }

      await project.creatorTools.notifyOperationEnded(operId, "New JSON file '" + file.name + "' added" + description);
    } else if (extension === "bbmodel") {
      const operId = await project.creatorTools.notifyOperationStarted("Integrating bbmodel file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const bbm = BlockbenchModel.ensureFromContent(jsonContentStr);

      bbm.integrateIntoProject(project);

      await project.creatorTools.notifyOperationEnded(operId, "Integrated bbmodel '" + file.name + "'.");
    } else if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "tga") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new texture file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const rpFolder = await project.ensureDefaultResourcePackFolder();

      let folder: IFolder;
      let targetFileName = file.name;

      // Check if path contains a vanilla override path (e.g., "/resource_pack/textures/entity/skeleton.png")
      if (path && path.length > 1 && path.includes("/textures/")) {
        // Use the vanilla path structure within the resource pack
        let vanillaPath = StorageUtilities.ensureStartsWithDelimiter(path);

        // Strip leading pack folder prefixes (e.g., "/resource_pack/" or "/behavior_pack/")
        // since we're already placing the file in the resource pack folder
        vanillaPath = vanillaPath.replace(/^\/(resource_pack|behavior_pack)\//i, "/");

        const folderPath = StorageUtilities.getFolderPath(vanillaPath);
        targetFileName = StorageUtilities.getLeafName(vanillaPath);

        // Ensure the folder path exists (e.g., "textures/entity")
        folder = await rpFolder.ensureFolderFromRelativePath(folderPath);
      } else {
        // Default: just put in textures folder
        folder = rpFolder.ensureFolder("textures");
      }

      const contentFile = folder.ensureFile(targetFileName);
      contentFile.setContent(new Uint8Array(buffer));
      await contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          targetFileName,
          ProjectItemType.texture,
          FolderContext.resourcePack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(
        operId,
        "New texture file '" + targetFileName + "' added" + (path && path.length > 1 ? " at " + path : "")
      );
    }
  }

  public static async launchEditorWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcproject";

    const mcworld = await ProjectExporter.generateWorldWithPacks(
      creatorTools,
      project,
      project.ensureEditorWorldSettings()
    );

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as any], { type: "application/octet-stream" }), fileName);
    }

    await creatorTools.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  public static async launchLocalExport(creatorTools: CreatorTools, project: Project) {
    if (project === null || project.projectFolder === null) {
      return;
    }
    try {
      const result = (await window.showDirectoryPicker({
        mode: "readwrite",
      })) as FileSystemDirectoryHandle | undefined;

      if (result) {
        const storage = new FileSystemStorage(result);

        const operId = await creatorTools.notifyOperationStarted("Exporting project to  '" + result.name + "'");

        const safeMessage = await (storage.rootFolder as FileSystemFolder).getFirstUnsafeError();

        if (safeMessage) {
          await creatorTools.notifyOperationEnded(
            operId,
            "Could not export to a folder on your device: " + safeMessage
          );
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
              await creatorTools.notifyStatusUpdate(message);
            },
            true
          );

          await creatorTools.notifyStatusUpdate("Saving all files to '" + result.name + "'.");
          await storage.rootFolder.saveAll();
          await creatorTools.notifyOperationEnded(operId, "Export completed.");
        }
      }
    } catch (e) {
      // likely an AbortError, which is the user canceling the dialog.
    }
  }

  public static async launchZipExport(creatorTools: CreatorTools, project: Project) {
    if (project == null) {
      return;
    }
    const projName = await project.loc.getTokenValue(project.name);

    const operId = await creatorTools.notifyOperationStarted("Exporting '" + projName + "' as zip.");

    const zipStorage = new ZipStorage();

    const projectFolder = await project.ensureLoadedProjectFolder();

    await StorageUtilities.syncFolderTo(projectFolder, zipStorage.rootFolder, true, true, false);

    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    await creatorTools.notifyOperationEnded(operId, "Export zip of '" + projName + "' created; downloading.");

    saveAs(zipBinary, projName + ".zip");
  }
}
