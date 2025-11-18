// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import StorageUtilities from "../storage/StorageUtilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import Project, { FolderContext } from "./Project";
import { ProjectItemType, ProjectItemStorageType, ProjectItemCreationType } from "./IProjectItemData";
import Database from "../minecraft/Database";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import { ProjectEditPreference, ProjectFocus, ProjectScriptLanguage } from "./IProjectData";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import NpmPackageDefinition from "../devproject/NpmPackageDefinition";
import ResourceManifestDefinition from "../minecraft/ResourceManifestDefinition";
import ISnippet from "./ISnippet";
import IGalleryItem from "./IGalleryItem";
import IFolder from "../storage/IFolder";
import ProjectItemUtilities from "./ProjectItemUtilities";
import { PackType } from "../minecraft/Pack";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import { IAnnotatedValue } from "../core/AnnotatedValue";
import ProjectItem from "./ProjectItem";
import ProjectUpdateRunner from "../updates/ProjectUpdateRunner";
import ProjectStandard from "./ProjectStandard";
import ProjectAutogeneration from "./ProjectAutogeneration";
import TypeScriptDefinition from "../minecraft/TypeScriptDefinition";
import { constants } from "../core/Constants";
import ProjectContent from "./ProjectContent";

export enum NewEntityTypeAddMode {
  baseId,
}

export enum NewItemTypeAddMode {
  baseId,
}

export enum ProjectMetaCategory {
  mix = 0,
  worldTemplate = 1,
  texturePack = 2,
  addOn = 3,
  skinPack = 4,
  persona = 5,
}

export default class ProjectUtilities {
  static async ensureContentInDefaultScriptFile(
    project: Project,
    signatureToken: string,
    content: string,
    placeAtBottom?: boolean
  ) {
    const defaultScriptFile = await project.getDefaultScriptsFile();

    if (defaultScriptFile) {
      if (!defaultScriptFile.isContentLoaded) {
        await defaultScriptFile.loadContent();
      }

      if (typeof defaultScriptFile.content === "string" && defaultScriptFile.content.length > 0) {
        if (defaultScriptFile.content.indexOf(signatureToken) < 0) {
          let newContent = defaultScriptFile.content;

          if (!placeAtBottom) {
            newContent = content + newContent;
          } else {
            newContent = newContent + content;
          }

          defaultScriptFile.setContent(newContent);

          await defaultScriptFile.saveContent();
        }
      }
    }
  }

  static async getDefaultFolderForPack(project: Project, packType: PackType) {
    if (packType === PackType.behavior) {
      return await project.getDefaultBehaviorPackFolder();
    } else if (packType === PackType.resource) {
      return await project.getDefaultResourcePackFolder();
    } else if (packType === PackType.skin) {
      return await project.getDefaultSkinPackFolder();
    } else if (packType === PackType.design) {
      return await project.getDefaultSkinPackFolder();
    }

    throw new Error();
  }

  static getSimplifiedProjectName(projectName: string) {
    // strip out a trailing -xxxxxx (dash + 6 chars) that is used in Electron file-system based project names
    let lastDash = projectName.lastIndexOf("-");

    if (lastDash >= 2 && lastDash === projectName.length - 7) {
      return projectName.substring(0, projectName.length - 7);
    }

    return projectName;
  }

  static getPackTypeName(packType: PackType) {
    switch (packType) {
      case PackType.behavior:
        return "Behavior";
      case PackType.resource:
        return "Resource";
      case PackType.skin:
        return "Skin";
      default:
        return "Unknown";
    }
  }

  static async ensureJsonItem(project: Project, jsonContent: string, fileName: string) {
    if (!project.projectFolder) {
      return undefined;
    }

    const typeInfo = ProjectItemUtilities.inferTypeFromJsonContent(jsonContent, fileName);

    let packType = typeInfo.packType;

    if (packType === undefined) {
      packType = PackType.behavior;
    }

    const baseFolder = await ProjectItemUtilities.getDefaultFolderForType(project, typeInfo.itemType);

    if (!baseFolder) {
      return undefined;
    }

    let folderPath = baseFolder.getFolderRelativePath(project.projectFolder);

    if (folderPath === undefined) {
      return undefined;
    }

    fileName = StorageUtilities.getUniqueChildFolderName(fileName, baseFolder);

    const contentFile = baseFolder.ensureFile(fileName);
    contentFile.setContent(jsonContent);
    contentFile.saveContent();

    const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

    if (relPath !== undefined) {
      return project.ensureItemByProjectPath(
        relPath,
        ProjectItemStorageType.singleFile,
        fileName,
        typeInfo.itemType,
        FolderContext.unknown,
        undefined,
        ProjectItemCreationType.normal
      );
    }

    return undefined;
  }

  static getItemsFromSearch(project: Project, searchResults: IAnnotatedValue[] | undefined) {
    if (searchResults === undefined) {
      return [];
    }

    const searchItems: ProjectItem[] = [];

    for (const val of searchResults) {
      for (const item of project.items) {
        if (item.projectPath && val.value === item.projectPath) {
          searchItems.push(item);
        }
      }
    }

    return searchItems;
  }

  /**
   * Attempts to infer a project item type using the top-level keys present in a JSON object.
   * Falls back to unknown when no meaningful match is found.
   */
  static inferJsonProjectItemTypeFromContent(json: any): ProjectItemType {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return ProjectItemType.unknownJson;
    }

