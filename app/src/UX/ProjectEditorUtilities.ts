import Carto from "../app/Carto";
import Project from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import Utilities from "../core/Utilities";
import FileSystemFolder from "../storage/FileSystemFolder";
import FileSystemStorage from "../storage/FileSystemStorage";
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
    carto.notifyStatusUpdate("Starting export");

    const projName = await project.loc.getTokenValue(project.name);

    const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;

    const name = nameCore + " Flat GameTest";
    const fileName = nameCore + "-flatpack.mcworld";

    carto.notifyStatusUpdate("Packing " + fileName);

    const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(carto, project, name);

    carto.notifyStatusUpdate("Now downloading " + fileName);

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    carto.notifyStatusUpdate("Done with save " + fileName);
  }

  public static async launchProjectWorldWithPacksDownload(carto: Carto, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + "-project.mcworld";

    carto.notifyStatusUpdate("Packing " + fileName);

    const mcworld = await ProjectExporter.generateProjectWorld(carto, project, project.ensureWorldSettings());

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    carto.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
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
          async (message: string) => {
            await carto.notifyStatusUpdate(message);
          }
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
