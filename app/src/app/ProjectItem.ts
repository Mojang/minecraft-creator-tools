// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IProjectItemData, {
  ProjectItemCreationType,
  ProjectItemEditPreference,
  ProjectItemErrorStatus,
  ProjectItemStorageType,
} from "./IProjectItemData";
import Log from "./../core/Log";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import { EventDispatcher } from "ste-events";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IGitHubInfo from "./IGitHubInfo";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { ProjectEditPreference } from "./IProjectData";
import MCWorld from "../minecraft/MCWorld";
import ZipStorage from "../storage/ZipStorage";
import Utilities from "../core/Utilities";
import { StorageErrorStatus } from "../storage/IStorage";
import ProjectItemUtilities from "./ProjectItemUtilities";
import Pack from "../minecraft/Pack";
import ProjectAutogeneration from "./ProjectAutogeneration";
import ProjectItemRelationship from "./IProjectItemRelationship";
import IProjectItemRelationship from "./IProjectItemRelationship";
import IProjectItemUnfulfilledRelationship from "./IProjectItemUnfulfilledRelationship";
import ProjectItemRelations from "./ProjectItemRelations";

export default class ProjectItem {
  private _data: IProjectItemData;
  private _project: Project;
  private _onPropertyChanged = new EventDispatcher<ProjectItem, string>();
  private _onFileRetrieved = new EventDispatcher<ProjectItem, IFile>();
  private _onFolderRetrieved = new EventDispatcher<ProjectItem, IFolder>();
  private _onLoaded = new EventDispatcher<ProjectItem, ProjectItem>();
  private _file: IFile | null;
  private _pendingLoadRequests: ((value: unknown) => void)[] = [];
  private _isLoading: boolean = false;
  private _folder: IFolder | null;
  private _isFileContentProcessed: boolean = false;
  private _imageUrlBase64Cache: string | undefined;
  private _pack: Pack | undefined;

  public parentItems: ProjectItemRelationship[] | undefined;
  public childItems: ProjectItemRelationship[] | undefined;
  public unfulfilledRelationships: IProjectItemUnfulfilledRelationship[] | undefined;

  constructor(parent: Project, incomingData?: IProjectItemData) {
    this._project = parent;
    this._file = null;
    this._folder = null;
    this._isFileContentProcessed = false;
    this._handleMCWorldLoaded = this._handleMCWorldLoaded.bind(this);

    if (incomingData !== undefined && incomingData !== null) {
      this._data = incomingData;
    } else {
      this._data = {
        itemType: ProjectItemType.unknown,
        projectPath: null,
        storageType: ProjectItemStorageType.singleFile,
        tags: [],
        name: "",
      };
    }
  }

  public get parentItemCount() {
    if (this.parentItems === undefined) {
      return 0;
    }

    return this.parentItems.length;
  }

  public get childItemCount() {
    if (this.childItems === undefined) {
      return 0;
    }

    return this.childItems.length;
  }

  public get unfulfilledRelationshipsCount() {
    if (this.unfulfilledRelationships === undefined) {
      return 0;
    }

    return this.unfulfilledRelationships.length;
  }

  public get isInWorld() {
    return this._data.isInWorld;
  }

  public set isInWorld(isInWorld: boolean | undefined) {
    this._data.isInWorld = isInWorld;
  }