    const metadataKeys = new Set(["format_version", "minecraft:format_version"]);
    const rootKeys = Object.keys(json).filter((key) => !metadataKeys.has(key.toLowerCase()));

    if (rootKeys.length === 0) {
      return ProjectItemType.unknownJson;
    }

    const normalizedKeys = rootKeys.map((key) => key.toLowerCase());

    const directMappings: { [key: string]: ProjectItemType } = {
      "minecraft:block": ProjectItemType.blockTypeBehavior,
      "minecraft:item": ProjectItemType.itemTypeBehavior,
      "minecraft:entity": ProjectItemType.entityTypeBehavior,
      "minecraft:spawn_rules": ProjectItemType.spawnRuleBehavior,
      "minecraft:spawn_groups": ProjectItemType.spawnGroupJson,
      "minecraft:loot_table": ProjectItemType.lootTableBehavior,
      "minecraft:feature": ProjectItemType.featureBehavior,
      "minecraft:feature_rules": ProjectItemType.featureRuleBehavior,
      "minecraft:trading": ProjectItemType.tradingBehaviorJson,
      "minecraft:dialogue": ProjectItemType.dialogueBehaviorJson,
      "minecraft:volume": ProjectItemType.volumeBehaviorJson,
      "minecraft:behavior_tree": ProjectItemType.behaviorTreeJson,
      "minecraft:aim_assist_category": ProjectItemType.aimAssistCategoryJson,
      "minecraft:aim_assist_preset": ProjectItemType.aimAssistPresetJson,
      "minecraft:dimension": ProjectItemType.dimensionJson,
      "minecraft:structure": ProjectItemType.jigsawStructure,
      "minecraft:structure_set": ProjectItemType.jigsawStructureSet,
      "minecraft:template_pool": ProjectItemType.jigsawTemplatePool,
      "minecraft:processor_list": ProjectItemType.jigsawProcessorList,
      "minecraft:biome": ProjectItemType.biomeBehavior,
      "minecraft:client_entity": ProjectItemType.entityTypeResource,
      "minecraft:attachable": ProjectItemType.attachableResourceJson,
      "minecraft:fog_settings": ProjectItemType.fogResourceJson,
      "minecraft:geometry": ProjectItemType.modelGeometryJson,
      "minecraft:block_culling": ProjectItemType.blockCulling,
      particle_effect: ProjectItemType.particleJson,
      render_controllers: ProjectItemType.renderControllerJson,
      "minecraft:render_controller": ProjectItemType.renderControllerJson,
      "minecraft:atmospherics": ProjectItemType.atmosphericsJson,
      "minecraft:pbr": ProjectItemType.pbrJson,
      "minecraft:point_lights": ProjectItemType.pointLightsJson,
      "minecraft:water": ProjectItemType.waterJson,
      "minecraft:shadows": ProjectItemType.shadowsJson,
      "minecraft:uniforms": ProjectItemType.uniformsJson,
      uniforms: ProjectItemType.uniformsJson,
      "minecraft:renderer": ProjectItemType.rendererJson,
      renderer: ProjectItemType.rendererJson,
      lods: ProjectItemType.lodJson,
      "minecraft:lods": ProjectItemType.lodJson,
      loading_messages: ProjectItemType.loadingMessagesJson,
      splashes: ProjectItemType.splashesJson,
      "minecraft:font": ProjectItemType.fontMetadataJson,
      font_metadata: ProjectItemType.fontMetadataJson,
      emoticons: ProjectItemType.emoticonsJson,
      "minecraft:emoticons": ProjectItemType.emoticonsJson,
      contents: ProjectItemType.contentsJson,
      "minecraft:contents": ProjectItemType.contentsJson,
    };

    for (const key of normalizedKeys) {
      const direct = directMappings[key];
      if (direct !== undefined) {
        return direct;
      }
    }

