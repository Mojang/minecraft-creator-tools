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
import ProjectItemVariant from "./ProjectItemVariant";
import { ProjectItemVariantType } from "./IProjectItemVariant";

export default class ProjectItem {
  private _data: IProjectItemData;
  private _project: Project;
  private _onPropertyChanged = new EventDispatcher<ProjectItem, string>();
  private _onFileRetrieved = new EventDispatcher<ProjectItem, IFile>();
  private _onFolderRetrieved = new EventDispatcher<ProjectItem, IFolder>();
  private _onLoaded = new EventDispatcher<ProjectItem, ProjectItem>();
  private _defaultFile: IFile | null;
  private _defaultFolder: IFolder | null;
  private _pendingLoadRequests: ((value: unknown) => void)[] = [];
  private _isLoading: boolean = false;
  private _isFileContentProcessed: boolean = false;
  private _imageUrlBase64Cache: string | undefined;
  private _pack: Pack | undefined;

  public parentItems: ProjectItemRelationship[] | undefined;
  public childItems: ProjectItemRelationship[] | undefined;
  public unfulfilledRelationships: IProjectItemUnfulfilledRelationship[] | undefined;

  public variants: { [label: string]: ProjectItemVariant };

  constructor(parent: Project, incomingData?: IProjectItemData) {
    this._project = parent;
    this._defaultFile = null;
    this._defaultFolder = null;
    this._isFileContentProcessed = false;
    this.variants = {};
    this._handleMCWorldLoaded = this._handleMCWorldLoaded.bind(this);

    if (incomingData) {
      this._data = incomingData;
    } else {
      this._data = {
        variants: {},
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

  get defaultVariant() {
    return this.ensureVariant("");
  }

  getVariantList() {
    const vararr = [];

    for (const key in this._data.variants) {
      const variant = this.ensureVariant(key);
      vararr.push(variant);
    }

    return vararr;
  }

  hasNonDefaultVariant() {
    const vararr = this.getVariantList();

    if (vararr.length === 0) {
      return false;
    }

    if (vararr.length > 1) {
      return true;
    }

    if (vararr[0].label !== "") {
      return true;
    }

    return false;
  }

  ensureVariant(label: string) {
    if (!this.variants[label]) {
      const pv = this.project.ensureVariant(label);

      if (!this._data.variants) {
        this._data.variants = {};
      }

      if (this._data.variants[label] === undefined) {
        this._data.variants[label] = { label: label, variantType: ProjectItemVariantType.general };
      }

      this.variants[label] = new ProjectItemVariant(this, this._data.variants[label], pv);
    }

    return this.variants[label];
  }

  getFile(variantName?: string) {
    if (variantName === undefined || variantName === "") {
      return this._defaultFile;
    }

    const variant = this.ensureVariant(variantName);

    return variant.file;
  }

  getFolder(variantName?: string) {
    if (variantName === undefined || variantName === "") {
      return this._defaultFolder;
    }

    const variant = this.ensureVariant(variantName);

    return variant.folder;
  }

  getPack() {
    if (this._pack) {
      return this._pack;
    }

    let thisPath = undefined;

    if (this._defaultFile) {
      thisPath = this._defaultFile.storageRelativePath;
    } else if (this._defaultFolder) {
      thisPath = this._defaultFolder.storageRelativePath;
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
    if (ProjectItemUtilities.wouldBeCircular(childItem)) {
      return;
    }

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

    if (this._defaultFile) {
      return this._defaultFile.getFolderRelativePath(pack.folder);
    } else if (this._defaultFolder) {
      return this._defaultFolder.getFolderRelativePath(pack.folder);
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
    return ProjectItemUtilities.getSchemaPathForType(this.itemType);
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

  get defaultFile() {
    return this._defaultFile;
  }

  get availableFile() {
    if (this._defaultFile) {
      return this._defaultFile;
    }

    for (const variantName in this.variants) {
      if (variantName) {
        const variant = this.variants[variantName];

        if (variant.file) {
          return variant.file;
        }
      }
    }

    return undefined;
  }

  get defaultFolder() {
    return this._defaultFolder;
  }

  set itemType(newItemType) {
    this._data.itemType = newItemType;

    this._onPropertyChanged.dispatch(this, "itemType");

    this._project.notifyProjectItemChanged(this);
  }

  get isLoaded() {
    if (this.storageType === ProjectItemStorageType.folder) {
      if (!this.defaultFolder) {
        return false;
      }

      if (!this.defaultFolder.isLoaded) {
        return false;
      }

      if (this.itemType === ProjectItemType.worldFolder) {
        if (!this.defaultFolder.manager || !(this.defaultFolder.manager instanceof MCWorld)) {
          return false;
        }

        const world = this.defaultFolder.manager as MCWorld;

        return world.isLoaded;
      }

      return true;
    } else if (this.storageType === ProjectItemStorageType.singleFile) {
      if (!this.defaultFile) {
        return false;
      }

      if (!this.defaultFile.isContentLoaded) {
        return false;
      }

      if (this.isWorld) {
        if (!this.defaultFile.manager || !(this.defaultFile.manager instanceof MCWorld)) {
          return false;
        }

        const world = this.defaultFile.manager as MCWorld;

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
    if (file !== this._defaultFile) {
      this._defaultFile = file;
      this._isFileContentProcessed = false;
    }
  }

  get needsSave() {
    if (
      this._defaultFile === null &&
      this.creationType === ProjectItemCreationType.generated &&
      this.storageType === ProjectItemStorageType.singleFile
    ) {
      return true;
    }

    if (this._defaultFile === null) {
      return false;
    }

    let val = this._defaultFile.needsSave;

    if (!val) {
      if (
        this.isFileContainerStorageItem &&
        this._defaultFile.fileContainerStorage &&
        this._defaultFile.fileContainerStorage instanceof ZipStorage
      ) {
        val = (this._defaultFile.fileContainerStorage as ZipStorage).isContentUpdated;
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
      if (this._defaultFile) {
        this.projectPath = this._defaultFile.getFolderRelativePath(this._project.projectFolder);
      } else if (this._defaultFolder) {
        this.projectPath = this._defaultFolder.getFolderRelativePath(this._project.projectFolder);
      }
    }
  }

  async rename(newFileBaseName: string) {
    await this.load();

    await this._project.ensureProjectFolder();

    if (this._project.projectFolder === undefined || this._project.projectFolder === null) {
      return;
    }

    if (this._defaultFile !== null) {
      await this._defaultFile.moveTo(
        this._defaultFile.parentFolder.storageRelativePath + newFileBaseName + "." + this._defaultFile.type
      );

      this._data.name = newFileBaseName + "." + this._defaultFile.type;

      this.projectPath = this._defaultFile.getFolderRelativePath(this._project.projectFolder);
      this.storageType = ProjectItemStorageType.singleFile;
    } else {
      this._data.name = newFileBaseName;
    }

    this._onPropertyChanged.dispatch(this, "name");

    this._project.notifyProjectItemChanged(this);
  }

  async deleteItem() {
    await this.load();

    await ProjectItemRelations.deleteLinksFromParents(this);

    if (this._defaultFile !== null) {
      await this._defaultFile.deleteThisFile();
    }

    this._project.removeItem(this);
  }

  get imageUrl() {
    if (this.itemType === ProjectItemType.worldFolder) {
      if (this.defaultFolder) {
        if (this.defaultFolder.manager instanceof MCWorld) {
          const world = this.defaultFolder.manager as MCWorld;

          if (world.isLoaded) {
            return "data:image/jpg;base64, " + world.imageBase64;
          }
        }
      }
    } else if (this.isWorld) {
      if (this.defaultFile) {
        if (this.defaultFile.manager instanceof MCWorld) {
          const world = this.defaultFile.manager as MCWorld;

          if (world.isLoaded) {
            return "data:image/jpg;base64, " + world.imageBase64;
          }
        }
      }
    } else if (ProjectItemUtilities.isImageType(this.itemType)) {
      if (this._imageUrlBase64Cache) {
        return this._imageUrlBase64Cache;
      }

      if (this._defaultFile && this._defaultFile.content && this._defaultFile.content instanceof Uint8Array) {
        this._imageUrlBase64Cache = "data:image/jpg;base64, " + Utilities.uint8ArrayToBase64(this._defaultFile.content);

        return this._imageUrlBase64Cache;
      }
    }

    return undefined;
  }

  get name() {
    if (this.itemType === ProjectItemType.worldFolder) {
      if (this.defaultFolder) {
        if (this.defaultFolder.manager instanceof MCWorld) {
          const world = this.defaultFolder.manager as MCWorld;

          if (world.isLoaded) {
            return world.name;
          }
        }
      }
    } else if (this.itemType === ProjectItemType.MCWorld || this.itemType === ProjectItemType.MCTemplate) {
      if (this.defaultFile) {
        if (this.defaultFile.manager instanceof MCWorld) {
          const world = this.defaultFile.manager as MCWorld;

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
        this._defaultFolder === null &&
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
            this._defaultFolder = await folderToLoadFrom.ensureFolderFromRelativePath(
              prefixPaths[prefixPaths.length - 1]
            );
          } else {
            // Log.debugAlert("Unable to parse a containerized file path of '" + this.storagePath + "'");
            return null;
          }
        } else {
          this._defaultFolder = await this._project.projectFolder.ensureFolderFromRelativePath(this.projectPath);
        }

        await this._defaultFolder.load();

        this._onFolderRetrieved.dispatch(this, this._defaultFolder);

        if (this.itemType === ProjectItemType.worldFolder) {
          const mcworld = await MCWorld.ensureMCWorldOnFolder(
            this._defaultFolder,
            this._project,
            this._handleMCWorldLoaded
          );

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

      return this._defaultFolder;
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

    if (this.storageType === ProjectItemStorageType.singleFile && this._defaultFile) {
      return this._defaultFile.manager;
    }

    if (this.storageType === ProjectItemStorageType.folder && this._defaultFolder) {
      return this._defaultFolder.manager;
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
      this._defaultFile === null &&
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
          this._defaultFile = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[prefixPaths.length - 1]);
          this._isFileContentProcessed = false;
        } else {
          Log.debugAlert("Unable to parse a containerized file path of '" + this.projectPath + "'");
          return null;
        }
      } else {
        this._defaultFile = await this._project.projectFolder.ensureFileFromRelativePath(this.projectPath);
        this._isFileContentProcessed = false;
      }
    }

    const variants = this.getVariantList();

    for (const variant of variants) {
      await variant.ensureFileStorage();
    }

    if (!this._isFileContentProcessed && this._defaultFile) {
      if (this._data.creationType === ProjectItemCreationType.generated) {
        await ProjectAutogeneration.updateItemAutogeneration(this, true);
      } else {
        await this._defaultFile.loadContent();
      }

      await ProjectAutogeneration.updateItemAutogeneratedSideFiles(this);

      this._isFileContentProcessed = true;

      this._onFileRetrieved.dispatch(this, this._defaultFile);

      if (this.itemType === ProjectItemType.MCWorld || this.itemType === ProjectItemType.MCTemplate) {
        const mcworld = await MCWorld.ensureOnFile(this._defaultFile, this._project, this._handleMCWorldLoaded);

        if (mcworld) {
          this.errorMessage = mcworld.storageErrorMessage;

          if (mcworld.storageErrorStatus === StorageErrorStatus.unprocessable) {
            this.errorStatus = ProjectItemErrorStatus.unprocessable;
          } else {
            this.errorStatus = ProjectItemErrorStatus.none;
          }
        }
      } else if (this.itemType === ProjectItemType.entityTypeBehavior) {
        await EntityTypeDefinition.ensureOnFile(this._defaultFile);

        this._fireLoadedEvent();
      } else {
        this._fireLoadedEvent();
      }
    }

    return this._defaultFile;
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

    if (!this._defaultFile) {
      return undefined;
    }

    await this._defaultFile.loadContent();

    if (this._defaultFile.content instanceof Uint8Array || this._defaultFile.content === null) {
      return undefined;
    }

    return this._defaultFile.content;
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
      this.defaultFile &&
      this.defaultFile.fileContainerStorage &&
      this.defaultFile.fileContainerStorage instanceof ZipStorage
    ) {
      const zs = this.defaultFile.fileContainerStorage as ZipStorage;

      if (zs.isContentUpdated && (zs.errorStatus === undefined || zs.errorStatus === StorageErrorStatus.none)) {
        const op = await this._project.carto.notifyOperationStarted(
          "Zipping file '" + this.defaultFile.storageRelativePath + "'..."
        );
        const bytes = await zs.generateUint8ArrayAsync();
        await this._project.carto.notifyOperationEnded(
          op,
          "Done zipping file '" + this.defaultFile.storageRelativePath + "'."
        );

        this.defaultFile.setContent(bytes);
      }
    }
  }

  getJavaScriptLibTwin() {
    if (!this._defaultFile) {
      return undefined;
    }

    if (this.itemType === ProjectItemType.ts) {
      const libScriptsFolder = this.project.getLibScriptsFolder();

      if (!libScriptsFolder) {
        return undefined;
      }

      const jsTwinName = StorageUtilities.canonicalizeName(
        StorageUtilities.getBaseFromName(this._defaultFile.name) + ".js"
      );

      return libScriptsFolder.ensureFile(jsTwinName);
    }

    return undefined;
  }

  getFunctionTwin() {
    if (!this._defaultFile) {
      return undefined;
    }

    if (this.itemType === ProjectItemType.actionSet) {
      const functionTwinName = StorageUtilities.canonicalizeName(
        StorageUtilities.getBaseFromName(this._defaultFile.name) + ".mcfunction"
      );

      let functionFolder = this._defaultFile.parentFolder;

      if (functionFolder.name === "scripts" && functionFolder.parentFolder) {
        functionFolder = functionFolder.parentFolder.ensureFolder("functions");
      }

      return functionFolder.files[functionTwinName];
    }

    return undefined;
  }

  async saveContent() {
    if (this._defaultFile) {
      await this._defaultFile.saveContent();

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
