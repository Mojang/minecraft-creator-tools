// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import Database from "../minecraft/Database";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import HttpStorage from "../storage/HttpStorage";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
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

/** The behavior and resource packs that a gallery template's files are copied from. */
export interface IGalleryTemplateSourcePacks {
  behaviorPack: IFolder;
  resourcePack: IFolder;
}

// Pack-wide catalog files. A gallery item ships its own copy of these, but they belong to the whole
// resource pack rather than to the thing being added, so copying one over the top of the project's
// version would delete every other block's entries. These are deep-merged on copy instead.
export const MERGE_ON_COPY_FILE_NAMES = [
  "blocks.json",
  "terrain_texture.json",
  "item_texture.json",
  "sound_definitions.json",
  "music_definitions.json",
];

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

        // _inferNewItems only discovers the new files; it does not link them to each other. The block
        // editor decides whether a block has a texture by looking for the terrain texture catalog among
        // the block's childItems, so link the new block now that its catalog entries exist. This has to
        // run after ensureBlockAndTerrainLinks: relation building asks the catalog whether it knows the
        // block's texture id, and for unit cube blocks the entry is only written by that call.
        const { default: ProjectItemRelations } = await import("./ProjectItemRelations");
        await ProjectItemRelations.calculateForItem(blockTypeItem);
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

  /**
   * Writes one file copied out of a gallery item (or an existing project item) into the project.
   *
   * Most files belong solely to the thing being added, so a plain overwrite is right. The pack-wide
   * catalogs are the exception: they are shared by every block and item in the pack, so the copied
   * entries are merged into whatever the project already has rather than replacing the file.
   *
   * Either way the cached parse is dropped afterwards. Definitions hold onto a parsed copy of their
   * file and only reparse when unloaded, so without this a terrain texture catalog that the editor
   * already opened keeps answering questions about its previous contents and the new block looks like
   * it has no texture.
   */
  private static async _writeCopiedFile(targetFile: IFile, content: string | Uint8Array) {
    if (typeof content === "string" && MERGE_ON_COPY_FILE_NAMES.includes(targetFile.name.toLowerCase())) {
      if (!targetFile.isContentLoaded) {
        await targetFile.loadContent();
      }

      const existing = StorageUtilities.getJsonObject(targetFile);

      if (existing && typeof existing === "object") {
        try {
          const incoming = JSON.parse(Utilities.fixJsonContent(content));

          if (incoming && typeof incoming === "object") {
            targetFile.setContent(JSON.stringify(StorageUtilities.deepMergeJsonObjects(existing, incoming), null, 2));
            StorageUtilities.invalidateParsedContent(targetFile);
            return;
          }
        } catch (e) {
          // A catalog that can't be parsed can't be merged safely, so fall through to overwriting it.
          Log.error("Could not merge '" + targetFile.name + "' while copying gallery content: " + e);
        }
      }
    }

    targetFile.setContent(content);
    StorageUtilities.invalidateParsedContent(targetFile);
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
    }

    const sourceFolders = await ProjectCreateManager._getGallerySourcePackFolders(galleryProject);

    if (!sourceFolders) {
      return newTypeName;
    }

    const sourceBpFolder = sourceFolders.behaviorPack;
    const sourceRpFolder = sourceFolders.resourcePack;

    const targetBpFolder = await project.ensureDefaultBehaviorPackFolder();
    const targetRpFolder = await project.ensureDefaultResourcePackFolder();

    if (!targetBpFolder || !targetRpFolder) {
      Log.unexpectedUndefined("AETVA");
      return newTypeName;
    }

    // note: '"identifier"', was in this list for entity types, but was removed.
    let contentReplacements = ['"materials"'];

    for (const filePath of files) {
      if (filePath.startsWith("/behavior_pack")) {
        const subPath = ProjectCreateManager._getPackRelativePath(filePath);

        if (subPath === undefined) {
          Log.unexpectedUndefined("AETVB");
          return newTypeName;
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

            if (typeof content === "string" && ProjectCreateManager.isClientEntityPath(targetPath)) {
              content = ProjectCreateManager.fixupCopiedClientEntity(sourceFile.content as string, content);
            }

            if (content !== null) {
              if (messagerUpdater) {
                messagerUpdater("Updating '" + targetFile.fullPath + "'");
              }

              await ProjectCreateManager._writeCopiedFile(targetFile, content);
            }
          }
        }
      } else if (filePath.startsWith("/resource_pack")) {
        let subPath = ProjectCreateManager._getPackRelativePath(filePath);

        if (subPath === undefined) {
          Log.unexpectedUndefined("AETVC");
          return newTypeName;
        }

        const targetPath = ProjectCreateManager.replaceNamesInPath(subPath, project, galleryProject, newTypeName);

        subPath = ProjectCreateManager._getSourceResourcePackPath(subPath);

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

            if (typeof content === "string" && ProjectCreateManager.isClientEntityPath(targetPath)) {
              content = ProjectCreateManager.fixupCopiedClientEntity(sourceFile.content as string, content);
            }

            if (content !== null) {
              if (messagerUpdater) {
                messagerUpdater("Updating '" + targetFile.fullPath + "'");
              }

              await ProjectCreateManager._writeCopiedFile(targetFile, content);
            }
          }
        }
      }
    }

    return newTypeName;
  }

  /**
   * Whether the files a gallery template copies into a project can be loaded, checked without changing
   * any project. Entity, block, and item templates copy files from Minecraft's vanilla packs or from a
   * sample, which are downloaded unless they're stored locally: the CLI stores the samples, but not the
   * vanilla packs. Copying logs a file it can't download instead of throwing, so without a network it
   * adds nothing or only part of the template, and add checks this first to fail instead. Templates
   * that don't copy pack files, such as loot tables, return true.
   *
   * Copying skips a listed file that its pack doesn't have (some templates list files that the current
   * vanilla packs dropped), so this does too. But every listed file it finds must load, each pack the
   * list names must have at least one of them, and a listed file it doesn't find mustn't be in an empty
   * folder, which is what a folder whose download failed looks like. So a pack, a folder, or a file that
   * can't be downloaded fails. The loaded files stay cached, so the copy that follows doesn't download
   * them again.
   *
   * @param sourcePacks The packs to load from. Defaults to the template's own (see _getGallerySourcePackFolders).
   */
  static async canLoadGalleryTemplateFiles(
    galleryProject: IGalleryItem,
    sourcePacks?: IGalleryTemplateSourcePacks
  ): Promise<boolean> {
    const copiesPackFiles =
      galleryProject.type === GalleryItemType.entityType ||
      galleryProject.type === GalleryItemType.blockType ||
      galleryProject.type === GalleryItemType.itemType;

    if (!copiesPackFiles || galleryProject.isProjectItem) {
      return true;
    }

    const packs = sourcePacks ?? (await ProjectCreateManager._getGallerySourcePackFolders(galleryProject));

    if (!packs || !galleryProject.fileList) {
      return false;
    }

    // For each pack the list names, whether any of its listed files was found.
    const packHasFile = new Map<IFolder, boolean>();

    for (const filePath of galleryProject.fileList) {
      const source = ProjectCreateManager._getGallerySourcePath(filePath);

      if (source) {
        const pack = source.isBehaviorPack ? packs.behaviorPack : packs.resourcePack;
        const sourceFile = await pack.getFileFromRelativePath(source.path);

        if (sourceFile) {
          if (!sourceFile.isContentLoaded) {
            await sourceFile.loadContent();
          }

          if (sourceFile.content === null) {
            return false;
          }
        } else if (ProjectCreateManager._isInEmptyFolder(pack, source.path)) {
          return false;
        }

        packHasFile.set(pack, packHasFile.get(pack) === true || sourceFile !== undefined);
      }
    }

    return packHasFile.size > 0 && Array.from(packHasFile.values()).every((hasFile) => hasFile);
  }

  /** What to tell the user when canLoadGalleryTemplateFiles finds that a template's files can't be loaded. */
  static getGalleryTemplateUnavailableMessage(galleryProject: IGalleryItem) {
    return `Couldn't download the '${galleryProject.title}' template. Check your internet connection.`;
  }

  /**
   * Finds the behavior and resource packs a gallery template's files are copied from: Minecraft's
   * vanilla packs for templates from bedrock-samples, and otherwise the first packs in the template's
   * sample. Returns undefined when they can't be found.
   */
  private static async _getGallerySourcePackFolders(
    galleryProject: IGalleryItem
  ): Promise<IGalleryTemplateSourcePacks | undefined> {
    if (galleryProject.gitHubRepoName === "bedrock-samples") {
      const behaviorPack = await Database.getReleaseVanillaBehaviorPackFolder();
      const resourcePack = await Database.getReleaseVanillaResourcePackFolder();

      if (!behaviorPack || !resourcePack) {
        Log.unexpectedUndefined("AETVA");
        return undefined;
      }

      return { behaviorPack, resourcePack };
    }

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
      galleryProject.gitHubRepoName + "-" + (galleryProject.gitHubBranch ? galleryProject.gitHubBranch : "main");

    const relativePath =
      "res/samples/" +
      Utilities.ensureEndsWithSlash(galleryProject.gitHubOwner) +
      Utilities.ensureEndsWithSlash(repoFolder) +
      (galleryProject.gitHubFolder ? Utilities.ensureNotStartsWithSlash(galleryProject.gitHubFolder) : "");

    let rootFolder: IFolder | undefined;

    // Prefer local storage (CLI/Electron) over HTTP to avoid 404s on static hosts
    // that don't serve directory indexes.
    if (Database.local) {
      const storage = Database.local.createStorage(relativePath);
      if (storage) {
        const candidateFolder = storage.rootFolder;
        await candidateFolder.load();

        // Only use local storage if it actually contains the expected content;
        // otherwise fall back to HTTP.
        if (candidateFolder.folders["behavior_packs"] && candidateFolder.folders["resource_packs"]) {
          rootFolder = candidateFolder;
        }
      }
    }

    if (!rootFolder) {
      const url = Utilities.ensureEndsWithSlash(CreatorToolsHost.getVanillaContentRoot()) + relativePath;
      const gh = HttpStorage.get(url);
      rootFolder = gh.rootFolder;
    }

    if (!rootFolder.isLoaded) {
      await rootFolder.load();
    }

    const bps = rootFolder.folders["behavior_packs"];
    const rps = rootFolder.folders["resource_packs"];

    if (!bps || !rps) {
      Log.unexpectedUndefined("AETFLT");
      return undefined;
    }

    if (!rps.isLoaded) {
      await rps.load();
    }

    if (!bps.isLoaded) {
      await bps.load();
    }

    if (rps.folderCount < 1 || bps.folderCount < 1) {
      Log.unexpectedUndefined("AETFLY");
      return undefined;
    }

    const behaviorPack = bps.getFolderByIndex(0);
    const resourcePack = rps.getFolderByIndex(0);

    if (!behaviorPack || !resourcePack) {
      Log.unexpectedUndefined("AETVA");
      return undefined;
    }

    return { behaviorPack, resourcePack };
  }

  /**
   * The path inside its pack of a file in a gallery template's file list, which starts with the pack's
   * folder: /behavior_pack/entities/allay.json in the vanilla packs is /entities/allay.json, and
   * /resource_packs/starter_blocks/blocks.json in a sample is /blocks.json. Returns undefined when
   * nothing follows the pack's folder.
   */
  private static _getPackRelativePath(filePath: string): string | undefined {
    // "/behavior_pack" and "/resource_pack" are both 14 characters long.
    if (filePath.charAt(14) === "/") {
      return filePath.substring(14);
    }

    const nextSlash = filePath.indexOf("/", 16);

    return nextSlash < 0 ? undefined : filePath.substring(nextSlash);
  }

  /**
   * Which source pack a file in a gallery template's file list is in, and the path to look it up at
   * there, as copyGalleryPackFilesAndFixupIds looks it up. Returns undefined for a path in neither pack.
   */
  private static _getGallerySourcePath(filePath: string): { isBehaviorPack: boolean; path: string } | undefined {
    const isBehaviorPack = filePath.startsWith("/behavior_pack");

    if (!isBehaviorPack && !filePath.startsWith("/resource_pack")) {
      return undefined;
    }

    const subPath = ProjectCreateManager._getPackRelativePath(filePath);

    if (subPath === undefined) {
      return undefined;
    }

    return {
      isBehaviorPack,
      path: isBehaviorPack ? subPath : ProjectCreateManager._getSourceResourcePackPath(subPath),
    };
  }

  /** The vanilla resource pack misspells one file name, so a resource pack file is looked up under that name. */
  private static _getSourceResourcePackPath(subPath: string) {
    return subPath.replace("cow.v2.render_controllers", "cow.v2.render_controllres");
  }

  /**
   * Whether a folder on the way to a file in a pack, starting with the pack itself, is loaded but empty.
   * Folders in the vanilla packs and the samples aren't empty, but a folder whose download failed is:
   * HttpFolder logs the failure and marks the folder loaded with nothing in it. Call it after looking
   * the file up, which loads the folders on its way.
   */
  private static _isInEmptyFolder(pack: IFolder, path: string): boolean {
    const isLoadedAndEmpty = (folder: IFolder) => folder.isLoaded && folder.fileCount === 0 && folder.folderCount === 0;
    let folder = pack;

    for (const folderName of path.split("/").slice(1, -1)) {
      if (isLoadedAndEmpty(folder)) {
        return true;
      }

      const childFolder = folder.folders[StorageUtilities.canonicalizeName(folderName)];

      if (!childFolder) {
        return false;
      }

      folder = childFolder;
    }

    return isLoadedAndEmpty(folder);
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

        if (typeof content === "string" && ProjectCreateManager.isClientEntityPath(targetPath)) {
          content = ProjectCreateManager.fixupCopiedClientEntity(sourceFile.content as string, content);
        }

        if (content !== null) {
          if (messagerUpdater) {
            messagerUpdater("Updating '" + targetFile.fullPath + "'");
          }

          await ProjectCreateManager._writeCopiedFile(targetFile, content);
        }
      }
    }

    return newTypeName;
  }

  /** Whether a pack-relative path is a client entity definition, which fixupCopiedClientEntity post-processes. */
  static isClientEntityPath(path: string) {
    return path.toLowerCase().endsWith(".entity.json");
  }

  /**
   * Repairs the two things that renaming a copied client entity breaks.
   *
   * Material names refer to the game's material definitions (materials/entity.material), not to the
   * mob, so they have to survive renaming untouched. replaceNamesInContent only shields the first lines
   * of the materials block, so a mob named like its material ("cow", "creeper") can end up referencing
   * a material that does not exist and renders invisible. The materials are restored from the source.
   *
   * Format 1.10.0+ client entities animate through the animations map and scripts.animate; the
   * pre-1.10.0 animation_controllers list that some vanilla entities still carry next to the map is
   * reported as invalid by the game. Entries the map does not already cover are moved into it (and
   * into scripts.animate) and the list is dropped.
   *
   * Returns the content unchanged when either side does not parse as a client entity.
   */
  static fixupCopiedClientEntity(sourceContent: string, content: string): string {
    let source: any;
    let target: any;

    try {
      source = JSON.parse(Utilities.fixJsonContent(sourceContent));
      target = JSON.parse(Utilities.fixJsonContent(content));
    } catch (e) {
      return content;
    }

    const sourceDescription = source?.["minecraft:client_entity"]?.description;
    const description = target?.["minecraft:client_entity"]?.description;

    if (
      !sourceDescription ||
      typeof sourceDescription !== "object" ||
      !description ||
      typeof description !== "object"
    ) {
      return content;
    }

    let changed = false;

    if (
      sourceDescription.materials &&
      typeof sourceDescription.materials === "object" &&
      JSON.stringify(description.materials) !== JSON.stringify(sourceDescription.materials)
    ) {
      description.materials = sourceDescription.materials;
      changed = true;
    }

    const formatVersion = MinecraftUtilities.getVersionArrayFrom(target.format_version);
    const usesAnimationsMap =
      formatVersion !== undefined && (formatVersion[0] > 1 || (formatVersion[0] === 1 && formatVersion[1] >= 10));

    if (usesAnimationsMap && Array.isArray(description.animation_controllers)) {
      if (!description.animations || typeof description.animations !== "object") {
        description.animations = {};
      }

      if (!description.scripts || typeof description.scripts !== "object") {
        description.scripts = {};
      }

      if (!Array.isArray(description.scripts.animate)) {
        description.scripts.animate = [];
      }

      const coveredControllers = new Set<string>(
        Object.values(description.animations).filter((id): id is string => typeof id === "string")
      );

      for (const entry of description.animation_controllers) {
        if (!entry || typeof entry !== "object") {
          continue;
        }

        for (const key in entry) {
          const controllerId = entry[key];

          if (typeof controllerId !== "string" || coveredControllers.has(controllerId)) {
            continue;
          }

          const animationKey = ProjectCreateManager.unusedAnimationAlias(description.animations, key);

          description.animations[animationKey] = controllerId;
          description.scripts.animate.push(animationKey);
          coveredControllers.add(controllerId);
        }
      }

      delete description.animation_controllers;
      changed = true;
    }

    if (!changed) {
      return content;
    }

    return JSON.stringify(target, null, 2);
  }

  /**
   * The first of `key`, `key_controller`, `key_controller2`, ... that the animations map does not already
   * use, so a migrated legacy entry never overwrites a mapping that scripts.animate already relies on.
   */
  private static unusedAnimationAlias(animations: { [alias: string]: unknown }, key: string): string {
    if (animations[key] === undefined) {
      return key;
    }

    let alias = key + "_controller";

    for (let suffix = 2; animations[alias] !== undefined; suffix++) {
      alias = key + "_controller" + suffix;
    }

    return alias;
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
