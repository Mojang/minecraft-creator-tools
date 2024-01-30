import Project from "../app/Project";

export enum ProjectEditorMode {
  properties,
  inspector,
  minecraftToolSettings,
  activeItem,
  cartoSettings,
  minecraft,
}

export default class ProjectEditorUtilities {
  static convertStoragePathToBrowserSafe(path: string) {
    path = path.replace(/#/gi, "|");

    return path;
  }
  static convertStoragePathFromBrowserSafe(path: string) {
    path = path.replace(/\|/gi, "#");

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
}