  public get project() {
    return this._project;
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get onFileRetrieved() {
    return this._onFileRetrieved.asEvent();
  }

  public get onFolderRetrieved() {
    return this._onFolderRetrieved.asEvent();
  }

  public get gitHubReference() {
    return this._data.gitHubReference;
  }

  public get isInFileContainer() {
    if (!this.projectPath) {
      return false;
    }

    return this.projectPath.indexOf("#") >= 0;
  }

  public get isFileContainerStorageItem() {
    return (
      this.itemType === ProjectItemType.zip ||
      this.itemType === ProjectItemType.MCWorld ||
      this.itemType === ProjectItemType.MCProject ||
      this.itemType === ProjectItemType.MCAddon ||
      this.itemType === ProjectItemType.MCPack ||
      this.itemType === ProjectItemType.MCTemplate
    );
  }

  public get isWorld() {
    return (
      this.itemType === ProjectItemType.MCProject ||
      this.itemType === ProjectItemType.MCWorld ||
      this.itemType === ProjectItemType.MCTemplate ||
      this.itemType === ProjectItemType.worldFolder
    );
  }

  static getGitHubSignature(info: IGitHubInfo) {
    let sig = info.owner + "|" + info.repoName + "|";

    if (info.branch !== undefined) {
      sig += info.branch;
    }

    if (info.folder !== undefined) {
      sig += "|" + info.folder;
    }

    return sig;
  }

  getPack() {
    if (this._pack) {
      return this._pack;
    }

    let thisPath = undefined;

    if (this._file) {
      thisPath = this._file.storageRelativePath;
    } else if (this._folder) {
      thisPath = this._folder.storageRelativePath;
    }

    if (thisPath === undefined) {
      return undefined;
    }

    this.project.ensurePacks();

    for (const pack of this.project.packs) {
      if (thisPath.startsWith(pack.folder.storageRelativePath)) {
        this._pack = pack;
        return this._pack;
      }
    }

    return undefined;
  }

  addUnfulfilledRelationship(path: string, itemType: ProjectItemType, isVanillaDependent?: boolean) {
    let pir: IProjectItemUnfulfilledRelationship = {
      parentItem: this,
      path: path,
      itemType: itemType,
      isVanillaDependent: isVanillaDependent === true,
    };

    if (this.unfulfilledRelationships === undefined) {
      this.unfulfilledRelationships = [];
    }

    this.unfulfilledRelationships.push(pir);
  }

  addChildItem(childItem: ProjectItem) {
    let pir: IProjectItemRelationship = {
      parentItem: this,
      childItem: childItem,
    };
    if (this.childItems === undefined) {
      this.childItems = [];
    }

    if (childItem.parentItems === undefined) {
      childItem.parentItems = [];
    }

    this.childItems.push(pir);
    childItem.parentItems.push(pir);
  }

  toString() {
    return this.itemType + ": " + this.projectPath;
  }

  getPackRelativePath() {
    const pack = this.getPack();

    if (!pack) {
      return undefined;
    }

    if (this._file) {
      return this._file.getFolderRelativePath(pack.folder);
    } else if (this._folder) {
      return this._folder.getFolderRelativePath(pack.folder);
    }

    return undefined;
  }

  static gitHubReferencesEqual(refA: IGitHubInfo | undefined, refB: IGitHubInfo | undefined) {
    if (refA === refB) {
      return true;
    }

    if (refA === undefined && refB === undefined) {
      return true;
    }

    if (
      refA !== undefined &&
      refB !== undefined &&
      refA.owner === refB.owner &&
      refA.repoName === refB.repoName &&
      refA.folder === refB.folder &&
      refA.branch === refB.branch
    ) {
      return true;
    }

    return false;
  }

  public set gitHubReference(value: IGitHubInfo | undefined) {
    if (ProjectItem.gitHubReferencesEqual(this._data.gitHubReference, value)) {
      return;
    }

    this._data.gitHubReference = value;

    this._project.notifyProjectItemChanged(this);
  }

  get title() {
    return (
      StorageUtilities.getContaineredFileLeafPath(this.projectPath) +
      " (" +
      ProjectItemUtilities.getDescriptionForType(this._data.itemType).toLowerCase() +
      ")"
    );
  }

  get typeTitle() {
    return ProjectItemUtilities.getDescriptionForType(this._data.itemType);
  }

  getFolderGroupingPath() {
    if (this.projectPath === undefined || this.projectPath === null) {
      return undefined;
    }

    let folderStoragePath = StorageUtilities.getFolderPath(this.projectPath);

    if (folderStoragePath === undefined) {
      return undefined;
    }

    let folderStoragePathLower = folderStoragePath.toLowerCase();

    const folderTypeRoots = ProjectItemUtilities.getFolderRootsForType(this.itemType);

    folderTypeRoots.push("zip");

    for (const folderTypeRoot of folderTypeRoots) {
      const start = folderStoragePathLower.indexOf("/" + folderTypeRoot + "/");

      if (start >= 0) {
        folderStoragePath = folderStoragePath.substring(start + 2 + folderTypeRoot.length);
        folderStoragePathLower = folderStoragePath.toLowerCase();
      }
    }

    folderStoragePath = folderStoragePath.replace(/#/gi, " ").trim();

    return folderStoragePath;
  }

  getSchemaPath() {
    switch (this._data.itemType) {
      case ProjectItemType.behaviorPackManifestJson:
        return "general/manifest.json";
      case ProjectItemType.behaviorPackListJson:
        return "general/world_x_packs.json";
      case ProjectItemType.resourcePackListJson:
        return "general/world_x_packs.json";
      case ProjectItemType.animationControllerBehaviorJson:
        return "behavior/animation_controllers/animation_controller.json";
      case ProjectItemType.animationBehaviorJson:
        return "behavior/animations/animations.json";
      case ProjectItemType.blockTypeBehavior:
        return "behavior/blocks/blocks.json";
      case ProjectItemType.itemTypeBehaviorJson:
        return "behavior/items/items.json";
      case ProjectItemType.lootTableBehavior:
        return "behavior/loot_tables/loot_tables.json";
      case ProjectItemType.biomeBehaviorJson:
        return "behavior/blocks/blocks.json";
      case ProjectItemType.dialogueBehaviorJson:
        return "behavior/dialogue/dialogue.json";
      case ProjectItemType.entityTypeBehavior:
        return "behavior/entities/entities.json";
      case ProjectItemType.blocksCatalogResourceJson:
        return "resource/blocks.json";
      case ProjectItemType.soundCatalog:
        return "resource/sounds.json";
      case ProjectItemType.animationResourceJson:
        return "resource/animations/actor_animation.json";
      case ProjectItemType.animationControllerResourceJson:
        return "resource/animation_controllers/animation_controller.json";
      case ProjectItemType.entityTypeResource:
        return "resource/entity/entity.json";
      case ProjectItemType.fogResourceJson:
        return "resource/fog/fog.json";
      case ProjectItemType.modelGeometryJson:
        return "resource/models/entity/model_entity.json";
      case ProjectItemType.biomeResourceJson:
        return "resource/biomes_client.json";
      case ProjectItemType.particleJson:
        return "resource/particles/particles.json";
      case ProjectItemType.renderControllerJson:
        return "resource/render_controllers/render_controllers.json";
      //     case ProjectItemType.uiTextureJson:
      //        return "resource/textures/ui_texture_definition.json";
      case ProjectItemType.languagesCatalogResourceJson:
        return "language/languages.json";
      case ProjectItemType.featureBehavior:
        return "behavior/features/features.json";
      case ProjectItemType.featureRuleBehaviorJson:
        return "behavior/feature_rules/feature_rules.json";
      case ProjectItemType.functionEventJson:
        return "behavior/functions/tick.json";
      case ProjectItemType.recipeBehaviorJson:
        return "behavior/recipes/recipes.json";
      case ProjectItemType.spawnRuleBehavior:
        return "behavior/spawn_rules/spawn_rules.json";
      case ProjectItemType.tradingBehaviorJson:
        return "behavior/trading/trading.json";
      case ProjectItemType.attachableResourceJson:
        return "resource/attachables/attachables.json";
      case ProjectItemType.itemTypeResourceJson:
        return "resource/items/items.json";
      case ProjectItemType.materialsResourceJson:
        return "resource/materials/materials.json";
      case ProjectItemType.musicDefinitionJson:
        return "resource/sounds/music_definitions.json";
      case ProjectItemType.soundDefinitionCatalog:
        return "resource/sounds/sound_definitions.json";
      case ProjectItemType.blockTypeResourceJson:
        return "resource/blocks.json";
      case ProjectItemType.uiJson:
        return "resource/ui/ui.json";
      case ProjectItemType.tickJson:
        return "behavior/functions/tick.json";
      case ProjectItemType.flipbookTexturesJson:
        return "resource/textures/flipbook_textures.json";
      case ProjectItemType.itemTextureJson:
        return "resource/textures/item_texture.json";
      case ProjectItemType.terrainTextureCatalogResourceJson:
        return "resource/textures/terrain_texture.json";
      case ProjectItemType.globalVariablesJson:
        return "resource/ui/_global_variables.json";

      default:
        return undefined;
    }
  }

  get errorStatus() {
    return this._data.errorStatus;
  }

  set errorStatus(newErrorStatus: ProjectItemErrorStatus | undefined) {
    this._data.errorStatus = newErrorStatus;
  }

  get source() {
    return this._data.source;
  }

  set source(newSource: string | undefined) {
    this._data.source = newSource;
  }

  get errorMessage() {
    return this._data.errorMessage;
  }

  set errorMessage(newErrorMessage: string | undefined) {
    this._data.errorMessage = newErrorMessage;
  }

  get projectPath() {
    if (this._data.projectPath === undefined && this._data.storagePath) {
      this._data.projectPath = this._data.storagePath;

      return this._data.storagePath;
    }

    return this._data.projectPath;
  }

  set projectPath(newBasePath: string | undefined | null) {
    this._data.projectPath = newBasePath;
  }

  get effectiveEditPreference() {
    const ep = this.editPreference;

    if (ep === ProjectItemEditPreference.projectDefault) {
      return this._project.editPreference;
    } else if (ep === ProjectItemEditPreference.forceRaw) {
      return ProjectEditPreference.raw;
    } else {
      return ProjectEditPreference.summarized;
    }
  }

  get editPreference() {
    if (this._data.editPreference === undefined) {
      return ProjectItemEditPreference.projectDefault;
    }

    return this._data.editPreference;
  }

  set editPreference(newEditPreference: ProjectItemEditPreference) {
    this._data.editPreference = newEditPreference;
  }

  get storageType() {
    if (this._data.storageType === undefined) {
      return ProjectItemStorageType.singleFile;
    }

    return this._data.storageType;
  }

  set storageType(newStorageType: ProjectItemStorageType) {
    this._data.storageType = newStorageType;
  }

  get creationType() {
    return this._data.creationType;
  }

  set creationType(newCreationType: ProjectItemCreationType | undefined) {
    this._data.creationType = newCreationType;
  }

  get itemType() {
    return this._data.itemType;
  }

  get file() {
    return this._file;
  }

  get folder() {
    return this._folder;
  }

  set itemType(newItemType) {
    this._data.itemType = newItemType;

    this._onPropertyChanged.dispatch(this, "itemType");

    this._project.notifyProjectItemChanged(this);
  }

  get isLoaded() {
    if (this.storageType === ProjectItemStorageType.folder) {
      if (!this.folder) {
        return false;
      }

      if (!this.folder.isLoaded) {
        return false;
      }

      if (this.itemType === ProjectItemType.worldFolder) {
        if (!this.folder.manager || !(this.folder.manager instanceof MCWorld)) {
          return false;
        }

        const world = this.folder.manager as MCWorld;

        return world.isLoaded;
      }

      return true;
    } else if (this.storageType === ProjectItemStorageType.singleFile) {
      if (!this.file) {
        return false;
      }

      if (!this.file.isContentLoaded) {
        return false;
      }

      if (this.isWorld) {
        if (!this.file.manager || !(this.file.manager instanceof MCWorld)) {
          return false;
        }

        const world = this.file.manager as MCWorld;

        return world.isLoaded;
      }

      return this._isFileContentProcessed;
    }

    Log.unexpectedContentState();

    return false;
  }

  get tags() {
    return this._data.tags;
  }

  setFile(file: IFile) {
    if (file !== this._file) {
      this._file = file;
      this._isFileContentProcessed = false;
    }
  }

  get needsSave() {
    if (
      this._file === null &&
      this.creationType === ProjectItemCreationType.generated &&
      this.storageType === ProjectItemStorageType.singleFile
    ) {
      return true;
    }

    if (this._file === null) {
      return false;
    }

    let val = this._file.needsSave;

    if (!val) {
      if (
        this.isFileContainerStorageItem &&
        this._file.fileContainerStorage &&
        this._file.fileContainerStorage instanceof ZipStorage
      ) {
        val = (this._file.fileContainerStorage as ZipStorage).isContentUpdated;
      }

      if (!val) {
        const jsFile = this.getJavaScriptLibTwin();

        if (jsFile !== undefined) {
          val = jsFile.needsSave;
        }
      }
    }

    return val;
  }

  updateProjectPath() {
    if (this._project && this._project.projectFolder) {
      if (this._file) {
        this.projectPath = this._file.getFolderRelativePath(this._project.projectFolder);
      } else if (this._folder) {
        this.projectPath = this._folder.getFolderRelativePath(this._project.projectFolder);
      }
    }
  }

  async rename(newFileBaseName: string) {
    await this.load();

    await this._project.ensureProjectFolder();

    if (this._project.projectFolder === undefined || this._project.projectFolder === null) {
      return;
    }

    if (this._file !== null) {
      await this._file.moveTo(this._file.parentFolder.storageRelativePath + newFileBaseName + "." + this._file.type);

      this._data.name = newFileBaseName + "." + this._file.type;

      this.projectPath = this._file.getFolderRelativePath(this._project.projectFolder);
      this.storageType = ProjectItemStorageType.singleFile;
    } else {
      this._data.name = newFileBaseName;
    }

    this._onPropertyChanged.dispatch(this, "name");

    this._project.notifyProjectItemChanged(this);
  }

  async deleteItem() {
    await this.load();

    ProjectItemRelations.deleteLinksFromParents(this);

    if (this._file !== null) {
      this._file.deleteThisFile();
    }

    this._project.removeItem(this);
  }

  get imageUrl() {
    if (this.itemType === ProjectItemType.worldFolder) {
      if (this.folder) {
        if (this.folder.manager instanceof MCWorld) {
          const world = this.folder.manager as MCWorld;

          if (world.isLoaded) {
            return "data:image/jpg;base64, " + world.imageBase64;
          }
        }
      }
    } else if (this.isWorld) {
      if (this.file) {
        if (this.file.manager instanceof MCWorld) {
          const world = this.file.manager as MCWorld;

          if (world.isLoaded) {
            return "data:image/jpg;base64, " + world.imageBase64;
          }
        }
      }
    } else if (ProjectItemUtilities.isImageType(this.itemType)) {
      if (this._imageUrlBase64Cache) {
        return this._imageUrlBase64Cache;
      }

      if (this._file && this._file.content && this._file.content instanceof Uint8Array) {
        this._imageUrlBase64Cache = "data:image/jpg;base64, " + Utilities.uint8ArrayToBase64(this._file.content);

        return this._imageUrlBase64Cache;
      }
    }

    return undefined;
  }

  get name() {
    if (this.itemType === ProjectItemType.worldFolder) {
      if (this.folder) {
        if (this.folder.manager instanceof MCWorld) {
          const world = this.folder.manager as MCWorld;

          if (world.isLoaded) {
            return world.name;
          }
        }
      }
    } else if (this.itemType === ProjectItemType.MCWorld || this.itemType === ProjectItemType.MCTemplate) {
      if (this.file) {
        if (this.file.manager instanceof MCWorld) {
          const world = this.file.manager as MCWorld;

          if (world.isLoaded) {
            return world.name;
          }
        }
      }
    }

    // for certain types of project items, the name of the file is critical
    if (
      this.projectPath &&
      (this.itemType === ProjectItemType.js ||
        this.itemType === ProjectItemType.ts ||
        this.itemType === ProjectItemType.testJs ||
        this.itemType === ProjectItemType.structure)
    ) {
      return StorageUtilities.getLeafName(this.projectPath);
    }

    if (this._data.name !== undefined) {
      return this._data.name;
    }

    if (this.projectPath) {
      return StorageUtilities.getLeafName(this.projectPath);
    }

    return "untitled";
  }

  async ensureFolderStorage() {
    if (this.storageType === ProjectItemStorageType.folder) {
      if (
        this._folder === null &&
        this.projectPath !== null &&
        this.projectPath !== undefined &&
        this.projectPath.startsWith("/") &&
        this._project.projectFolder !== null &&
        this._project.projectFolder !== undefined
      ) {
        const prefixPaths = this.projectPath.split("#");

        if (prefixPaths.length > 1) {
          let folderToLoadFrom: IFolder | undefined = this._project.projectFolder;

          for (let i = 0; i < prefixPaths.length - 1; i++) {
            if (folderToLoadFrom) {
              const zipFile: IFile = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[i]);

              await zipFile.loadContent();

              if (zipFile.content && zipFile.content instanceof Uint8Array) {
                if (!zipFile.fileContainerStorage) {
                  const zipStorage = new ZipStorage();

                  zipStorage.storagePath = zipFile.storageRelativePath + "#";

                  await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                  zipFile.fileContainerStorage = zipStorage;
                }

                folderToLoadFrom = zipFile.fileContainerStorage.rootFolder;
              } else {
                folderToLoadFrom = undefined;
              }
            }
          }

          if (folderToLoadFrom) {
            this._folder = await folderToLoadFrom.ensureFolderFromRelativePath(prefixPaths[prefixPaths.length - 1]);
          } else {
            // Log.debugAlert("Unable to parse a containerized file path of '" + this.storagePath + "'");
            return null;
          }
        } else {
          this._folder = await this._project.projectFolder.ensureFolderFromRelativePath(this.projectPath);
        }

        await this._folder.load();

        this._onFolderRetrieved.dispatch(this, this._folder);

        if (this.itemType === ProjectItemType.worldFolder) {
          const mcworld = await MCWorld.ensureMCWorldOnFolder(this._folder, this._project, this._handleMCWorldLoaded);

          if (mcworld) {
            this.errorMessage = mcworld.storageErrorMessage;

            if (mcworld.storageErrorStatus === StorageErrorStatus.unprocessable) {
              this.errorStatus = ProjectItemErrorStatus.unprocessable;
            } else {
              this.errorStatus = ProjectItemErrorStatus.none;
            }
          }
        } else {
          this._fireLoadedEvent();
        }
      }

      return this._folder;
    }

    return undefined;
  }

  _handleMCWorldLoaded(world: MCWorld, worldA: MCWorld) {
    this._fireLoadedEvent();
  }

  _fireLoadedEvent() {
    if (this._onLoaded && this.isLoaded) {
      this._onLoaded.dispatch(this, this);
    }
  }

  async getManager() {
    await this.load();

    if (this.storageType === ProjectItemStorageType.singleFile && this._file) {
      return this._file.manager;
    }

    if (this.storageType === ProjectItemStorageType.folder && this._folder) {
      return this._folder.manager;
    }

    return undefined;
  }

  async ensureStorage() {
    if (this.storageType === ProjectItemStorageType.folder) {
      await this.ensureFolderStorage();
    } else if (this.storageType === ProjectItemStorageType.singleFile) {
      await this.ensureFileStorage();
    }
  }

  async ensureFileStorage() {
    if (
      this.storageType === ProjectItemStorageType.singleFile &&
      this._file === null &&
      this.projectPath !== null &&
      this.projectPath !== undefined &&
      this.projectPath.startsWith("/") &&
      this._project.projectFolder !== null &&
      this._project.projectFolder !== undefined
    ) {
      const prefixPaths = this.projectPath.split("#");

      if (prefixPaths.length > 1) {
        let folderToLoadFrom: IFolder | undefined = this._project.projectFolder;

        for (let i = 0; i < prefixPaths.length - 1; i++) {
          if (folderToLoadFrom) {
            const zipFile: IFile = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[i]);

            await zipFile.loadContent();

            if (zipFile.content && zipFile.content instanceof Uint8Array) {
              if (!zipFile.fileContainerStorage) {
                const zipStorage = new ZipStorage();

                zipStorage.storagePath = zipFile.storageRelativePath + "#";

                await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                zipFile.fileContainerStorage = zipStorage;
              }

              folderToLoadFrom = zipFile.fileContainerStorage.rootFolder;
            } else {
              folderToLoadFrom = undefined;
            }
          }
        }

        if (folderToLoadFrom) {
          this._file = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[prefixPaths.length - 1]);
          this._isFileContentProcessed = false;
        } else {
          Log.debugAlert("Unable to parse a containerized file path of '" + this.projectPath + "'");
          return null;
        }
      } else {
        this._file = await this._project.projectFolder.ensureFileFromRelativePath(this.projectPath);
        this._isFileContentProcessed = false;
      }
    }

