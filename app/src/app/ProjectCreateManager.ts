// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import Database from "../minecraft/Database";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import HttpStorage from "../storage/HttpStorage";
import StorageUtilities from "../storage/StorageUtilities";
import CreatorToolsHost from "./CreatorToolsHost";
import IGalleryItem, { GalleryItemType } from "./IGalleryItem";
import { ProjectItemType } from "./IProjectItemData";
import Project, { FolderContext } from "./Project";
import ProjectItem from "./ProjectItem";
import ProjectItemInference from "./ProjectItemInference";
import ProjectItemUtilities from "./ProjectItemUtilities";
import { NewEntityTypeAddMode } from "./ProjectUtilities";

export const STANDARD_NAME_TOKEN = "_name_";

export const MATERIAL_NAMES_TO_FIXUP = [
  "cold",
  "warm",
  "body",
  "head",
  "legs",
  "eyes",
  "flower",
  "charging",
  "masked",
  "bioluminescent_layer",
  "armor",
  "charged",
  "ghost",
  "cape",
  "body_layer",
  "outer",
  "animated",
  "spectator",
  "overlay",
  "limbs",
  "breeze_eyes",
  "breeze_wind",
  "invisible",
];

export default class ProjectCreateManager {
  /**
   * Checks whether a name already exists in the project for the given item type.
   * Comparison is case-insensitive and normalizes underscores/spaces/hyphens.
   * Also handles file extensions (e.g., "frost_moose.behavior" matches "frost_moose").
   */
  static nameExistsInProject(project: Project, name: string, itemType: ProjectItemType): boolean {
    const normalized = name.toLowerCase().replace(/[- ]/g, "_");
    const items = project.getItemsByType(itemType);

    for (const item of items) {
      const itemName = item.name.toLowerCase().replace(/[- ]/g, "_");
      if (
        itemName === normalized ||
        itemName.startsWith(normalized + ".") ||
        itemName === normalized + ".json" ||
        itemName === normalized + ".behavior"
      ) {
        return true;
      }

      // Also compare after stripping common extensions from item name
      const dotIndex = itemName.indexOf(".");
      if (dotIndex > 0) {
        const baseName = itemName.substring(0, dotIndex);
        if (baseName === normalized) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generates a unique name for a new item by appending " 2", " 3", etc. if the
   * base name already exists in the project.
   */
  static getUniqueName(project: Project, baseName: string, itemType: ProjectItemType): string {
    if (!ProjectCreateManager.nameExistsInProject(project, baseName, itemType)) {
      return baseName;
    }

    for (let i = 2; i < 100; i++) {
      const candidate = baseName + " " + i;
      if (!ProjectCreateManager.nameExistsInProject(project, candidate, itemType)) {
        return candidate;
      }
    }

    return baseName + " " + Date.now();
  }

  /**
   * Maps a ProjectItemType to the corresponding GalleryItemType for entity/block/item.
   */
  static galleryItemTypeForProjectItemType(itemType: ProjectItemType): GalleryItemType | undefined {
    switch (itemType) {
      case ProjectItemType.entityTypeBehavior:
        return GalleryItemType.entityType;
      case ProjectItemType.blockTypeBehavior:
        return GalleryItemType.blockType;
      case ProjectItemType.itemTypeBehavior:
        return GalleryItemType.itemType;
      default:
        return undefined;
    }
  }

  /**
   * Collects the file paths (project-relative) for all related files of a project item,
   * using the relationship graph built by project.processRelations().
   * Returns paths relative to the project root (e.g., "behavior_packs/mypack_bp/entities/zombie.json").
   */
  static collectRelatedFilePaths(item: ProjectItem): string[] {
    const descendants = ProjectItemUtilities.collectAllDescendantItems(item);
    const paths: string[] = [];

    for (const descendant of descendants) {
      if (descendant.projectPath) {
        paths.push(descendant.projectPath);
      }
    }

    Log.debug(
      `[ProjectCreateManager] collectRelatedFilePaths for '${item.name}': ` +
        `${descendants.length} descendants, ${paths.length} paths` +
        (paths.length > 0 ? ": " + paths.join(", ") : "") +
        ` (childItems: ${item.childItems ? item.childItems.length : "undefined"})`
    );

    return paths;
  }

  /**
   * Extracts the short identifier from a project item's name. For entities/blocks/items,
   * this is the base name without any file extensions or suffixes like .behavior, .entity, .geo.
   * E.g., "biceson.behavior.json" → "biceson", "frost_moose.json" → "frost_moose".
   */
  static getShortIdFromProjectItem(item: ProjectItem): string {
    if (item.projectPath) {
      let leaf = StorageUtilities.getLeafName(item.projectPath);

      // Strip ALL dot-suffixes to get the bare entity/block/item name.
      // Entity files have compound extensions like .behavior.json, .entity.json, .geo.json.
      // We want just the base name (e.g., "biceson" from "biceson.behavior.json").
      const firstDot = leaf.indexOf(".");
      if (firstDot > 0) {
        leaf = leaf.substring(0, firstDot);
      }

      if (leaf) {
        return leaf.toLowerCase().replace(/[- ]/g, "_");
      }
    }

    const name = item.name;
    // Also strip dot-suffixes from the name
    const firstDot = name.indexOf(".");
    if (firstDot > 0) {
      return name.substring(0, firstDot).toLowerCase().replace(/[- ]/g, "_");
    }

    return name.toLowerCase().replace(/[- ]/g, "_");
  }

  /**
   * Builds an IGalleryItem from an existing ProjectItem in the current project.
   * This allows project items to be displayed in the same gallery UI as vanilla items
   * and fed into the same copy pipeline.
   */
  static buildGalleryItemFromProjectItem(item: ProjectItem, project: Project): IGalleryItem {
    const galleryType = ProjectCreateManager.galleryItemTypeForProjectItemType(item.itemType);
    const shortId = ProjectCreateManager.getShortIdFromProjectItem(item);
    const friendlyName = Utilities.humanifyMinecraftName(shortId) as string;

    // Prefer the rendered 3D model snapshot (cachedThumbnail) which is propagated
    // up from geometry items to entity RP and entity BP items by ProjectWorkerManager.
    let thumbnailDataUrl: string | undefined = item.cachedThumbnail;

    // Fall back to the item's own imageUrl (which also checks cachedThumbnail internally)
    if (!thumbnailDataUrl) {
      thumbnailDataUrl = item.imageUrl;
    }

    // Skip expensive descendant traversal at gallery-build time.
    // The file list is rebuilt fresh at copy time via _resolveProjectItemFilePaths.

    return {
      gitHubOwner: "",
      gitHubRepoName: "",
      thumbnailImage: "",
      localLogo: thumbnailDataUrl,
      title: friendlyName,
      description: "Project " + ProjectItemUtilities.getDescriptionForType(item.itemType).toLowerCase(),
      type: galleryType ?? GalleryItemType.entityType,
      id: shortId,
      nameReplacers: [shortId],
      fileList: [],
      isProjectItem: true,
      tags: ["project"],
    };
  }

  /**
   * Returns an array of IGalleryItem adapters for all project items of a given gallery type.
   * Used to populate the "Your Project" section in the template picker.
   */
  static getProjectItemsAsGalleryItems(project: Project, galleryType: GalleryItemType): IGalleryItem[] {
    let projectItemType: ProjectItemType;

    switch (galleryType) {
      case GalleryItemType.entityType:
        projectItemType = ProjectItemType.entityTypeBehavior;
        break;
      case GalleryItemType.blockType:
        projectItemType = ProjectItemType.blockTypeBehavior;
        break;
      case GalleryItemType.itemType:
        projectItemType = ProjectItemType.itemTypeBehavior;
        break;
      default:
        return [];
    }

    const items = project.getItemsByType(projectItemType);
    const galleryItems: IGalleryItem[] = [];

    for (const item of items) {
      // Skip vanilla/accessory items — only include items from the project's own packs.
      // Items loaded from accessory folders have source starting with "o."
      if (item.source && item.source.startsWith("o.")) {
        continue;
      }

      galleryItems.push(ProjectCreateManager.buildGalleryItemFromProjectItem(item, project));
    }

    return galleryItems;
  }

  /**
   * Discovers newly created files by re-scanning only the project's BP and RP folders,
   * rather than the entire project tree. This prevents OOM on large projects (21K+ items).
   */
  private static async _inferNewItems(project: Project) {
    const projectFolder = project.projectFolder;
    if (!projectFolder) {
      return;
    }

    const bpFolder = project.defaultBehaviorPackFolder;
    const rpFolder = project.defaultResourcePackFolder;

    if (bpFolder) {
      await ProjectItemInference.inferProjectItemsFromFolder(
        project,
        bpFolder,
        "",
        FolderContext.behaviorPack,
        undefined,
        false,
        projectFolder,
        0,
        undefined,
        true // force re-scan this folder
      );
    }

    if (rpFolder) {
      await ProjectItemInference.inferProjectItemsFromFolder(
        project,
        rpFolder,
        "",
        FolderContext.resourcePack,
        undefined,
        false,
        projectFolder,
        0,
        undefined,
        true // force re-scan this folder
      );
    }
  }

  static async addEntityTypeFromGallery(
    project: Project,
    entityTypeProject: IGalleryItem,
    entityTypeName?: string,
    addMode?: NewEntityTypeAddMode,
    messageUpdater?: (message: string) => Promise<void>,
    dontOverwriteExistingFiles?: boolean
  ) {
    await ProjectCreateManager.copyGalleryPackFilesAndFixupIds(
      project,
      entityTypeProject,
      entityTypeName,
      messageUpdater,
      dontOverwriteExistingFiles
    );

    // Discover the newly created files without re-scanning the entire project
    await ProjectCreateManager._inferNewItems(project);

    // Set runtimeIdentifier on the newly created entity
    if (!entityTypeProject.isProjectItem) {
      // For vanilla gallery items, scan for the new entity and set its runtimeIdentifier
      const items = project.getItemsCopy();

      for (const item of items) {
        if (item.itemType === ProjectItemType.entityTypeBehavior) {
          let minecraftEntityType = (await MinecraftDefinitions.get(item)) as EntityTypeDefinition | undefined;

          if (minecraftEntityType) {
            const targetId = entityTypeName ? entityTypeName : entityTypeProject.id;

            if (minecraftEntityType.id?.endsWith(targetId)) {
              minecraftEntityType.runtimeIdentifier = entityTypeProject.targetRuntimeIdentifier
                ? entityTypeProject.targetRuntimeIdentifier
                : "minecraft:" + entityTypeProject.id;

              minecraftEntityType.persist();
            }
          }
        }
      }
    }
    // For project items, runtimeIdentifier is already correct from the content copy.

    await project.save();
  }

  static getReplacedCreationData(project: Project, galleryItem: IGalleryItem, newName: string) {
    if (galleryItem.creationData === undefined) {
      return undefined;
    }

    try {
      let creationDataStr = JSON.stringify(galleryItem.creationData);

      creationDataStr = this.replaceNamesInContent(creationDataStr, project, galleryItem, newName, []);

      return JSON.parse(creationDataStr);
    } catch (e) {
      return galleryItem.creationData;
    }
  }

  static getReplacedCreationDataInObject(project: Project, creationObject: object, newName: string) {
    if (creationObject === undefined) {
      return undefined;
    }

    try {
      let creationDataStr = JSON.stringify(creationObject);

      creationDataStr = this.replaceNamesInContentFromReplacers(
        creationDataStr,
        project,
        [STANDARD_NAME_TOKEN],
        newName,
        []
      );

      return JSON.parse(creationDataStr);
    } catch (e) {
      return creationObject;
    }
  }
  static async addBlockTypeFromGallery(project: Project, blockTypeProject: IGalleryItem, blockTypeName?: string) {
    blockTypeName = await ProjectCreateManager.copyGalleryPackFilesAndFixupIds(
      project,
      blockTypeProject,
      blockTypeName
    );

    await ProjectCreateManager._inferNewItems(project);

    const blockTypeItem = ProjectItemUtilities.getItemByTypeAndName(
      project,
      blockTypeName,
      ProjectItemType.blockTypeBehavior
    );

    if (blockTypeItem) {
      if (!blockTypeItem.isContentLoaded) {
        await blockTypeItem.loadContent();
      }

      if (blockTypeItem.primaryFile) {
        const blockType = await BlockTypeDefinition.ensureOnFile(blockTypeItem.primaryFile);

        const creationData = this.getReplacedCreationData(project, blockTypeProject, blockTypeName);

        if (blockType) {
          await blockType.ensureBlockAndTerrainLinks(project, creationData);
        }
      }
    }

    await project.save();
  }

  static async addItemTypeFromGallery(project: Project, itemTypeProject: IGalleryItem, itemTypeName?: string) {
    await ProjectCreateManager.copyGalleryPackFilesAndFixupIds(project, itemTypeProject, itemTypeName);

    await ProjectCreateManager._inferNewItems(project);

    await project.save();
  }

  /**
   * Adds a model design template to a project.
   * Creates both a .model.json file and the exported .geo.json + texture.png in the resource pack.
   * @param project The project to add the model design to
   * @param modelDesignItem The gallery item containing the model design template info
   * @param modelName The name for the new model
   */
  static async addModelDesignFromGallery(
    project: Project,
    modelDesignItem: IGalleryItem,
    modelName?: string
  ): Promise<void> {
    if (!modelName) {
      modelName = modelDesignItem.id;
    }

    // Get the model template from the gallery item
    // The template ID is stored in the gallery item's id field
    const templateId = modelDesignItem.id;
    const modelDesign = await Database.ensureModelTemplateLoaded(templateId);

    if (!modelDesign) {
      Log.fail(`Could not load model template: ${templateId}`);
      return;
    }

    // Clone the design and update the identifier with the new name
    const designCopy = JSON.parse(JSON.stringify(modelDesign));
    designCopy.identifier = modelName;

    // Ensure we have a resource pack
    const rpFolder = await project.ensureDefaultResourcePackFolder();
    if (!rpFolder) {
      Log.fail("Could not ensure resource pack folder for model design");
      return;
    }

    // Create the model templates folder and save the model design JSON
    const modelTemplatesFolder = rpFolder.ensureFolder("model_templates");
    await modelTemplatesFolder.ensureExists();

    const modelJsonFile = modelTemplatesFolder.ensureFile(modelName + ".model.json");
    modelJsonFile.setContent(JSON.stringify(designCopy, null, 2));
    await modelJsonFile.saveContent();

    // Convert to geometry
    const conversionResult = ModelDesignUtilities.convertToGeometry(designCopy);

    if (conversionResult.geometry) {
      // Create the models folder and save geometry
      const modelsFolder = rpFolder.ensureFolder("models");
      await modelsFolder.ensureExists();
      const entitiesFolder = modelsFolder.ensureFolder("entities");
      await entitiesFolder.ensureExists();

      const geoFile = entitiesFolder.ensureFile(modelName + ".geo.json");
      geoFile.setContent(JSON.stringify(conversionResult.geometry, null, 2));
      await geoFile.saveContent();
    }

    // Note: Texture generation requires platform-specific code (ImageGenerationUtilities)
    // The model design JSON file in model_templates/ contains all the texture info
    // and can be used to regenerate textures using the MCP tools or export commands.

    await project.inferProjectItemsFromFiles(true);
    await project.save();
  }

  static async copyGalleryPackFilesAndFixupIds(
    project: Project,
    galleryProject: IGalleryItem,
    newTypeName?: string,
    messagerUpdater?: (message: string) => Promise<void>,
    dontOverwriteExistingFiles?: boolean
  ): Promise<string> {
    const files = galleryProject.fileList;

    if (newTypeName === undefined) {
      newTypeName = galleryProject.id;
    }

    if (files === undefined) {
      Log.unexpectedUndefined("AETFLS");
      return newTypeName;
    }

    let sourceBpFolder = undefined;
    let sourceRpFolder = undefined;

    // Project-local source: filePaths are project-relative, read from project's own folders.
    // Rebuild the file list fresh from the relationship graph since it may have been
    // stale when the gallery item was constructed (processRelations uses setTimeout batching
    // in the browser, so the fileList built at dialog-open time may be incomplete).
    if (galleryProject.isProjectItem) {
      // Find the source ProjectItem by matching the gallery item's id against project items
      const freshFilePaths = await ProjectCreateManager._resolveProjectItemFilePaths(project, galleryProject);

      return ProjectCreateManager._copyProjectItemFiles(
        project,
        galleryProject,
        freshFilePaths.length > 0 ? freshFilePaths : files,
        newTypeName,
        messagerUpdater,
        dontOverwriteExistingFiles
      );
    } else if (galleryProject.gitHubRepoName === "bedrock-samples") {
      sourceBpFolder = await Database.getReleaseVanillaBehaviorPackFolder();
      sourceRpFolder = await Database.getReleaseVanillaResourcePackFolder();
    } else {
      // Map GitHub repo names to local folder names. When samples are downloaded
      // during preparedevenv, the zip's root folder is renamed via the
      // "replaceFirstFolderWith" field in reslist/*.resources.json. The local
      // folder name doesn't match the "{repoName}-{branch}" pattern that GitHub
      // uses, so we need an explicit mapping here.
      const repoFolderMap: Record<string, string> = {
        "minecraft-samples": "samples",
        "minecraft-gametests": "gametests",
        "minecraft-scripting-samples": "script-samples",
      };

      const repoFolder =
        repoFolderMap[galleryProject.gitHubRepoName] ||
        galleryProject.gitHubRepoName +
          "-" +
          (galleryProject.gitHubBranch ? galleryProject.gitHubBranch : "main");

      const url =
        Utilities.ensureEndsWithSlash(CreatorToolsHost.getVanillaContentRoot()) +
        "res/samples/" +
        Utilities.ensureEndsWithSlash(galleryProject.gitHubOwner) +
        Utilities.ensureEndsWithSlash(repoFolder) +
        (galleryProject.gitHubFolder ? Utilities.ensureNotStartsWithSlash(galleryProject.gitHubFolder) : "");

      const gh = HttpStorage.get(url); //new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);

      if (!gh.rootFolder.isLoaded) {
        await gh.rootFolder.load();
      }

      const bps = gh.rootFolder.folders["behavior_packs"];
      const rps = gh.rootFolder.folders["resource_packs"];

      if (!bps || !rps) {
        Log.unexpectedUndefined("AETFLT");
        return newTypeName;
      }

      if (!rps.isLoaded) {
        await rps.load();
      }

      if (!bps.isLoaded) {
        await bps.load();
      }

      if (rps.folderCount < 1 || bps.folderCount < 1) {
        Log.unexpectedUndefined("AETFLY");
        return newTypeName;
      }

      sourceBpFolder = bps.getFolderByIndex(0);
      sourceRpFolder = rps.getFolderByIndex(0);
    }

    const targetBpFolder = await project.ensureDefaultBehaviorPackFolder();
    const targetRpFolder = await project.ensureDefaultResourcePackFolder();

    if (
      !sourceBpFolder ||
      !sourceRpFolder ||
      !sourceBpFolder ||
      !sourceRpFolder ||
      !targetBpFolder ||
      !targetRpFolder
    ) {
      Log.unexpectedUndefined("AETVA");
      return newTypeName;
    }

    // note: '"identifier"', was in this list for entity types, but was removed.
    let contentReplacements = ['"materials"'];

    for (const filePath of files) {
      if (filePath.startsWith("/behavior_pack")) {
        let subPath = undefined;

        if (filePath.startsWith("/behavior_pack/")) {
          subPath = filePath.substring(14);
        } else {
          const nextSlash = filePath.indexOf("/", 16);

          if (nextSlash < 0) {
            Log.unexpectedUndefined("AETVB");
            return newTypeName;
          }

          subPath = filePath.substring(nextSlash);
        }

        const targetPath = ProjectCreateManager.replaceNamesInPath(subPath, project, galleryProject, newTypeName);

        const sourceFile = await sourceBpFolder.getFileFromRelativePath(subPath);

        if (!sourceFile) {
          Log.debugAlert("Could not find file '" + subPath + "'  (GPFFIA)");
        } else {
          const targetFile = await targetBpFolder.ensureFileFromRelativePath(targetPath);
          let update = true;

          if (dontOverwriteExistingFiles) {
            const targetExists = await targetFile.exists();

            if (targetExists) {
              update = false;
            }
          }

          if (update) {
            if (!sourceFile.isContentLoaded) {
              await sourceFile.loadContent();
            }

            let content = sourceFile.content;

            if (typeof content === "string") {
              content = ProjectCreateManager.replaceNamesInContent(
                content,
                project,
                galleryProject,
                newTypeName,
                contentReplacements
              );
            }

            if (content !== null) {
              if (messagerUpdater) {
                messagerUpdater("Updating '" + targetFile.fullPath + "'");
              }

              targetFile.setContent(content);
            }
          }
        }
      } else if (filePath.startsWith("/resource_pack")) {
        let subPath = undefined;

        if (filePath.startsWith("/resource_pack/")) {
          subPath = filePath.substring(14);
        } else {
          const nextSlash = filePath.indexOf("/", 16);

          if (nextSlash < 0) {
            Log.unexpectedUndefined("AETVC");
            return newTypeName;
          }

          subPath = filePath.substring(nextSlash);
        }

        const targetPath = ProjectCreateManager.replaceNamesInPath(subPath, project, galleryProject, newTypeName);

        if (subPath.indexOf("cow.v2.render_controllers") >= 0) {
          subPath = subPath.replace("cow.v2.render_controllers", "cow.v2.render_controllres"); // misspelling in source
        }

        const sourceFile = await sourceRpFolder.getFileFromRelativePath(subPath);

        if (!sourceFile) {
          Log.debugAlert("Could not find file '" + subPath + "' (GPFFIB)");
        } else {
          const targetFile = await targetRpFolder.ensureFileFromRelativePath(targetPath);
          let update = true;

          if (update) {
            if (dontOverwriteExistingFiles) {
              const targetExists = await targetFile.exists();

              if (targetExists) {
                update = false;
              }
            }

            if (!sourceFile.isContentLoaded) {
              await sourceFile.loadContent();
            }

            let content = sourceFile.content;

            if (typeof content === "string") {
              content = ProjectCreateManager.replaceNamesInContent(
                content,
                project,
                galleryProject,
                newTypeName,
                contentReplacements
              );
            }

            if (content !== null) {
              if (messagerUpdater) {
                messagerUpdater("Updating '" + targetFile.fullPath + "'");
              }

              targetFile.setContent(content);
            }
          }
        }
      }
    }

    return newTypeName;
  }

  /**
   * Resolves the complete file list for a project item at copy time by finding the
   * source ProjectItem, ensuring its content and relations are loaded, and collecting
   * all descendant file paths. This avoids stale file lists from dialog-open time.
   */
  private static async _resolveProjectItemFilePaths(project: Project, galleryProject: IGalleryItem): Promise<string[]> {
    const sourceId = galleryProject.id;

    // Map gallery type to project item type
    let itemType: ProjectItemType;
    switch (galleryProject.type) {
      case GalleryItemType.entityType:
        itemType = ProjectItemType.entityTypeBehavior;
        break;
      case GalleryItemType.blockType:
        itemType = ProjectItemType.blockTypeBehavior;
        break;
      case GalleryItemType.itemType:
        itemType = ProjectItemType.itemTypeBehavior;
        break;
      default:
        return [];
    }

    // Find the source item by matching the short ID against project items
    const candidates = project.getItemsByType(itemType);
    let sourceItem: ProjectItem | undefined;

    for (const item of candidates) {
      const shortId = ProjectCreateManager.getShortIdFromProjectItem(item);
      if (shortId === sourceId) {
        sourceItem = item;
        break;
      }
    }

    if (!sourceItem) {
      Log.debug(`[ProjectCreateManager] Could not find source project item for '${sourceId}'`);
      return [];
    }

    // Check if relations are already built (from worker pipeline or previous processRelations call).
    // If so, just traverse the existing relationship graph — no expensive rebuild needed.
    if (sourceItem.childItems && sourceItem.childItems.length > 0) {
      const filePaths = ProjectCreateManager.collectRelatedFilePaths(sourceItem);
      Log.debug(`[ProjectCreateManager] Resolved ${filePaths.length} files using existing relations for '${sourceId}'`);
      return filePaths;
    }

    // Do a targeted relations calculation for just the source item and its children.
    // This is fast even for large projects since we only process a handful of items,
    // rather than waiting for the full project processRelations (which can take minutes for 21K+ items).
    Log.debug(`[ProjectCreateManager] Doing targeted relations calculation for '${sourceId}'`);

    // Ensure content is loaded for the source item
    if (!sourceItem.isContentLoaded) {
      await sourceItem.loadContent();
    }

    const { default: ProjectItemRelations } = await import("./ProjectItemRelations");
    await ProjectItemRelations.calculateForItem(sourceItem);

    // The entity BP's addChildItems finds entity RP items. Now process those children too.
    if (sourceItem.childItems) {
      for (const rel of sourceItem.childItems) {
        if (rel.childItem) {
          await ProjectItemRelations.calculateForItem(rel.childItem);
        }
      }
    }

    // Now collect related file paths
    const filePaths = ProjectCreateManager.collectRelatedFilePaths(sourceItem);

    Log.debug(
      `[ProjectCreateManager] Resolved ${filePaths.length} files via targeted calculation for '${sourceId}': ${filePaths.join(", ")}`
    );

    return filePaths;
  }

  /**
   * Copies files from the current project (project-item source) to new locations in the same project
   * with renamed IDs. Used when creating a new entity/block/item based on an existing one in the project.
   *
   * filePaths are project-relative (e.g., "behavior_packs/mypack_bp/entities/zombie.json").
   * For each file, we determine whether it's in a BP or RP folder, extract the sub-path within
   * that pack, apply name replacements, and write to the project's default BP or RP folder.
   */
  private static async _copyProjectItemFiles(
    project: Project,
    galleryProject: IGalleryItem,
    filePaths: string[],
    newTypeName: string,
    messagerUpdater?: (message: string) => Promise<void>,
    dontOverwriteExistingFiles?: boolean
  ): Promise<string> {
    const projectFolder = project.projectFolder;

    Log.debug(
      `[ProjectCreateManager] _copyProjectItemFiles: copying ${filePaths.length} files for '${galleryProject.id}' → '${newTypeName}'`
    );

    if (!projectFolder) {
      Log.unexpectedUndefined("CPIF_PF");
      return newTypeName;
    }

    const defaultBpFolder = await project.ensureDefaultBehaviorPackFolder();
    const defaultRpFolder = await project.ensureDefaultResourcePackFolder();

    if (!defaultBpFolder || !defaultRpFolder) {
      Log.unexpectedUndefined("CPIF_TR");
      return newTypeName;
    }

    const contentReplacements = ['"materials"'];

    // Detect source pack folders from the file paths so we write to the same pack.
    // If we can find the source BP/RP pack folder, use it as target; otherwise fall back to defaults.
    let targetBpFolder = defaultBpFolder;
    let targetRpFolder = defaultRpFolder;

    for (const fp of filePaths) {
      const norm = fp.replace(/\\/g, "/");
      const bpFolderMatch = norm.match(/^\/?(behavior_packs?)\/([^/]+)\//i);
      const rpFolderMatch = norm.match(/^\/?(resource_packs?)\/([^/]+)\//i);
      // Also detect base-packs layout: /base-packs/vanilla/behavior/...
      const altBpFolderMatch = !bpFolderMatch
        ? norm.match(/^\/?((?:base-packs|experimental-packs)\/[^/]+)\/behavior\//i)
        : null;
      const altRpFolderMatch = !rpFolderMatch
        ? norm.match(/^\/?((?:base-packs|experimental-packs)\/[^/]+)\/resource\//i)
        : null;

      if (bpFolderMatch && targetBpFolder === defaultBpFolder) {
        const packName = bpFolderMatch[2];
        const bpContainer = projectFolder.folders["behavior_packs"] || projectFolder.folders["behavior_pack"];
        if (bpContainer) {
          const packFolder = bpContainer.folders[packName];
          if (packFolder) {
            targetBpFolder = packFolder;
            Log.debug(`[ProjectCreateManager] Using source BP pack folder: ${packName}`);
          }
        }
      } else if (altBpFolderMatch && targetBpFolder === defaultBpFolder) {
        // For base-packs layout, resolve the behavior subfolder as the BP target
        const basePath = altBpFolderMatch[1]; // e.g., "base-packs/vanilla"
        const behaviorFolder = await projectFolder.getFolderFromRelativePath("/" + basePath + "/behavior");
        if (behaviorFolder) {
          targetBpFolder = behaviorFolder;
          Log.debug(`[ProjectCreateManager] Using base-packs BP folder: ${basePath}/behavior`);
        }
      }

      if (rpFolderMatch && targetRpFolder === defaultRpFolder) {
        const packName = rpFolderMatch[2];
        const rpContainer = projectFolder.folders["resource_packs"] || projectFolder.folders["resource_pack"];
        if (rpContainer) {
          const packFolder = rpContainer.folders[packName];
          if (packFolder) {
            targetRpFolder = packFolder;
            Log.debug(`[ProjectCreateManager] Using source RP pack folder: ${packName}`);
          }
        }
      } else if (altRpFolderMatch && targetRpFolder === defaultRpFolder) {
        const basePath = altRpFolderMatch[1];
        const resourceFolder = await projectFolder.getFolderFromRelativePath("/" + basePath + "/resource");
        if (resourceFolder) {
          targetRpFolder = resourceFolder;
          Log.debug(`[ProjectCreateManager] Using base-packs RP folder: ${basePath}/resource`);
        }
      }
    }

    // We need to classify each file path as BP or RP and extract its sub-path within the pack.
    // Project-relative paths look like "behavior_packs/mypack_bp/entities/zombie.json"
    // or "resource_packs/mypack_rp/entity/zombie.entity.json".
    for (const filePath of filePaths) {
      let normalizedPath = filePath.replace(/\\/g, "/");

      // Ensure the path starts with / for getFileFromRelativePath
      if (!normalizedPath.startsWith("/")) {
        normalizedPath = "/" + normalizedPath;
      }

      let isBp = false;
      let isRp = false;
      let subPath: string | undefined;

      // Determine if this is a BP or RP file and extract the sub-path within the pack.
      // Handles multiple path formats:
      //   /behavior_packs/mypack_bp/entities/agent.json  (standard project layout)
      //   /base-packs/vanilla/behavior/entities/agent.json  (vanilla/sample project layout)
      //   /resource_packs/mypack_rp/entity/agent.entity.json
      //   /base-packs/vanilla/resource/entity/agent.entity.json
      const bpMatch = normalizedPath.match(/^\/?(behavior_packs?)\/[^/]+\/(.*)/i);
      const rpMatch = normalizedPath.match(/^\/?(resource_packs?)\/[^/]+\/(.*)/i);
      // Also match paths like /base-packs/vanilla/behavior/... or /experimental-packs/.../behavior/...
      const altBpMatch = !bpMatch ? normalizedPath.match(/\/behavior\/(.*)/i) : null;
      const altRpMatch = !rpMatch ? normalizedPath.match(/\/resource\/(.*)/i) : null;

      if (bpMatch) {
        isBp = true;
        subPath = "/" + bpMatch[2];
      } else if (rpMatch) {
        isRp = true;
        subPath = "/" + rpMatch[2];
      } else if (altBpMatch) {
        isBp = true;
        subPath = "/" + altBpMatch[1];
      } else if (altRpMatch) {
        isRp = true;
        subPath = "/" + altRpMatch[1];
      }

      if (!subPath || (!isBp && !isRp)) {
        Log.debug("Skipping non-pack file in project item copy: " + filePath);
        continue;
      }

      const targetPath = ProjectCreateManager.replaceNamesInPath(subPath, project, galleryProject, newTypeName);
      const targetFolder = isBp ? targetBpFolder : targetRpFolder;

      const sourceFile = await projectFolder.getFileFromRelativePath(normalizedPath);

      if (!sourceFile) {
        Log.debugAlert("Could not find project file '" + normalizedPath + "' (CPIF_SF)");
        continue;
      }

      Log.debug(`[ProjectCreateManager] Copying: ${normalizedPath} → ${targetPath} (${isBp ? "BP" : "RP"})`);

      const targetFile = await targetFolder.ensureFileFromRelativePath(targetPath);
      let update = true;

      if (dontOverwriteExistingFiles) {
        const targetExists = await targetFile.exists();
        if (targetExists) {
          update = false;
        }
      }

      if (update) {
        if (!sourceFile.isContentLoaded) {
          await sourceFile.loadContent();
        }

        let content = sourceFile.content;

        if (typeof content === "string") {
          content = ProjectCreateManager.replaceNamesInContent(
            content,
            project,
            galleryProject,
            newTypeName,
            contentReplacements
          );
        }

        if (content !== null) {
          if (messagerUpdater) {
            messagerUpdater("Updating '" + targetFile.fullPath + "'");
          }

          targetFile.setContent(content);
        }
      }
    }

    return newTypeName;
  }

  static replaceNamesInPath(path: string, project: Project, galleryProject: IGalleryItem, newName: string) {
    let pathReplacers = galleryProject.nameReplacers;

    if (!pathReplacers) {
      pathReplacers = [galleryProject.id];
    }

    newName = newName.toLowerCase();
    newName = newName.replace(/[- ]/g, "_");

    const tempName = Utilities.createRandomId(10);

    for (const pathReplacer of pathReplacers) {
      path = Utilities.replaceAll(path, "/" + pathReplacer + ".", "/" + tempName + ".");
      path = Utilities.replaceAll(path, "\\" + pathReplacer + ".", "\\" + tempName + ".");
      path = Utilities.replaceAll(path, "/" + pathReplacer + "/", "/" + tempName + "/");
      path = Utilities.replaceAll(path, "\\" + pathReplacer + "\\", "\\" + tempName + "\\");
      path = Utilities.replaceAll(path, "\\" + pathReplacer + "_", "\\" + tempName + "_");
      path = Utilities.replaceAll(path, "/" + pathReplacer + "_", "/" + tempName + "_");

      path = Utilities.replaceAll(path, "/" + pathReplacer + "_ico.", "/" + tempName + "_ico.");
      path = Utilities.replaceAll(path, "\\" + pathReplacer + "_ico.", "\\" + tempName + "_ico.");
      path = Utilities.replaceAll(path, "/" + pathReplacer + "_ico/", "/" + tempName + "_ico/");
      path = Utilities.replaceAll(path, "\\" + pathReplacer + "_ico\\", "\\" + tempName + "_ico\\");
    }

    path = Utilities.replaceAll(path, tempName, newName);

    return path;
  }

  static replaceNamesInContent(
    content: string,
    project: Project,
    galleryProject: IGalleryItem,
    newName: string,
    replaceAllExclusions: string[]
  ) {
    let replacers = galleryProject.nameReplacers;

    if (!replacers) {
      replacers = [galleryProject.id];
    }

    // copy & extend
    replacers = replacers.slice();
    replacers.push(STANDARD_NAME_TOKEN);

    return this.replaceNamesInContentFromReplacers(content, project, replacers, newName, replaceAllExclusions);
  }

  static replaceNamesInContentFromReplacers(
    content: string,
    project: Project,
    replacers: string[],
    newName: string,
    replaceAllExclusions: string[]
  ) {
    newName = newName.toLowerCase();
    newName = newName.replace(/-/g, "_");
    newName = newName.replace(/ /g, "_");

    const tempName = Utilities.createRandomLowerId(10);

    for (const replacer of replacers) {
      content = Utilities.replaceAll(
        content,
        "minecraft:" + replacer,
        project.effectiveDefaultNamespace + ":" + tempName
      );

      content = Utilities.replaceAll(content, "demo:" + replacer, project.effectiveDefaultNamespace + ":" + tempName);
      content = Utilities.replaceAll(
        content,
        "starter:" + replacer,
        project.effectiveDefaultNamespace + ":" + tempName
      );
      content = Utilities.replaceAll(content, "sample:" + replacer, project.effectiveDefaultNamespace + ":" + tempName);

      content = Utilities.replaceAllExceptInLines(content, ":" + replacer, ":" + tempName, replaceAllExclusions);

      content = Utilities.replaceAllExceptInLines(content, "/" + replacer, "/" + tempName, replaceAllExclusions);

      content = Utilities.replaceAllExceptInLines(content, "." + replacer, "." + tempName, replaceAllExclusions);

      content = Utilities.replaceAllExceptInLines(content, replacer + "_", tempName + "_", replaceAllExclusions);

      content = Utilities.replaceAllExceptInLines(
        content,
        '"' + replacer + '"',
        '"' + tempName + '"',
        replaceAllExclusions
      );

      for (const materialName of MATERIAL_NAMES_TO_FIXUP) {
        content = Utilities.replaceAll(content, materialName + '": "' + tempName, materialName + '": "' + replacer);
      }
    }

    content = Utilities.replaceAll(content, tempName, newName);

    return content;
  }
}
