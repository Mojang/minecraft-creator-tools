import Log from "../core/Log";
import Utilities from "../core/Utilities";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import Database from "../minecraft/Database";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import HttpStorage from "../storage/HttpStorage";
import CreatorToolsHost from "./CreatorToolsHost";
import IGalleryItem from "./IGalleryItem";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
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

    await project.inferProjectItemsFromFiles(true);

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

    await project.inferProjectItemsFromFiles(true);

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

    if (galleryProject.gitHubRepoName === "bedrock-samples") {
      sourceBpFolder = await Database.getReleaseVanillaBehaviorPackFolder();
      sourceRpFolder = await Database.getReleaseVanillaResourcePackFolder();
    } else {
      const url =
        Utilities.ensureEndsWithSlash(CreatorToolsHost.contentRoot) +
        "res/samples/" +
        Utilities.ensureEndsWithSlash(galleryProject.gitHubOwner) +
        galleryProject.gitHubRepoName +
        "-" +
        Utilities.ensureEndsWithSlash(galleryProject.gitHubBranch ? galleryProject.gitHubBranch : "main") +
        (galleryProject.gitHubFolder ? Utilities.ensureNotStartsWithSlash(galleryProject.gitHubFolder) : "");

      const gh = new HttpStorage(url); //new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);

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
