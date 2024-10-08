// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "./Project";
import ProjectContent from "./ProjectContent";
import { ProjectScriptLanguage } from "./IProjectData";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "./IProjectItemData";
import StorageUtilities from "./../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import IProjectItemSeed from "./IProjectItemSeed";
import ProjectItemUtilities from "./ProjectItemUtilities";
import IFolder from "../storage/IFolder";
import ProjectAutogeneration from "./ProjectAutogeneration";

export default class ProjectItemManager {
  private static async _getDefaultBehaviorPackPath(project: Project) {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = bpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }
  private static async _getDefaultScriptsFolderPath(project: Project) {
    const scriptsFolder = await project.ensureMainScriptsFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = scriptsFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  static async createNewItem(project: Project, itemSeed: IProjectItemSeed) {
    if (itemSeed.name === "" || itemSeed.name === undefined) {
      itemSeed.name = ProjectItemUtilities.getNewItemName(itemSeed.itemType);
    }

    if (itemSeed.itemType) {
      switch (itemSeed.itemType) {
        case ProjectItemType.js:
        case ProjectItemType.ts:
          return ProjectItemManager.createNewScript(project, itemSeed.itemType, itemSeed.name, itemSeed.folder);
      }
    }

    return undefined;
  }

  static async createNewScript(project: Project, itemType: ProjectItemType, name: string, folder: IFolder | undefined) {
    let defaultPath = undefined;

    if (folder && project.projectFolder) {
      defaultPath = folder.getFolderRelativePath(project.projectFolder);
    } else {
      defaultPath = await ProjectItemManager._getDefaultScriptsFolderPath(project);
    }

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath,
      name,
      itemType === ProjectItemType.js ? "js" : "ts"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemType === ProjectItemType.js ? ProjectItemType.js : ProjectItemType.ts,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
        file.setContent(ProjectContent.getEmptyTypeScript(project.name, baseName));
      } else {
        file.setContent(ProjectContent.getEmptyJavaScript(project.name, baseName));
      }
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);
    await project.save();

    return pi;
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

    candidateFilePath = basePath + baseName + "." + extension;
    candidateFile = await targetFolder.getFileFromRelativePath(candidateFilePath);

    if (candidateFile) {
      // find a filename not in use
      do {
        index++;
        candidateFilePath = basePath + baseName + index + "." + extension;
        candidateFile = await targetFolder.getFileFromRelativePath(candidateFilePath);
      } while (candidateFile !== null && candidateFile !== undefined);
    }

    return finalPathPrefix + candidateFilePath;
  }

  static async createNewGameTestScript(project: Project) {
    const defaultPath = await ProjectItemManager._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,

      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.testJs,
      undefined,
      ProjectItemCreationType.normal
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
    const defaultPath = await this._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,

      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.MCFunction,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const content = "say hello";

      file.setContent(content);
    }

    await project.save();
  }

  static async createNewStructure(project: Project) {
    const defaultPath = await ProjectItemManager._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.structure,
      undefined,
      ProjectItemCreationType.normal
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

  static async createNewActionSet(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackPath(project);

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemManager._generateFileNameForNewItem(
      project,
      defaultPath + "scripts/",
      "actionset",
      "json"
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.actionSetJson,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyActionSet(project.name, baseName);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);
  }

  static async createNewDocumentedType(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFolderPath,
      ProjectItemStorageType.folder,
      candidateFolderPath,
      ProjectItemType.documentedTypeFolder,
      undefined,
      ProjectItemCreationType.normal
    );

    await pi.ensureFolderStorage();

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();
  }

  static async createNewForm(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.worldTest,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const content = "{}";

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();
  }

  static async createNewWorldTest(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackPath(project);

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

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.worldTest,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyWorldTest(project.name, baseName);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();
  }
}
