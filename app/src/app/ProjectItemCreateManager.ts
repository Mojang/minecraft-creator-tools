// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project, { FolderContext } from "./Project";
import ProjectContent from "./ProjectContent";
import { ProjectScriptLanguage } from "./IProjectData";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "./IProjectItemData";
import StorageUtilities from "./../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import IProjectItemSeed from "./IProjectItemSeed";
import ProjectItemUtilities from "./ProjectItemUtilities";
import IFolder from "../storage/IFolder";
import ProjectAutogeneration from "./ProjectAutogeneration";
import ProjectItem from "./ProjectItem";
import Database from "../minecraft/Database";
import Log from "../core/Log";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import IFile from "../storage/IFile";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import IGalleryItem, { GalleryItemType } from "./IGalleryItem";
import ProjectUtilities, { NewEntityTypeAddMode } from "./ProjectUtilities";
import ImageEditsDefinition from "../design/ImageEditsDefinition";
import IImageEdits from "../design/IImageEdits";

/// Does create operations for project items.

export default class ProjectItemCreateManager {
  private static async _getDefaultBehaviorPackPath(project: Project) {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = bpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  private static async _getDefaultBehaviorPackFolderPath(project: Project, name: string) {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const subfolder = bpFolder.ensureFolder(name);
    await subfolder.ensureExists();

    const defaultPath = subfolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  private static async _getDefaultDesignPackFolderPath(project: Project, name: string) {
    const dpFolder = await project.ensureDefaultDesignPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const subfolder = dpFolder.ensureFolder(name);
    await subfolder.ensureExists();

    const defaultPath = subfolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  private static async _getDefaultResourcePackPath(project: Project) {
    const rpFolder = await project.ensureDefaultResourcePackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = rpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  private static async _getDefaultResourcePackFolderPath(project: Project, name: string) {
    const rpFolder = await project.ensureDefaultResourcePackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const subfolder = rpFolder.ensureFolder(name);
    await subfolder.ensureExists();

    const defaultPath = subfolder.getFolderRelativePath(project.projectFolder);

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

  static async createNewItem(project: Project, itemSeed: IProjectItemSeed): Promise<ProjectItem | undefined> {
    if (itemSeed.name === "" || itemSeed.name === undefined) {
      itemSeed.name = ProjectItemUtilities.getNewItemName(itemSeed.itemType);
    }
    let creationData = itemSeed.creationData;

    if (creationData) {
      creationData = ProjectUtilities.getReplacedCreationDataInObject(project, creationData, itemSeed.name);
    }

    if (itemSeed.itemType) {
      switch (itemSeed.itemType) {
        case ProjectItemType.js:
        case ProjectItemType.ts:
          return ProjectItemCreateManager.createNewScript(project, itemSeed.itemType, itemSeed.name, itemSeed.folder);

        case ProjectItemType.dataForm:
          return ProjectItemCreateManager.createNewForm(project, itemSeed.name, itemSeed.folder);

        case ProjectItemType.audio:
          return ProjectItemCreateManager.createNewAudio(project, itemSeed.name, itemSeed.folder);

        case ProjectItemType.texture:
          return ProjectItemCreateManager.createNewTexture(project, itemSeed.name, itemSeed.folder);

        case ProjectItemType.designTexture:
          return ProjectItemCreateManager.createNewDesignTexture(project, itemSeed.name, itemSeed.folder, creationData);
      }
    }

    if (ProjectItemUtilities.isBehaviorRelated(itemSeed.itemType)) {
      return await ProjectItemCreateManager.createBehaviorPackJsonItem(project, itemSeed);
    } else if (ProjectItemUtilities.isResourceRelated(itemSeed.itemType)) {
      return await ProjectItemCreateManager.createResourcePackJsonItem(project, itemSeed);
    } else if (ProjectItemUtilities.isDesignRelated(itemSeed.itemType)) {
      return await ProjectItemCreateManager.createDesignPackJsonItem(project, itemSeed);
    }

    return undefined;
  }

  static async createNewScript(project: Project, itemType: ProjectItemType, name: string, folder: IFolder | undefined) {
    let defaultPath = undefined;

    if (folder && project.projectFolder) {
      defaultPath = folder.getFolderRelativePath(project.projectFolder);
    } else {
      defaultPath = await ProjectItemCreateManager._getDefaultScriptsFolderPath(project);
    }

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
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
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

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

        if (!containerFile.isContentLoaded) {
          await containerFile.loadContent();
        }

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

        if (!containerFile.isContentLoaded) {
          await containerFile.loadContent();
        }

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
    const defaultPath = await ProjectItemCreateManager._getDefaultBehaviorPackFolderPath(project, "scripts");

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      defaultPath,
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
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
        const tsFile = file.parentFolder.ensureFile(baseName + ".ts");

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
    const defaultPath = await this._getDefaultBehaviorPackFolderPath(project, "functions");

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      defaultPath,
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
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const content = "say hello";

      file.setContent(content);
    }

    await project.save();
  }

  static async createNewStructure(project: Project) {
    const defaultPath = await ProjectItemCreateManager._getDefaultBehaviorPackFolderPath(project, "structures");

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      defaultPath,
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
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const structureBytes = ProjectContent.generateDefaultStructure();

      if (structureBytes !== undefined) {
        file.setContent(structureBytes);
      }
    }

    await project.save();
  }

  static async createNewActionSet(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackFolderPath(project, "actions");

    if (defaultPath === undefined) {
      return;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      defaultPath,
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
      ProjectItemType.actionSet,
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyActionSet(project.name, baseName);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);
  }

  static async createNewDocumentedType(project: Project) {
    const defaultPath = await this._getDefaultBehaviorPackFolderPath(project, "docs");

    if (defaultPath === undefined) {
      return;
    }

    const candidateFolderPath = await ProjectItemCreateManager._generateFolderNameForNewItem(
      project,
      defaultPath,
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
      FolderContext.metaData,
      undefined,
      ProjectItemCreationType.normal
    );

    await pi.loadFolder();

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();
  }

  static getExistingPath(project: Project, itemType: ProjectItemType) {
    if (!project.projectFolder) {
      return undefined;
    }

    for (const item of project.items) {
      if (item.itemType === itemType && item.primaryFile) {
        return item.primaryFile.parentFolder.getFolderRelativePath(project.projectFolder);
      }
    }

    return undefined;
  }

  static async createNewForm(project: Project, name?: string, folder?: IFolder) {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    if (folder) {
      path = folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, ProjectItemType.dataForm);

      if (path === undefined) {
        path = await this._getDefaultBehaviorPackFolderPath(project, "forms");

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    if (!name) {
      name = "form";
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path,
      name,
      "form.json"
    );

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.dataForm,
      FolderContext.metaData,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const content = "{}";

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async ensureSoundDefinitionCatalogDefinition(
    project: Project
  ): Promise<SoundDefinitionCatalogDefinition | undefined> {
    const items = project.getItemsByType(ProjectItemType.soundDefinitionCatalog);

    if (items.length > 0) {
      if (!items[0].isContentLoaded) {
        await items[0].loadContent();
      }

      const itemFile = items[0].primaryFile;

      if (itemFile) {
        if (!itemFile.isContentLoaded) {
          await itemFile.loadContent();
        }

        if (!itemFile.content) {
          this.setFileToDefaultContent(itemFile);
        }

        return await SoundDefinitionCatalogDefinition.ensureOnFile(itemFile);
      }
    }

    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    path = await this._getDefaultResourcePackFolderPath(project, "sounds");

    if (path === undefined) {
      return undefined;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path,
      "sound_definitions",
      "json"
    );

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.soundDefinitionCatalog,
      FolderContext.resourcePack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file === null) {
      return undefined;
    }

    this.setFileToDefaultContent(file);

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return await SoundDefinitionCatalogDefinition.ensureOnFile(file);
  }

  static setFileToDefaultContent(file: IFile) {
    const content = '{\n   "format_version" : "1.20.20",\n   "sound_definitions" : {}\n}';

    file.setContent(content);
    file.saveContent();
  }

  static async addFromGallery(project: Project, newName: string, galleryItem: IGalleryItem) {
    if (galleryItem.type === GalleryItemType.entityType) {
      await ProjectUtilities.addEntityTypeFromGallery(
        project,
        galleryItem,
        newName,
        NewEntityTypeAddMode.baseId,
        async (message: string) => {
          Log.message(message);
        }
      );
    } else if (galleryItem.type === GalleryItemType.itemType) {
      await ProjectUtilities.addItemTypeFromGallery(project, galleryItem, newName);
    } else if (galleryItem.type === GalleryItemType.blockType) {
      await ProjectUtilities.addBlockTypeFromGallery(project, galleryItem, newName);
    } else if (galleryItem.type >= GalleryItemType.spawnLootRecipes && galleryItem.targetType) {
      await ProjectItemCreateManager.createNewItem(project, {
        itemType: galleryItem.targetType,
        contentTemplateName: galleryItem.id,
        name: newName,
        folder: undefined,
      });
    }
  }

  static async ensureSoundCatalogDefinition(project: Project): Promise<SoundCatalogDefinition | undefined> {
    const items = project.getItemsByType(ProjectItemType.soundCatalog);

    if (items.length > 0) {
      if (!items[0].isContentLoaded) {
        await items[0].loadContent();
      }

      if (items[0].primaryFile) {
        return await SoundCatalogDefinition.ensureOnFile(items[0].primaryFile);
      }
    }

    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    path = await this._getDefaultResourcePackFolderPath(project, "sounds");

    if (path === undefined) {
      return undefined;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path,
      "sounds",
      "json"
    );

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      ProjectItemType.soundCatalog,
      FolderContext.resourcePack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file === null) {
      return undefined;
    }

    const content = "{\n}";

    file.setContent(content);

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return await SoundCatalogDefinition.ensureOnFile(file);
  }

  static async createDesignPackJsonItem(
    project: Project,
    itemSeed: IProjectItemSeed
  ): Promise<ProjectItem | undefined> {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    const folderRootsForType = ProjectItemUtilities.getFolderRootsForType(itemSeed.itemType);

    Log.assert(folderRootsForType.length > 0, "No folder roots for item type: " + itemSeed.itemType);

    if (itemSeed.folder) {
      path = itemSeed.folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, itemSeed.itemType);

      if (path === undefined) {
        path = await this._getDefaultDesignPackFolderPath(project, folderRootsForType[0]);

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    let namespacedId = itemSeed.name;
    let name = namespacedId;

    if (!namespacedId || !name) {
      name = ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);
      namespacedId = name;
    }

    name = MinecraftUtilities.getNamespacedIdName(name);

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(project, path, name, "json");

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemSeed.itemType,
      FolderContext.designPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      let content = "{}";

      await Database.loadContent();

      if (Database.contentFolder !== null) {
        const contentTemplate = itemSeed.contentTemplateName
          ? itemSeed.contentTemplateName
          : ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);

        const sourceFile = await Database.contentFolder.getFileFromRelativePath(
          "/newitemjson/" + contentTemplate + ".json"
        );

        if (sourceFile) {
          if (!sourceFile.isContentLoaded) {
            await sourceFile.loadContent();
          }

          if (sourceFile.content) {
            content = sourceFile.content.toString();
          }
        }
      }

      content = content.replace(/examplens:examplename/g, namespacedId);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async createBehaviorPackJsonItem(
    project: Project,
    itemSeed: IProjectItemSeed
  ): Promise<ProjectItem | undefined> {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    const folderRootsForType = ProjectItemUtilities.getFolderRootsForType(itemSeed.itemType);

    Log.assert(folderRootsForType.length > 0, "No folder roots for item type: " + itemSeed.itemType);

    if (itemSeed.folder) {
      path = itemSeed.folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, itemSeed.itemType);

      if (path === undefined) {
        path = await this._getDefaultBehaviorPackFolderPath(project, folderRootsForType[0]);

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    let namespacedId = itemSeed.name;
    let name = namespacedId;

    if (!namespacedId || !name) {
      name = ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);
      namespacedId = name;
    }

    name = MinecraftUtilities.getNamespacedIdName(name);

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(project, path, name, "json");

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemSeed.itemType,
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      let content = "{}";

      await Database.loadContent();

      if (Database.contentFolder !== null) {
        const contentTemplate = itemSeed.contentTemplateName
          ? itemSeed.contentTemplateName
          : ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);

        const sourceFile = await Database.contentFolder.getFileFromRelativePath(
          "/newitemjson/" + contentTemplate + ".json"
        );

        if (sourceFile) {
          if (!sourceFile.isContentLoaded) {
            await sourceFile.loadContent();
          }

          if (sourceFile.content) {
            content = sourceFile.content.toString();
          }
        }
      }

      content = content.replace(/examplens:examplename/g, namespacedId);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async createResourcePackJsonItem(
    project: Project,
    itemSeed: IProjectItemSeed
  ): Promise<ProjectItem | undefined> {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    const folderRootsForType = ProjectItemUtilities.getFolderRootsForType(itemSeed.itemType);

    Log.assert(folderRootsForType.length > 0, "No folder roots for item type: " + itemSeed.itemType);

    if (itemSeed.folder) {
      path = itemSeed.folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, itemSeed.itemType);

      if (path === undefined) {
        path = await this._getDefaultResourcePackFolderPath(project, folderRootsForType[0]);

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    let namespacedId = itemSeed.name;
    let name = namespacedId;

    if (!namespacedId || !name) {
      name = ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);
      namespacedId = name;
    }

    name = MinecraftUtilities.getNamespacedIdName(name);

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(project, path, name, "json");

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemSeed.itemType,
      FolderContext.resourcePack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      let content = "{}";

      await Database.loadContent();

      if (Database.contentFolder !== null) {
        const contentTemplate = itemSeed.contentTemplateName
          ? itemSeed.contentTemplateName
          : ProjectItemUtilities.getNewItemTechnicalName(itemSeed.itemType);

        const sourceFile = await Database.contentFolder.getFileFromRelativePath(
          "/newitemjson/" + contentTemplate + ".json"
        );

        if (sourceFile) {
          if (!sourceFile.isContentLoaded) {
            await sourceFile.loadContent();
          }

          if (sourceFile.content) {
            content = sourceFile.content.toString();
          }
        }
      }

      content = content.replace(/examplens:examplename/g, namespacedId);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async createNewResourcePackBinaryItem(
    project: Project,
    sourceFileName: string,
    extension: string,
    defaultFolderPath: string,
    exampleName: string,
    itemType: ProjectItemType,
    name?: string,
    folder?: IFolder
  ): Promise<ProjectItem | undefined> {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    await Database.loadContent();

    if (Database.contentFolder === null) {
      Log.unexpectedContentState();
      return undefined;
    }

    const sourceFile = Database.contentFolder.ensureFile(sourceFileName);

    if (!sourceFile.isContentLoaded) {
      await sourceFile.loadContent();
    }

    if (!(sourceFile.content instanceof Uint8Array)) {
      Log.error("Could not find source " + extension + " file content.");
      return;
    }

    if (folder) {
      path = folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, itemType);

      if (path === undefined) {
        path = await this._getDefaultResourcePackFolderPath(project, defaultFolderPath);

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    if (!name) {
      name = exampleName;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path,
      name,
      extension
    );

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemType,
      FolderContext.resourcePack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      file.setContent(sourceFile.content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async createNewDesignPackBinaryItem(
    project: Project,
    sourceFileName: string,
    extension: string,
    defaultFolderPath: string,
    exampleName: string,
    itemType: ProjectItemType,
    name?: string,
    folder?: IFolder
  ): Promise<ProjectItem | undefined> {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return undefined;
    }

    await Database.loadContent();

    if (Database.contentFolder === null) {
      Log.unexpectedContentState();
      return undefined;
    }

    const sourceFile = Database.contentFolder.ensureFile(sourceFileName);

    if (!sourceFile.isContentLoaded) {
      await sourceFile.loadContent();
    }

    if (!(sourceFile.content instanceof Uint8Array)) {
      Log.error("Could not find source " + extension + " file content.");
      return;
    }

    if (folder) {
      path = folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, itemType);

      if (path === undefined) {
        path = await this._getDefaultDesignPackFolderPath(project, defaultFolderPath);

        if (path === undefined) {
          return undefined;
        }
      }
    }

    if (!path) {
      return undefined;
    }

    if (!name) {
      name = exampleName;
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path,
      name,
      extension
    );

    if (candidateFilePath === undefined) {
      return undefined;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      StorageUtilities.getLeafName(candidateFilePath),
      itemType,
      FolderContext.designPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      file.setContent(sourceFile.content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();

    return pi;
  }

  static async createNewDesignTexture(
    project: Project,
    name?: string,
    folder?: IFolder,
    creationData?: object
  ): Promise<ProjectItem | undefined> {
    const projectItem = await this.createNewDesignPackBinaryItem(
      project,
      "blank64.png",
      "png",
      "design_textures",
      "design_texture",
      ProjectItemType.designTexture,
      name,
      folder
    );

    if (projectItem && creationData) {
      const imageEdits = await ImageEditsDefinition.ensureAsAccessoryOnImageProjectItem(projectItem);

      if (imageEdits) {
        await imageEdits.setFromCreationData(creationData as IImageEdits);
      }
    }

    return projectItem;
  }
  static async createNewTexture(project: Project, name?: string, folder?: IFolder): Promise<ProjectItem | undefined> {
    return await this.createNewResourcePackBinaryItem(
      project,
      "blank64.png",
      "png",
      "textures",
      "texture",
      ProjectItemType.texture,
      name,
      folder
    );
  }

  static async createNewAudio(project: Project, name?: string, folder?: IFolder): Promise<ProjectItem | undefined> {
    return await this.createNewResourcePackBinaryItem(
      project,
      "blank.ogg",
      "ogg",
      "sounds",
      "sound",
      ProjectItemType.audio,
      name,
      folder
    );
  }

  static async createNewWorldTest(project: Project, name?: string, folder?: IFolder) {
    let path: string | undefined = undefined;

    if (!project.projectFolder) {
      return;
    }

    if (folder) {
      path = folder.getFolderRelativePath(project.projectFolder);
    } else {
      path = ProjectItemCreateManager.getExistingPath(project, ProjectItemType.dataForm);

      if (path === undefined) {
        path = await this._getDefaultBehaviorPackFolderPath(project, "forms");

        if (path === undefined) {
          return;
        }
      }
    }

    if (!path) {
      return;
    }

    if (!name) {
      name = "form";
    }

    const candidateFilePath = await ProjectItemCreateManager._generateFileNameForNewItem(
      project,
      path + "tests/",
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
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const baseName = StorageUtilities.getBaseFromName(file.name);

      const content = ProjectContent.getEmptyWorldTest(project.name, baseName);

      file.setContent(content);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project);

    await project.save();
  }
}