    if (!this._isFileContentProcessed && this._file) {
      if (this._data.creationType === ProjectItemCreationType.generated) {
        await ProjectAutogeneration.updateItemAutogeneration(this, true);
      } else {
        await this._file.loadContent();
      }

      await ProjectAutogeneration.updateItemAutogeneratedSideFiles(this);

      this._isFileContentProcessed = true;

      this._onFileRetrieved.dispatch(this, this._file);

      if (this.itemType === ProjectItemType.MCWorld || this.itemType === ProjectItemType.MCTemplate) {
        const mcworld = await MCWorld.ensureOnFile(this._file, this._project, this._handleMCWorldLoaded);

        if (mcworld) {
          this.errorMessage = mcworld.storageErrorMessage;

          if (mcworld.storageErrorStatus === StorageErrorStatus.unprocessable) {
            this.errorStatus = ProjectItemErrorStatus.unprocessable;
          } else {
            this.errorStatus = ProjectItemErrorStatus.none;
          }
        }
      } else if (this.itemType === ProjectItemType.entityTypeBehavior) {
        await EntityTypeDefinition.ensureOnFile(this._file);

        this._fireLoadedEvent();
      } else {
        this._fireLoadedEvent();
      }
    }
    return this._file;
  }

  async getJsonObject(): Promise<object | undefined> {
    let strContent = await this.getStringContent();

    if (!strContent) {
      return undefined;
    }

    let obj = undefined;

    try {
      strContent = Utilities.fixJsonContent(strContent);
      obj = JSON.parse(strContent);
    } catch (e) {
      Log.debug("Could not parse content '" + strContent + "': " + e, this.project.name);
    }

    return obj;
  }

  async getStringContent(): Promise<string | undefined> {
    await this.load();

    if (!this._file) {
      return undefined;
    }

    await this._file.loadContent();

    if (this._file.content instanceof Uint8Array || this._file.content === null) {
      return undefined;
    }

    return this._file.content;
  }

  async load() {
    if (this.isLoaded) {
      return true;
    }

    if (this._isLoading) {
      const pendingLoad = this._pendingLoadRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);

      return true;
    } else {
      this._isLoading = true;

      await this.ensureStorage();

      this._isLoading = false;

      const pendingLoad = this._pendingLoadRequests;
      this._pendingLoadRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }

      return true;
    }
  }

  async prepareToSave() {
    await this.load();

    await ProjectAutogeneration.updateItemAutogeneration(this);
    await ProjectAutogeneration.updateItemAutogeneratedSideFiles(this);

    if (
      !this.isInFileContainer &&
      this.isFileContainerStorageItem &&
      this.file &&
      this.file.fileContainerStorage &&
      this.file.fileContainerStorage instanceof ZipStorage
    ) {
      const zs = this.file.fileContainerStorage as ZipStorage;

      if (zs.isContentUpdated && (zs.errorStatus === undefined || zs.errorStatus === StorageErrorStatus.none)) {
        const op = await this._project.carto.notifyOperationStarted(
          "Zipping file '" + this.file.storageRelativePath + "'..."
        );
        const bytes = await zs.generateUint8ArrayAsync();
        await this._project.carto.notifyOperationEnded(
          op,
          "Done zipping file '" + this.file.storageRelativePath + "'."
        );

        this.file.setContent(bytes);
      }
    }
  }

  getJavaScriptLibTwin() {
    if (!this._file) {
      return undefined;
    }

    if (this.itemType === ProjectItemType.ts) {
      const libScriptsFolder = this.project.getLibScriptsFolder();

      if (!libScriptsFolder) {
        return undefined;
      }

      const jsTwinName = StorageUtilities.canonicalizeName(StorageUtilities.getBaseFromName(this._file.name) + ".js");

      return libScriptsFolder.ensureFile(jsTwinName);
    }

    return undefined;
  }

  getFunctionTwin() {
    if (!this._file) {
      return undefined;
    }

    if (this.itemType === ProjectItemType.actionSet) {
      const functionTwinName = StorageUtilities.canonicalizeName(
        StorageUtilities.getBaseFromName(this._file.name) + ".mcfunction"
      );

      let functionFolder = this._file.parentFolder;

      if (functionFolder.name === "scripts" && functionFolder.parentFolder) {
        functionFolder = functionFolder.parentFolder.ensureFolder("functions");
      }

      return functionFolder.files[functionTwinName];
    }

    return undefined;
  }

  async saveContent() {
    if (this._file) {
      await this._file.saveContent();

      // these next two are associated with action set
      const jsFile = this.getJavaScriptLibTwin();

      if (jsFile !== undefined && jsFile.needsSave) {
        await jsFile.saveContent();
      }

      const functionFile = this.getFunctionTwin();

      if (functionFile !== undefined && functionFile.needsSave) {
        await functionFile.saveContent();
      }
    }
  }

  hasTag(name: string) {
    return this.tags.includes(name);
  }

  ensureTag(name: string) {
    if (this.hasTag(name)) {
      return;
    }

    this.tags.push(name);
  }
}
