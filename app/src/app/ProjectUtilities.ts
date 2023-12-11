import StorageUtilities from "../storage/StorageUtilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import Project from "./Project";
import { ProjectItemType, ProjectItemStorageType } from "./IProjectItemData";
import Database from "../minecraft/Database";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import { ProjectEditPreference, ProjectScriptLanguage } from "./IProjectData";
import BlockType from "../minecraft/BlockType";
import BehaviorManifestJson from "../minecraft/BehaviorManifestJson";
import NpmPackageJson from "../devproject/NpmPackageJson";
import ResourceManifestJson from "../minecraft/ResourceManifestJson";
import ISnippet from "./ISnippet";
import IGalleryProject from "./IGalleryProject";

export enum NewEntityTypeAddMode {
  baseId,
}

export default class ProjectUtilities {
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

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const manifestJson = await BehaviorManifestJson.ensureOnFile(projectItem.file);

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

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.packageJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const npmPackageJson = await NpmPackageJson.ensureOnFile(projectItem.file);

            if (npmPackageJson && npmPackageJson.definition) {
              npmPackageJson.definition.description = newDescription;
              npmPackageJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const manifestJson = await BehaviorManifestJson.ensureOnFile(projectItem.file);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.description = newDescription;

              manifestJson.save();
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

  static async applyTitle(project: Project, newTitle: string) {
    project.title = newTitle;

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      for (const projectItem of project.items) {
        /* for NPM, we'll not use title, but name and description.
        if (projectItem.file && projectItem.itemType === ProjectItemType.packageJson) {
          const npmPackageJson = await NpmPackageJson.ensureOnFile(projectItem.file);

          if (npmPackageJson && npmPackageJson.definition) {
            npmPackageJson.definition.description = newTitle;
            npmPackageJson.save();
          }
        } else */ if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const manifestJson = await BehaviorManifestJson.ensureOnFile(projectItem.file);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.name = newTitle;

              manifestJson.save();
            }
          }
        }
      }
    }
  }

  static async applyBehaviorPackUniqueId(project: Project, newBehaviorPackId: string) {
    const oldBehaviorPackId = project.defaultBehaviorPackUniqueId;

    project.defaultBehaviorPackUniqueId = newBehaviorPackId;

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      let bpackCount = 0;

      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          bpackCount++;
        }
      }

      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const manifestJson = await BehaviorManifestJson.ensureOnFile(projectItem.file);

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

    project.defaultResourcePackUniqueId = newResourcePackId;

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultResourcePackUniqueId) {
      let rpackCount = 0;

      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          rpackCount++;
        }
      }

      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const manifestJson = await ResourceManifestJson.ensureOnFile(projectItem.file);

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

  static async applyName(project: Project, newName: string) {
    project.name = newName;

    const isPackFolderManaged = project.getIsPackFolderManaged();

    if (project.editPreference === ProjectEditPreference.summarized && project.defaultBehaviorPackUniqueId) {
      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.packageJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            const npmPackageJson = await NpmPackageJson.ensureOnFile(projectItem.file);

            if (npmPackageJson && npmPackageJson.definition) {
              npmPackageJson.definition.name = newName;
              npmPackageJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            if (isPackFolderManaged) {
              const manifestParentFolder = projectItem.file.parentFolder;

              await manifestParentFolder.rename(newName + "_bp");
            }

            const manifestJson = await BehaviorManifestJson.ensureOnFile(projectItem.file);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultBehaviorPackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.name = newName;

              manifestJson.save();
            }
          }
        } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          await projectItem.ensureFileStorage();

          if (projectItem.file) {
            if (isPackFolderManaged) {
              const manifestParentFolder = projectItem.file.parentFolder;

              await manifestParentFolder.rename(newName + "_rp");
            }

            const manifestJson = await ResourceManifestJson.ensureOnFile(projectItem.file);

            if (
              manifestJson &&
              manifestJson.definition &&
              Utilities.uuidEqual(manifestJson.definition.header.uuid, project.defaultResourcePackUniqueId)
            ) {
              const header = manifestJson.ensureHeader(project.title, project.description);

              header.name = newName;

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
    caption = caption.replace(/_/g, "");
    caption = caption.replace(/ /g, "");
    caption = caption.replace(/:/g, "");
    caption = caption.replace(/;/g, "");
    caption = caption.replace(/=/g, "");

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

  static getSuggestedProjectName(project: IGalleryProject) {
    return this.getSuggestedProjectNameFromElements(project.id, project.gitHubFolder, project.gitHubRepoName);
  }

  static getSuggestedProjectNameFromElements(id?: string, gitHubFolder?: string, gitHubRepoName?: string) {
    let projName = "my-";

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
    const scriptsFolder = await project.ensureScriptsFolder();

    if (project.projectFolder === null) {
      return undefined;
    }

    return scriptsFolder.getFolderRelativePath(project.projectFolder);
  }

  static async applyTitleAndName(project: Project, title: string, name: string) {
    await ProjectUtilities.applyTitle(project, title);
  }

  static async randomizeAllUids(project: Project) {
    const uids: { [name: string]: string } = {};
    let setBehaviorPack = false;
    let setResourcePack = false;

    uids["defaultResourcePack"] = project.defaultResourcePackUniqueId;
    uids["defaultBehaviorPack"] = project.defaultBehaviorPackUniqueId;
    uids["defaultDataPack"] = project.defaultDataUniqueId;
    uids["defaultScriptModulePack"] = project.defaultScriptModuleUniqueId;

    project.defaultResourcePackUniqueId = Utilities.createUuid();
    project.defaultBehaviorPackUniqueId = Utilities.createUuid();
    project.defaultDataUniqueId = Utilities.createUuid();
    project.defaultScriptModuleUniqueId = Utilities.createUuid();

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.file) {
        if (pi.itemType === ProjectItemType.behaviorPackManifestJson && !setBehaviorPack) {
          const bpManifestJson = await BehaviorManifestJson.ensureOnFile(pi.file);

          if (bpManifestJson) {
            if (bpManifestJson.uuid && Utilities.uuidEqual(bpManifestJson.uuid, uids["defaultBehaviorPack"])) {
              bpManifestJson.uuid = project.defaultBehaviorPackUniqueId;
              setBehaviorPack = true;
              await bpManifestJson.save();
            }
          }
        } else if (pi.itemType === ProjectItemType.resourcePackManifestJson && !setResourcePack) {
          const rpManifestJson = await ResourceManifestJson.ensureOnFile(pi.file);

          if (rpManifestJson) {
            if (rpManifestJson.uuid && Utilities.uuidEqual(rpManifestJson.uuid, uids["defaultResourcePack"])) {
              rpManifestJson.uuid = project.defaultResourcePackUniqueId;
              setResourcePack = true;
              await rpManifestJson.save();
            }
          }
        }
      }
    }

    await project.save();
  }

  static async addEntityType(
    project: Project,
    entityTypeProject: IGalleryProject,
    entityTypeName?: string,
    addMode?: NewEntityTypeAddMode
  ) {
    const files = entityTypeProject.fileList;
    const defaultScriptsPath = await ProjectUtilities.getBaseScriptsPath(project);

    if (files === undefined) {
      Log.unexpectedUndefined("AETFLS");
      return;
    }

    if (entityTypeName === undefined) {
      entityTypeName = entityTypeProject.id;
    }

    const vanillaBpFolder = await Database.loadDefaultBehaviorPack();
    const vanillaRpFolder = await Database.loadDefaultResourcePack();

    const targetBpFolder = await project.ensureDefaultBehaviorPackFolder();
    const targetRpFolder = await project.ensureDefaultResourcePackFolder();

    if (
      !vanillaBpFolder ||
      !vanillaRpFolder ||
      !vanillaBpFolder ||
      !vanillaRpFolder ||
      !targetBpFolder ||
      !targetRpFolder
    ) {
      Log.unexpectedUndefined("AETVA");
      return;
    }

    for (const filePath of files) {
      const filePathCanon = filePath.toLowerCase();

      if (filePathCanon.startsWith("/behavior_pack/")) {
        const subPath = filePathCanon.substring(14);
        const targetPath = ProjectUtilities.replaceNamesInPath(subPath, project, entityTypeProject, entityTypeName);

        const sourceFile = await vanillaBpFolder.getFileFromRelativePath(subPath);

        if (!sourceFile) {
          Log.debugAlert("Could not find file '" + subPath + "'");
        } else {
          const targetFile = await targetBpFolder.ensureFileFromRelativePath(targetPath);

          await sourceFile.loadContent();

          let content = sourceFile.content;

          if (typeof content === "string") {
            content = ProjectUtilities.replaceNamesInContent(content, project, entityTypeProject, entityTypeName);
          }

          if (content !== null) {
            targetFile.setContent(content);
          }
        }
      } else if (filePathCanon.startsWith("/resource_pack/")) {
        const subPath = filePathCanon.substring(14);
        const targetPath = ProjectUtilities.replaceNamesInPath(subPath, project, entityTypeProject, entityTypeName);

        const sourceFile = await vanillaRpFolder.getFileFromRelativePath(subPath);

        if (!sourceFile) {
          Log.debugAlert("Could not find file '" + subPath + "'");
        } else {
          const targetFile = await targetRpFolder.ensureFileFromRelativePath(targetPath);

          await sourceFile.loadContent();

          let content = sourceFile.content;

          if (typeof content === "string") {
            content = ProjectUtilities.replaceNamesInContent(content, project, entityTypeProject, entityTypeName);
          }

          if (content !== null) {
            targetFile.setContent(content);
          }
        }
      }
    }

    await project.inferProjectItemsFromFiles();

    if (project.preferredScriptLanguage === ProjectScriptLanguage.javaScript) {
      const candidateJsFilePath = await ProjectUtilities.getFileName(
        project,
        defaultScriptsPath + "generated/",
        entityTypeName + ".base",
        "js",
        true
      );

      if (candidateJsFilePath) {
        const piGenJs = project.ensureItemByStoragePath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.entityTypeBaseJs,
          true
        );

        piGenJs.updateAutogenerated();
      }
    } else if (project.preferredScriptLanguage === ProjectScriptLanguage.typeScript) {
      const candidateJsFilePath = await ProjectUtilities.getFileName(
        project,
        defaultScriptsPath + "generated/",
        entityTypeName + ".base",
        "ts",
        true
      );

      if (candidateJsFilePath) {
        const piGenJs = project.ensureItemByStoragePath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.entityTypeBaseTs,
          true
        );

        piGenJs.updateAutogenerated();
      }
    }

    await project.save();
  }

  static replaceNamesInPath(path: string, project: Project, entityTypeProject: IGalleryProject, newName: string) {
    path = Utilities.replaceAll(path, entityTypeProject.id, newName);

    return path;
  }

  static replaceNamesInContent(content: string, project: Project, entityTypeProject: IGalleryProject, newName: string) {
    content = Utilities.replaceAll(
      content,
      "minecraft:" + entityTypeProject.id,
      project.effectiveDefaultNamespace + ":" + newName
    );
    content = Utilities.replaceAll(content, entityTypeProject.id, newName);

    return content;
  }

  static getSnippet(snippetId: string) {
    if (Database.snippetsFolder !== null && Database.snippetsFolder.files) {
      for (const fileName in Database.snippetsFolder.files) {
        const file = Database.snippetsFolder.files[fileName];

        if (file) {
          const snipSet = StorageUtilities.getJsonObject(file) as { [snippetName: string]: ISnippet };
          if (snipSet[snippetId]) {
            return snipSet[snippetId];
          }
        }
      }
    }

    return undefined;
  }

  static CodeReplaceTokens = ["say Hello", 'sendMessage("Hello world'];

  static adaptSample(sampleContent: string, fileContent: string) {
    const result = {
      sampleContent: sampleContent,
      newIntroLines: "",
    };

    if (sampleContent.indexOf(" mc.") >= 0 && fileContent.indexOf(" as mc") <= 0) {
      result.sampleContent = result.sampleContent.replace(/mc./gi, "");
    }

    /*if (sampleContent.indexOf("targetLocation") >= 0 && fileContent.indexOf("targetLocation") <= 0) {
      result.sampleContent = result.sampleContent.replace(/targetLocation/gi, "{ x: 0, y: 64, z: 0 }");
    }*/

    return result;
  }

  static async injectSnippet(project: Project, snippet: ISnippet) {
    const replaceContent = "\r\n" + snippet.body.join("\n") + "\r\n";

    const folder = await project.ensureScriptsFolder();

    await folder.load(false);

    // Log.debugAlert("Inject snippet considering folder: " + folder.storageRelativePath + "|" + replaceContent);
    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file !== undefined) {
        const type = StorageUtilities.getTypeFromName(file.name);

        if (type === "ts" || type === "js") {
          await file.loadContent();

          // Log.debugAlert("Inject snippet considering file: " + file.storageRelativePath + "|" + file.content?.length);
          if (file.content && typeof file.content === "string") {
            let content = file.content;

            for (let i = 0; i < this.CodeReplaceTokens.length; i++) {
              const token = content.indexOf(this.CodeReplaceTokens[i]);

              if (token >= 0) {
                const previousNewLine = content.lastIndexOf("\n", token);
                const nextNewLine = content.indexOf("\n", token);
                if (previousNewLine >= 0 && nextNewLine > previousNewLine) {
                  const replacer = ProjectUtilities.adaptSample(replaceContent, content);

                  content =
                    replacer.newIntroLines +
                    content.substring(0, previousNewLine) +
                    replacer.sampleContent +
                    content.substring(nextNewLine + 1);

                  if (
                    replacer.sampleContent.indexOf("overworld") >= 0 &&
                    replacer.sampleContent.indexOf("const overworld") <= 0
                  ) {
                    let firstComment = content.indexOf("//");
                    if (firstComment >= 0) {
                      content =
                        content.substring(0, firstComment) +
                        '  const overworld = mc.world.getDimension("overworld");\r\n' +
                        content.substring(firstComment, content.length);
                    }
                  }
                  file.setContent(content);
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

    await Database.loadDefaultBehaviorPack();

    if (Database.defaultBehaviorPackFolder === null) {
      Log.fail("Could not find default behavior pack folder");
      return;
    }

    const sourceFile = Database.defaultBehaviorPackFolder.ensureFolder("blocks").ensureFile(blockTypeId + ".json");

    await sourceFile.loadContent(true);

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

    const pi = project.ensureItemByStoragePath(
      candidateFilePath,
      ProjectItemStorageType.singleFile,
      nextBlockTypeName,
      ProjectItemType.blockTypeBehaviorJson,
      false
    );

    const file = await pi.ensureFileStorage();

    if (file !== null) {
      const content = Utilities.fixJsonContent(sourceFile.content);

      file.setContent(content);

      const et = await BlockType.ensureBlockTypeOnFile(file, undefined);

      if (et) {
        et.id =
          nextBlockTypeName.indexOf(":") >= 0
            ? nextBlockTypeName
            : project.effectiveDefaultNamespace + ":" + nextBlockTypeName;

        await et.persist();
      }

      await file.saveContent(true);
    }

    if (project.preferredScriptLanguage === ProjectScriptLanguage.javaScript) {
      const candidateJsFilePath = await ProjectUtilities.getFileName(
        project,
        defaultScriptsPath + "generated/",
        nextBlockTypeName + ".base",
        "js",
        true
      );

      if (candidateJsFilePath) {
        const piGenJs = project.ensureItemByStoragePath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.blockTypeBaseJs,
          true
        );

        piGenJs.updateAutogenerated();
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
        const piGenJs = project.ensureItemByStoragePath(
          candidateJsFilePath,
          ProjectItemStorageType.singleFile,
          StorageUtilities.getLeafName(candidateJsFilePath),
          ProjectItemType.blockTypeBaseTs,
          true
        );

        piGenJs.updateAutogenerated();
      }
    }
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