    return ProjectItemType.unknownJson;
  }

  static getItemFromAnnotatedValue(project: Project, value: IAnnotatedValue) {
    for (const item of project.items) {
      if (item.projectPath === value.value) {
        return item;
      }
    }

    return undefined;
  }

  static async isVibrantVisualsCompatible(project: Project) {
    for (const item of project.items) {
      await item.loadFileContent();

      if (item.primaryFile) {
        const manifestJson = await ResourceManifestDefinition.ensureOnFile(item.primaryFile);

        if (manifestJson && manifestJson.capabilities && manifestJson.capabilities.includes("pbr")) {
          return true;
        }
      }
    }

    return false;
  }

  static isVibrantVisualsEnhanced(project: Project) {
    for (const item of project.items) {
      if (ProjectItemUtilities.isVibrantVisualsRelated(item)) {
        return true;
      }
    }

    return false;
  }

  static async ensureDefaultItems(project: Project) {
    if (project.focus === ProjectFocus.gameTests && project.projectFolder !== null) {
      const bpFolder = await project.ensureDefaultBehaviorPackFolder();

      const defaultPath = bpFolder.getFolderRelativePath(project.projectFolder);

      let pi = project.ensureItemByTag(
        "gametestjs",
        "Test",
        ProjectItemType.testJs,
        defaultPath + "scripts/test.js",
        ProjectItemStorageType.singleFile
      );

      let file = await pi.loadFileContent();

      if (file !== null) {
        let content = "";
        if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
          content = ProjectContent.getDefaultTestTypeScript(this.name, StorageUtilities.getBaseFromName("test"));
        } else {
          content = ProjectContent.getDefaultTestJavaScript(this.name, StorageUtilities.getBaseFromName("test"));
        }

        file.setContent(content);
      }

      await project.ensureJsIndexFile();

      pi = project.ensureItemByTag(
        "manifestjson",
        "manifest",
        ProjectItemType.behaviorPackManifestJson,
        defaultPath + "manifest.json",
        ProjectItemStorageType.singleFile,
        ProjectItemCreationType.generated
      );

      pi = project.ensureItemByTag(
        "gameteststructure",
        "Basic",
        ProjectItemType.structure,
        defaultPath + "structures/gametests/basic.mcstructure",
        ProjectItemStorageType.singleFile
      );

      file = await pi.loadFileContent();

      if (file !== null) {
        const result = ProjectContent.generateDefaultStructure();

        if (result !== undefined) {
          file.setContent(result);
        }
      }
    }
  }

  static hasEntities(project: Project) {
    const projectItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);
    if (projectItems.length > 0) {
      return true;
    }

    const projectItemsResource = project.getItemsByType(ProjectItemType.entityTypeResource);
    if (projectItemsResource.length > 0) {
      return true;
    }

    return false;
  }

  static hasBlocks(project: Project) {
    const projectItems = project.getItemsByType(ProjectItemType.blockTypeBehavior);
    if (projectItems.length > 0) {
      return true;
    }

    return false;
  }

  static hasItems(project: Project) {
    const projectItems = project.getItemsByType(ProjectItemType.itemTypeBehavior);
    if (projectItems.length > 0) {
      return true;
    }

    return false;
  }

  static async hasDocumentationMetadata(folder: IFolder, depth?: number) {
    await folder.load();

    for (const folderName in folder.folders) {
      if (
        folderName === "checkpoint_input" ||
        folderName === "metadata" ||
        folderName === "type_definitions" ||
        folderName === "typedefs"
      ) {
        return true;
      }

      if (depth === undefined || depth < 5) {
        const isMetadata = await ProjectUtilities.hasDocumentationMetadata(folder, depth ? depth + 1 : 1);

        if (isMetadata) {
          return true;
        }
      }
    }

    return false;
  }

  static async prepareProjectForDocumentation(project: Project) {
    await project.ensureProjectFolder();

    if (!project.projectFolder) {
      return;
    }

    const hasMetadata = await ProjectUtilities.hasDocumentationMetadata(project.projectFolder);

    if (hasMetadata) {
      return;
    }

    const result = await Database.loadPreviewMetadataFolder();

    if (result) {
      project.accessoryFolders = [result];
    }
  }

  static async getBaseBehaviorPackPath(project: Project) {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = bpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  static async getBaseResourcePackPath(project: Project) {
    const rpFolder = await project.ensureDefaultResourcePackFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    const defaultPath = rpFolder.getFolderRelativePath(project.projectFolder);

    return defaultPath;
  }

  static async applyScriptEntryPoint(project: Project, newScriptEntryPoint: string) {
    project.scriptEntryPoint = newScriptEntryPoint;

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const sm = manifestJson.ensureScriptModule(project.title, project.description);

              sm.entry = project.scriptEntryPoint;

              manifestJson.save();
            }
          }
        }
      }
    }
  }

  static async applyDescription(project: Project, newDescription: string) {
    project.description = newDescription;

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.packageJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const npmPackageJson = await NpmPackageDefinition.ensureOnFile(projectItem.primaryFile);

            if (npmPackageJson && npmPackageJson.definition) {
              npmPackageJson.definition.description = newDescription;

              await npmPackageJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.description = newDescription;

              await manifestJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultResourcePackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.description = newDescription;

              await manifestJson.save();
            }
          }
        }
      }
    }
  }

  static async applyCreator(project: Project, newCreator: string) {
    project.creator = newCreator;
  }

  static async applyShortName(project: Project, newShortName: string) {
    project.shortName = newShortName;
  }

  static async ensureGeneratedWith(project: Project, isToolWeb?: boolean) {
    const appName = isToolWeb ? "mctoolsweb" : "mctoolscli";

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.primaryFile && projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);

          if (bpManifestJson && bpManifestJson.definition) {
            bpManifestJson.ensureGeneratedWith(appName, constants.version);
            await bpManifestJson.save();
          }
        } else if (projectItem.primaryFile && projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);

          if (rpManifestJson && rpManifestJson.definition) {
            rpManifestJson.ensureGeneratedWith(appName, constants.version);
            await rpManifestJson.save();
          }
        }
      }
    }
  }

  static async applyTitle(project: Project, newTitle: string) {
    project.title = newTitle;

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.primaryFile && projectItem.itemType === ProjectItemType.packageJson) {
          const npmPackageJson = await NpmPackageDefinition.ensureOnFile(projectItem.primaryFile);

          if (npmPackageJson && npmPackageJson.definition) {
            npmPackageJson.definition.name = newTitle;
            await npmPackageJson.save();
          }
        } else if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.name = newTitle;

              await manifestJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultResourcePackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.name = newTitle;

              await manifestJson.save();
            }
          }
        }
      }
    }
  }

  static async applyBehaviorPackUniqueId(project: Project, newBehaviorPackId: string) {
    const oldBehaviorPackId = project.defaultBehaviorPackUniqueId;

    await project.setDefaultBehaviorPackUniqueIdAndUpdateDependencies(newBehaviorPackId);

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      let bpackCount = 0;

      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          bpackCount++;
        }
      }

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await BehaviorManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              (bpackCount <= 1 ||
                Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId) ||
                Utilities.uuidEqual(manifestJson.definition.header.uuid, oldBehaviorPackId))
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.uuid = newBehaviorPackId;

              manifestJson.save();
            }
          }
        }
      }
    }
  }

  static async applyResourcePackUniqueId(project: Project, newResourcePackId: string) {
    const oldResourcePackId = project.defaultResourcePackUniqueId;

    await project.setDefaultResourcePackUniqueIdAndUpdateDependencies(newResourcePackId);

    if (project.effectiveEditPreference === ProjectEditPreference.summarized && project.defaultResourcePackUniqueId) {
      let rpackCount = 0;

      const itemsCopy = project.getItemsCopy();

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          rpackCount++;
        }
      }

      for (const projectItem of itemsCopy) {
        if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          await projectItem.loadFileContent();

          if (projectItem.primaryFile) {
            const manifestJson = await ResourceManifestDefinition.ensureOnFile(projectItem.primaryFile);

            if (
              manifestJson &&
              manifestJson.definition &&
              (rpackCount <= 1 ||
                Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultResourcePackUniqueId) ||
                Utilities.uuidEqual(manifestJson.definition.header.uuid, oldResourcePackId))
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.uuid = newResourcePackId;

              manifestJson.save();
            }
          }
        }
      }
    }
  }

  static getSuggestedProjectShortName(creator: string, name: string) {
    return this.getSuggestedShortName(creator) + "_" + this.getSuggestedShortName(name);
  }

  static getSuggestedShortName(caption: string) {
    caption = caption.trim().replace(/-/g, "");
    caption = caption.replace(/[_ :;=]/g, "");

    let capitalStr = "";

    for (let i = 0; i < caption.length; i++) {
      if (caption[i] >= "A" && caption[i] <= "Z") {
        capitalStr += caption[i].toLowerCase();
      }
    }

    if (capitalStr.length > 1) {
      return capitalStr;
    }

    if (caption.length <= 4) {
      return caption.toLowerCase();
    }

    return caption.substring(0, 4).toLowerCase();
  }

  static getSuggestedProjectName(project: IGalleryItem) {
    return this.getSuggestedProjectNameFromElements(project.id, project.gitHubFolder, project.gitHubRepoName);
  }

  static getSuggestedProjectNameFromElements(id?: string, gitHubFolder?: string, gitHubRepoName?: string) {
    let projName = "my";

    if (id) {
      projName += id;
    } else if (gitHubFolder !== undefined) {
      projName += gitHubFolder;
      projName = projName.replace(" behavior_packs", "");
    } else {
      projName += gitHubRepoName;
    }

    projName = projName.replace(/_/gi, "");
    projName = projName.replace(/\//gi, "");
    projName = projName.replace(/\\/gi, "");
    projName = projName.replace(/ /gi, "");

    return projName;
  }

  static async getBaseScriptsPath(project: Project) {
    const scriptsFolder = await project.ensureDefaultScriptsFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    return scriptsFolder.getFolderRelativePath(project.projectFolder);
  }

  static async renameDefaultFolders(project: Project, newTokenName: string) {
    const bpFolder = await project.getDefaultBehaviorPackFolder(true);
    const rpFolder = await project.getDefaultResourcePackFolder(true);

    newTokenName = MinecraftUtilities.makeNameFolderSafe(newTokenName);

    if (bpFolder) {
      try {
        await bpFolder.rename(newTokenName);
      } catch (e: any) {
        // perhaps folder could not be renamed because a folder exists; continue in this case.
        Log.error(e.toString());
      }
    }

    if (rpFolder) {
      try {
        await rpFolder.rename(newTokenName);
      } catch (e: any) {
        // perhaps folder could not be renamed because a folder exists; continue in this case.
        Log.error(e.toString());
      }
    }
  }

  static async processNewProject(
    project: Project,
    title: string,
    description: string,
    suggestedShortName?: string,
    isWeb?: boolean
  ) {
    await project.inferProjectItemsFromFiles();

    if (suggestedShortName) {
      await ProjectUtilities.renameDefaultFolders(project, suggestedShortName);
    }

    await ProjectAutogeneration.updateProjectAutogeneration(project, true);

    await ProjectUtilities.randomizeAllUids(project);

    await ProjectUtilities.applyTitle(project, title);
    await ProjectUtilities.applyDescription(project, description);
    await ProjectUtilities.ensureGeneratedWith(project, isWeb);

    await ProjectStandard.ensureIsStandard(project);

    const pur = new ProjectUpdateRunner(project);

    await pur.updateProject();

    await project.save(true);
  }

  static async setNewModuleId(project: Project, newModuleId: string, oldModuleId: string) {
    const itemsCopy = project.getItemsCopy();
    let setResourcePack = false;

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.primaryFile) {
        if (pi.itemType === ProjectItemType.resourcePackManifestJson && !setResourcePack) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

          if (rpManifestJson) {
            if (rpManifestJson.definition && rpManifestJson.definition.modules) {
              const mods = rpManifestJson.definition.modules;

              for (const mod of mods) {
                if (mod.uuid === oldModuleId) {
                  mod.uuid = newModuleId;
                }
              }
            }
          }
        } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
          const bpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

          if (bpManifestJson) {
            if (bpManifestJson.definition && bpManifestJson.definition.modules) {
              const mods = bpManifestJson.definition.modules;

              for (const mod of mods) {
                if (mod.uuid === oldModuleId) {
                  mod.uuid = newModuleId;
                }
              }
            }
          }
        }
      }
    }
  }

  static async getDefaultBehaviorPackFolder(project: Project, paths: string[]) {
    const bpFolder = await project.getDefaultBehaviorPackFolder();

    if (!bpFolder) {
      return undefined;
    }

    const srFolder = await bpFolder.ensureFolderFromRelativePath(paths.join("/"));

    await srFolder.ensureExists();

    return srFolder;
  }

  static async getIsAddon(project: Project) {
    const itemsCopy = project.getItemsCopy();
    let rpCount = 0;
    let bpCount = 0;

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.primaryFile) {
        if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
          rpCount++;
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

          if (rpManifestJson) {
            if (!rpManifestJson.hasAddonProperties()) {
              return false;
            }
          }
        } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
          bpCount++;
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

          if (bpManifestJson) {
            if (!bpManifestJson.hasAddonProperties()) {
              return false;
            }
          }
        }
      }
    }

    return bpCount === 1 && rpCount === 1;
  }

  static async getMetaCategory(project: Project) {
    const itemsCopy = project.getItemsCopy();
    let rpCount = 0;
    let bpCount = 0;
    let spCount = 0;
    let personaCount = 0;
    let worldTemplateCount = 0;

    let hasPacksWithAddOnProperties = false;
    let hasPacksWithoutAddOnProperties = false;

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (!pi.primaryFile) {
        continue;
      }

      if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        rpCount++;
        const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

        if (rpManifestJson) {
          let hasAddonProperties = rpManifestJson.hasAddonProperties();

          if (hasAddonProperties) {
            hasPacksWithAddOnProperties = true;
          } else {
            hasPacksWithoutAddOnProperties = true;
          }
        }
      } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        bpCount++;
        const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

        if (bpManifestJson) {
          let hasAddonProperties = bpManifestJson.hasAddonProperties();

          if (hasAddonProperties) {
            hasPacksWithAddOnProperties = true;
          } else {
            hasPacksWithoutAddOnProperties = true;
          }
        }
      } else if (pi.itemType === ProjectItemType.skinPackManifestJson) {
        spCount++;
      } else if (pi.itemType === ProjectItemType.personaManifestJson) {
        personaCount++;
      } else if (pi.itemType === ProjectItemType.worldTemplateManifestJson) {
        worldTemplateCount++;
      }
    }

    if (personaCount > 0) {
      return ProjectMetaCategory.persona;
    }

    if (worldTemplateCount > 0) {
      return ProjectMetaCategory.worldTemplate;
    }

    if (
      bpCount === 1 &&
      rpCount === 1 &&
      spCount === 0 &&
      !hasPacksWithoutAddOnProperties &&
      hasPacksWithAddOnProperties
    ) {
      return ProjectMetaCategory.addOn;
    }

    if (bpCount === 0 && rpCount >= 1 && !hasPacksWithAddOnProperties) {
      return ProjectMetaCategory.texturePack;
    }

    if (spCount >= 0) {
      return ProjectMetaCategory.skinPack;
    }

    return ProjectMetaCategory.mix;
  }

  static getMetaCategoryDescription(category: ProjectMetaCategory) {
    switch (category) {
      case ProjectMetaCategory.addOn:
        return "Add-On";
      case ProjectMetaCategory.worldTemplate:
        return "World Template";
      case ProjectMetaCategory.texturePack:
        return "Texture Pack";
      case ProjectMetaCategory.skinPack:
        return "Skin Pack";
      case ProjectMetaCategory.persona:
        return "Persona";
      default:
        return "Mix";
    }
  }

  static async setIsAddon(project: Project) {
    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.primaryFile) {
        if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

          if (rpManifestJson) {
            rpManifestJson.setAddonProperties();
          }
        } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

          if (bpManifestJson) {
            bpManifestJson.setAddonProperties();
          }
        }
      }
    }
  }

  static async randomizeAllUids(project: Project) {
    const oldUids: { [name: string]: string } = {};

    oldUids["defaultBehaviorPack"] = project.defaultBehaviorPackUniqueId;
    oldUids["defaultResourcePack"] = project.defaultResourcePackUniqueId;
    oldUids["defaultDataPack"] = project.defaultDataUniqueId;
    oldUids["defaultScriptModulePack"] = project.defaultScriptModuleUniqueId;

    await project.setDefaultResourcePackUniqueIdAndUpdateDependencies(Utilities.createUuid());
    await project.setDefaultBehaviorPackUniqueIdAndUpdateDependencies(Utilities.createUuid());
    project.defaultDataUniqueId = Utilities.createUuid();
    project.defaultScriptModuleUniqueId = Utilities.createUuid();

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.primaryFile) {
        if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.primaryFile);

          if (bpManifestJson) {
            bpManifestJson.randomizeModuleUuids(
              project.defaultScriptModuleUniqueId,
              oldUids["defaultScriptModulePack"]
            );

            if (
              bpManifestJson.id !== oldUids["defaultBehaviorPack"] &&
              bpManifestJson.id !== project.defaultBehaviorPackUniqueId
            ) {
              await bpManifestJson.setUuid(Utilities.createUuid(), project);
            }
          }
        } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.primaryFile);

          if (rpManifestJson) {
            rpManifestJson.randomizeModuleUuids(project.defaultDataUniqueId, oldUids["defaultDataModulePack"]);

            if (
              rpManifestJson.id !== oldUids["defaultResourcePack"] &&
              rpManifestJson.id !== project.defaultResourcePackUniqueId
            ) {
              await rpManifestJson.setUuid(Utilities.createUuid(), project);
            }
          }
        }
      }
    }

    await project.save();
  }

  static sanitizeProjectName(name: string) {
    const lastDash = name.lastIndexOf("-");

    // this is the token format of Electron Storage - remove the random token at the end
    if (lastDash === name.length - 6) {
      name = name.substring(0, name.length - 6);
    }

    return name;
  }

  static CodeReplaceTokens = ["say Hello", 'sendMessage("Hello world'];

  static ImportTypes = {
    vanilla: [
      "MinecraftDimensionTypes",
      "MinecraftBlockTypes",
      "MinecraftItemTypes",
      "MinecraftEntityTypes",
      "MinecraftEffectTypes",
      "MinecraftEnchantmentTypes",
      "MinecraftBiomeTypes",
      "MinecraftFeatureTypes",
      "MinecraftPotionEffectTypes",
      "MinecraftPotionLiquidTypes",
      "MinecraftPotionModifierTypes",
      "MinecraftCooldownCategoryTypes",
    ],
    math: ["Vector3Utils"],
    mcui: [
      "MessageFormResponse",
      "MessageFormData",
      "ActionFormData",
      "ActionFormResponse",
      "ModalFormData",
      "ModalFormResponse",
    ],
    mc: [
      "system",
      "BlockPermutation",
      "BlockSignComponent",
      "CompoundBlockVolume",
      "SignSide",
      "DyeColor",
      "ItemDurabilityComponent",
      "RawMessage",
      "RawText",
      "EntityProjectileComponent",
      "EntityQueryOptions",
      "ButtonPushAfterEvent",
      "ItemStack",
      "MolangVariableMap",
      "EntityInventoryComponent",
      "BlockInventoryComponent",
      "Enchantment",
      "ItemEnchantsComponent",
      "EntityHealthComponent",
      "EntityOnFireComponent",
      "EntityEquippableComponent",
      "EquipmentSlot",
      "EntityItemComponent",
      "EntitySpawnAfterEvent",
      "PistonActivateBeforeEvent",
      "PistonActivateAfterEvent",
      "MusicOptions",
      "WorldSoundOptions",
      "PlayerSoundOptions",
      "DisplaySlotId",
      "ObjectiveSortOrder",
      "TripWireTripAfterEvent",
      "BlockComponentTypes",
      "EntityComponentTypes",
      "ItemComponentTypes",
      "LeverActionAfterEvent",
      "Vector3",
    ],
    mced: [
      "IPlayerUISession",
      "ExtensionContext",
      "IModalToolContainer",
      "registerEditorExtension",
      "ActionManager",
      "IModalTool",
      "ActionTypes",
      "MouseProps",
      "MouseActionType",
      "MouseInputType",
      "KeyboardKey",
      "InputModifier",
      "EditorInputContext",
      "IPropertyPane",
    ],
  };

  static getTopicUrl(topic: string) {
    const tokens = topic.split(".");

    if (tokens.length < 1) {
      return undefined;
    }

    if (
      this.ImportTypes.mc.includes(tokens[0]) ||
      tokens[0] === "World" ||
      tokens[0] === "System" ||
      tokens[0] === "Dimension"
    ) {
      return (
        "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server/" +
        topic.toLowerCase().replace(".", "#")
      );
    }
    if (this.ImportTypes.mcui.includes(tokens[0])) {
      return (
        "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-ui/" +
        topic.toLowerCase().replace(".", "#")
      );
    }
    if (this.ImportTypes.mced.includes(tokens[0])) {
      return (
        "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-editor/" +
        topic.toLowerCase().replace(".", "#")
      );
    }

    return undefined;
  }

  static adaptFullSample(content: string) {
    const registerFunction = content.indexOf("export function register");

    if (registerFunction >= 0) {
      let nextParen = content.indexOf("Extension(", registerFunction);

      if (nextParen > registerFunction) {
        content = content.substring(0, registerFunction + 24) + content.substring(nextParen);
      }
    }

    return content;
  }

  static adaptSample(sampleContent: string, fileContent: string) {
    if (sampleContent.indexOf(" mc.") >= 0 && fileContent.indexOf(" as mc") <= 0) {
      sampleContent = sampleContent.replace(/mc./gi, "");
    }

    if (sampleContent.indexOf(" mcui.") >= 0 && fileContent.indexOf(" as mcui") <= 0) {
      sampleContent = sampleContent.replace(/mcui./gi, "");
    }

    return sampleContent;
  }

  static modifyImports(fileContent: string) {
    let startOfCode = fileContent.indexOf("(");
    let nextStartOfCode = fileContent.indexOf("function");

    if (nextStartOfCode >= 0 && nextStartOfCode < startOfCode) {
      startOfCode = nextStartOfCode;
    }

    nextStartOfCode = fileContent.indexOf("class");

    if (nextStartOfCode >= 0 && nextStartOfCode < startOfCode) {
      startOfCode = nextStartOfCode;
    }

    const previousNewLine = fileContent.lastIndexOf("\n", startOfCode);

    if (previousNewLine >= 0) {
      startOfCode = previousNewLine;
    }

    if (startOfCode > 0) {
      let introContent = fileContent.substring(0, startOfCode);
      const restOfContent = fileContent.substring(startOfCode);

      introContent = ProjectUtilities.ensureImportLines(
        introContent,
        restOfContent,
        "@minecraft/server",
        this.ImportTypes.mc
      );

      introContent = ProjectUtilities.ensureImportLines(
        introContent,
        restOfContent,
        "@minecraft/server-ui",
        this.ImportTypes.mcui
      );

      introContent = ProjectUtilities.ensureImportLines(
        introContent,
        restOfContent,
        "@minecraft/vanilla-data",
        this.ImportTypes.vanilla
      );

      introContent = ProjectUtilities.ensureImportLines(
        introContent,
        restOfContent,
        "@minecraft/math",
        this.ImportTypes.math
      );

      fileContent = introContent + restOfContent;
    }

    return fileContent;
  }

  static ensureImportLines(
    introSection: string,
    restOfContent: string,
    moduleName: string,
    importCollection: string[]
  ) {
    for (const importType of importCollection) {
      if (restOfContent.indexOf(importType) >= 0) {
        let importLineIndex = introSection.indexOf('from "' + moduleName + '";');

        if (importLineIndex < 0) {
          introSection = 'import {} from "' + moduleName + '";\n' + introSection;
          importLineIndex = 10;
        }

        let previousNewLine = introSection.lastIndexOf("\n", importLineIndex);

        if (previousNewLine < 0) {
          previousNewLine = 0;
        }

        let endNewLine = introSection.indexOf("\n", importLineIndex);

        if (endNewLine > previousNewLine) {
          let importLine = introSection.substring(previousNewLine, endNewLine);

          const leftBracket = importLine.indexOf("{");
          const rightBracket = importLine.indexOf("}");

          if (leftBracket > 0 && rightBracket > leftBracket) {
            const interior = importLine.substring(leftBracket + 1, rightBracket).trim();

            let injectToken = importType;

            // is there one token already in the import linte
            if (interior.length > 0) {
              injectToken = ", " + injectToken;
            }

            importLine = importLine.substring(0, rightBracket) + injectToken + importLine.substring(rightBracket);
          }

          introSection = introSection.substring(0, previousNewLine) + importLine + introSection.substring(endNewLine);
        }
      }
    }

    return introSection;
  }

  static async ensureTypeScriptFileWith(
    project: Project,
    token: string,
    templateSet: string,
    templateName: string,
    fileNameCore: string,
    replacers: { [sourceString: string]: string }
  ) {
    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.ts) {
        await projectItem.loadFileContent();

        if (projectItem.primaryFile) {
          const tsJson = await TypeScriptDefinition.ensureOnFile(projectItem.primaryFile);

          if (tsJson?.data && tsJson.data.indexOf(token) >= 0) {
            return;
          }
        }
      }
    }

    const snippet = await Database.getSnippet(templateSet, templateName);
    const scriptFolder = await project.ensureDefaultScriptsFolder();

    await scriptFolder.load();

    if (!snippet) {
      Log.error("Could not find template " + templateSet, templateName);
      return;
    }

    const file = scriptFolder.ensureFile(fileNameCore + ".ts");

    let snippetInjectContent = "\n" + snippet.body.join("\n") + "\n";

    for (const replacerToken in replacers) {
      const targetReplace = replacers[replacerToken];

      if (targetReplace) {
        // replace with something better.
        while (snippetInjectContent.indexOf(replacerToken) >= 0) {
          snippetInjectContent = snippetInjectContent.replace(replacerToken, replacers[replacerToken]);
        }
      }
    }

    file.setContent(snippetInjectContent);

    await file.saveContent();

    project.ensureItemFromFile(file, ProjectItemType.ts, FolderContext.behaviorPack);
  }

  static async injectSnippet(project: Project, snippet: ISnippet, fullScriptBoxReplace: boolean) {
    let snippetInjectContent = "\n" + snippet.body.join("\n") + "\n";

    const folder = await project.ensureDefaultScriptsFolder();

    await folder.load();

    // Log.debugAlert("Inject snippet considering folder: " + folder.storageRelativePath + "|" + replaceContent);
    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file !== undefined) {
        if (fullScriptBoxReplace && fileName === "ScriptBox.ts") {
          snippetInjectContent = ProjectUtilities.adaptFullSample(snippetInjectContent);

          file.setContent(snippetInjectContent);
        } else {
          const type = StorageUtilities.getTypeFromName(file.name);

          if (type === "ts" || type === "js") {
            if (!file.isContentLoaded) {
              await file.loadContent();
            }

            // Log.debugAlert("Inject snippet considering file: " + file.storageRelativePath + "|" + file.content?.length);
            if (file.content && typeof file.content === "string") {
              let content = file.content;

              for (let i = 0; i < this.CodeReplaceTokens.length; i++) {
                const token = content.indexOf(this.CodeReplaceTokens[i]);

                if (token >= 0) {
                  const previousNewLine = content.lastIndexOf("\n", token);
                  const nextNewLine = content.indexOf("\n", token);
                  if (previousNewLine >= 0 && nextNewLine > previousNewLine) {
                    snippetInjectContent = ProjectUtilities.adaptSample(snippetInjectContent, content);

                    content =
                      content.substring(0, previousNewLine) + snippetInjectContent + content.substring(nextNewLine + 1);

                    if (
                      snippetInjectContent.indexOf("overworld") >= 0 &&
                      snippetInjectContent.indexOf("const overworld") <= 0
                    ) {
                      let firstComment = content.indexOf("//");
                      if (firstComment >= 0) {
                        content =
                          content.substring(0, firstComment) +
                          '  const overworld = mc.world.getDimension("overworld");\n' +
                          content.substring(firstComment, content.length);
                      }
                    }

                    content = ProjectUtilities.modifyImports(content);

                    file.setContent(content);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  static async addBlockType(project: Project, blockTypeId?: string, blockTypeName?: string) {
    const defaultBehaviorPackPath = await ProjectUtilities.getBaseBehaviorPackPath(project);
    const defaultScriptsPath = await ProjectUtilities.getBaseScriptsPath(project);

    if (defaultBehaviorPackPath === undefined || defaultScriptsPath === undefined) {
      return;
    }

    await Database.getReleaseVanillaBehaviorPackFolder();

    if (Database.releaseVanillaBehaviorPackFolder === null) {
      Log.fail("Could not find default behavior pack folder");
      return;
    }

    const sourceFile = Database.releaseVanillaBehaviorPackFolder
      .ensureFolder("blocks")
      .ensureFile(blockTypeId + ".json");

    if (!sourceFile.isContentLoaded) {
      await sourceFile.loadContent(true);
    }

    if (
      !sourceFile.content ||
      sourceFile.content === "" ||
      sourceFile.content === "null" ||
      sourceFile.content instanceof Uint8Array
    ) {
      Log.fail("Block at '" + sourceFile.fullPath + "' is empty.");
      return;
    }

    const name = blockTypeId ? MinecraftUtilities.canonicalizeName(blockTypeId) : "block";

    const nextBlockTypeName = blockTypeName ? blockTypeName : name;

    const candidateFilePath = await ProjectUtilities.getFileName(
      project,
      defaultBehaviorPackPath + "blocks/",
      nextBlockTypeName,
      "json",
      true
    );

    if (candidateFilePath === undefined) {
      return;
    }

    const pi = project.ensureItemByProjectPath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      nextBlockTypeName,
      ProjectItemType.blockTypeBehavior,
      FolderContext.behaviorPack,
      undefined,
      ProjectItemCreationType.normal
    );

    const file = await pi.loadFileContent();

    if (file !== null) {
      const content = Utilities.fixJsonContent(sourceFile.content);

      file.setContent(content);

      const bt = await BlockTypeDefinition.ensureOnFile(file, undefined);

      if (bt) {
        bt.id =
          nextBlockTypeName.indexOf(":") >= 0
            ? nextBlockTypeName
            : project.effectiveDefaultNamespace + ":" + nextBlockTypeName;

        bt.persist();
      }

      await file.saveContent(true);
    }
    /*
    if (project.preferredScriptLanguage === ProjectScriptLanguage.javaScript) {
      const candidateJsFilePath = await ProjectUtilities.getFileName(
        project,
        defaultScriptsPath + "generated/",
        nextBlockTypeName + ".base",
        "js",
        true
      );

      if (candidateJsFilePath) {
        const piGenJs = project.ensureItemByProjectPath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.blockTypeBaseJs,
          undefined,
          ProjectItemCreationType.generated
        );

        await ProjectAutogeneration.updateItemAutogeneration(piGenJs);
      }
    } else if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
      const candidateJsFilePath = await ProjectUtilities.getFileName(
        project,
        defaultScriptsPath + "generated/",
        nextBlockTypeName + ".base",
        "ts",
        true
      );

      if (candidateJsFilePath) {
        const piGenJs = project.ensureItemByProjectPath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.blockTypeBaseTs,
          undefined,
          ProjectItemCreationType.normal
        );

        await ProjectAutogeneration.updateItemAutogeneration(piGenJs);
      }
    }*/
  }

  static canonicalizeStoragePath(path: string | null | undefined) {
    if (!path) {
      return "";
    }

    path = path.toLowerCase();

    return path;
  }

  static canonicalizeNamespace(path: string | null | undefined) {
    if (!path) {
      return "";
    }

    path = path.toLowerCase();
    path = path.replace(/ /gi, "");
    path = path.replace(/:/gi, "");

    return path;
  }

  static async getFileName(
    project: Project,
    basePath: string,
    baseName: string,
    extension: string,
    includeBase: boolean
  ) {
    if (project.projectFolder === null) {
      return undefined;
    }

    let index = 0;

    if (includeBase) {
      index = -1;
    }

    let candidateFilePath = "";
    const projectFolder = project.projectFolder;
    let candidateFile = null;

    await projectFolder.ensureFolderFromRelativePath(basePath);
    await projectFolder.ensureExists();

    // find a filename not in use
    do {
      index++;

      if (index === 0) {
        candidateFilePath = basePath + baseName + "." + extension;
      } else {
        candidateFilePath = basePath + baseName + index + "." + extension;
      }

      candidateFile = await projectFolder.getFileFromRelativePath(candidateFilePath);
    } while (candidateFile !== null && candidateFile !== undefined);

    return candidateFilePath;
  }
}
