import Project from "./Project";
import ProjectContent from "./ProjectContent";
import { ProjectScriptLanguage } from "./IProjectData";
import { ProjectItemStorageType, ProjectItemType } from "./IProjectItemData";
import StorageUtilities from "./../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";

export default class ProjectItemManager {
  private static async _getBaseBehaviorPackPath(project: Project) {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = bpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  static async createNewScript(project: Project) {
    const defaultPath = await ProjectItemManager._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "scripts/",
      "script",
      "js"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.js,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
        const tsFile = file.parentFolder.ensureFile(baseName + ".ts");

        if (tsFile !== null) {
          const content = ProjectContent.getEmptyTypeScript(project.name, baseName);

          tsFile.setContent(content);
        }
      }

      const content = ProjectContent.getEmptyJavaScript(project.name, baseName);

      file.setContent(content);
    }

    await project.updateAutogeneratedItems();
    await project.save();
  }

  static async _generateFolderNameForNewItem(project: Project, basePath: string, baseName: string) {
    if (project.projectFolder === null) {
      return undefined;
    }

    let index = 0;

    let candidateFolderPath = "";
    let finalPathPrefix = "";
    const projectFolder = project.projectFolder;
    let candidateFolder = null;

    let hash = basePath.indexOf("#");
    let targetFolder = projectFolder;

    while (hash > 0) {
      // dig into container files if needed.
      let containerFilePath = basePath.substring(0, hash);
      basePath = basePath.substring(hash + 1);
      hash = basePath.indexOf("#");

      if (containerFilePath.startsWith(targetFolder.fullPath)) {
        containerFilePath = containerFilePath.substring(targetFolder.fullPath.length);
      }

      finalPathPrefix += containerFilePath + "#";

      const containerFile = await targetFolder.getFileFromRelativePath(containerFilePath);

      if (!containerFile) {
        return undefined;
      }

      const extension = containerFile.type;

      if (extension !== "zip" && extension !== "mcworld" && extension !== "mctemplate") {
        return undefined;
      }

      if (!containerFile.fileContainerStorage) {
        const zipStorage = new ZipStorage();

        await containerFile.loadContent();

        if (!containerFile.content || !(containerFile.content instanceof Uint8Array)) {
          return undefined;
        }

        await zipStorage.loadFromUint8Array(containerFile.content, containerFile.name);
        containerFile.fileContainerStorage = zipStorage;
        containerFile.fileContainerStorage.storagePath = containerFilePath + "#";
      }

      targetFolder = containerFile.fileContainerStorage.rootFolder;
    }

    await targetFolder.ensureFolderFromRelativePath(basePath);
    await targetFolder.ensureExists();

    // find a folder name not in use
    do {
      index++;
      candidateFolderPath = basePath + baseName + index;
      candidateFolder = await targetFolder.getFolderFromRelativePath(candidateFolderPath);
    } while (candidateFolder !== null && candidateFolder !== undefined);

    return finalPathPrefix + candidateFolderPath;
  }

  static async _generateFileNameForNewItem(project: Project, basePath: string, baseName: string, extension: string) {
    if (project.projectFolder === null) {
      return undefined;
    }

    let index = 0;

    let candidateFilePath = "";
    let finalPathPrefix = "";
    const projectFolder = project.projectFolder;
    let candidateFile = null;

    let hash = basePath.indexOf("#");
    let targetFolder = projectFolder;

    while (hash > 0) {
      // dig into container files if needed.
      let containerFilePath = basePath.substring(0, hash);
      basePath = basePath.substring(hash + 1);
      hash = basePath.indexOf("#");

      if (containerFilePath.startsWith(targetFolder.fullPath)) {
        containerFilePath = containerFilePath.substring(targetFolder.fullPath.length);
      }

      finalPathPrefix += containerFilePath + "#";

      const containerFile = await targetFolder.getFileFromRelativePath(containerFilePath);

      if (!containerFile) {
        return undefined;
      }

      const extension = containerFile.type;

      if (extension !== "zip" && extension !== "mcworld" && extension !== "mctemplate") {
        return undefined;
      }

      if (!containerFile.fileContainerStorage) {
        const zipStorage = new ZipStorage();

        await containerFile.loadContent();

        if (!containerFile.content || !(containerFile.content instanceof Uint8Array)) {
          return undefined;
        }

        await zipStorage.loadFromUint8Array(containerFile.content);
        containerFile.fileContainerStorage = zipStorage;
        containerFile.fileContainerStorage.storagePath = containerFilePath + "#";
      }

      targetFolder = containerFile.fileContainerStorage.rootFolder;
    }

    await targetFolder.ensureFolderFromRelativePath(basePath);
    await targetFolder.ensureExists();

    // find a filename not in use
    do {
      index++;
      candidateFilePath = basePath + baseName + index + "." + extension;
      candidateFile = await targetFolder.getFileFromRelativePath(candidateFilePath);
    } while (candidateFile !== null && candidateFile !== undefined);

    return finalPathPrefix + candidateFilePath;
  }

  static async createNewGameTestScript(project: Project) {
    const defaultPath = await ProjectItemManager._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "scripts/",
      "test",
      "js"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,

      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.testJs,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
        const tsFile = await file.parentFolder.ensureFile(baseName + ".ts");

        if (tsFile !== null) {
          const content = ProjectContent.getEmptyTestTypeScript(project.name, baseName);

          tsFile.setContent(content);
        }
      }

      const content = ProjectContent.getEmptyTestJavaScript(project.name, baseName);

      file.setContent(content);
    }

    await project.save();
  }

  static async createNewFunction(project: Project) {
    const defaultPath = await this._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "functions/",
      "action",
      "mcfunction"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,

      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.MCFunction,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const content = "say hello";

      file.setContent(content);
    }

    await project.save();
  }

  static async createNewStructure(project: Project) {
    const defaultPath = await ProjectItemManager._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "structures/",
      "structure",
      "mcstructure"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.structure,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const structureBytes = ProjectContent.generateDefaultStructure();

      if (structureBytes !== undefined) {
        file.setContent(structureBytes);
      }
    }

    await project.save();
  }

  static async createNewAutoScript(project: Project) {
    const defaultPath = await this._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "scripts/",
      "autoscript",
      "json"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.autoScriptJson,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyAutoScript(project.name, baseName);

      file.setContent(content);
    }

    await project.updateAutogeneratedItems();
  }

  static async createNewDocumentedType(project: Project) {
    const defaultPath = await this._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFolderPath = await ProjectItemManager._generateFolderNameForNewItem(
      project,
      defaultPath + "docs/",
      "type"
    );

    if (candidateFolderPath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFolderPath,
      ProjectItemStorageType.folder,
      candidateFolderPath,
      ProjectItemType.documentedTypeFolder,
      undefined,
      false
    );

    await pi.ensureFolderStorage();

    await project.updateAutogeneratedItems();

    await project.save();
  }

  static async createNewForm(project: Project) {
    const defaultPath = await this._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "forms/",
      "form",
      "json"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.worldTest,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const content = "{}";

      file.setContent(content);
    }

    await project.updateAutogeneratedItems();

    await project.save();
  }

  static async createNewWorldTest(project: Project) {
    const defaultPath = await this._getBaseBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "scripts/",
      "worldtest",
      "json"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.worldTest,
      undefined,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyWorldTest(project.name, baseName);

      file.setContent(content);
    }

    await project.updateAutogeneratedItems();

    await project.save();
  }
}
