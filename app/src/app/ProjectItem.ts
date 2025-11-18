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
import IFile, { FileUpdateType } from "../storage/IFile";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IGitHubInfo from "./IGitHubInfo";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { ProjectEditPreference } from "./IProjectData";
import MCWorld from "../minecraft/MCWorld";
import ZipStorage from "../storage/ZipStorage";
import Utilities from "../core/Utilities";
import { IFileUpdateEvent, StorageErrorStatus } from "../storage/IStorage";
import ProjectItemUtilities from "./ProjectItemUtilities";
import Pack from "../minecraft/Pack";
import ProjectAutogeneration from "./ProjectAutogeneration";
import ProjectItemRelationship from "./IProjectItemRelationship";
import IProjectItemRelationship from "./IProjectItemRelationship";
import IProjectItemUnfulfilledRelationship from "./IProjectItemUnfulfilledRelationship";
import ProjectItemRelations from "./ProjectItemRelations";
import ProjectItemVariant from "./ProjectItemVariant";
import { ProjectItemVariantType } from "./IProjectItemVariant";
import Database from "../minecraft/Database";
import ProjectVariant from "./ProjectVariant";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export interface IProjectItemContentUpdateEvent {
  item: ProjectItem;
  fileUpdate: IFileUpdateEvent;
}

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
  private _imageUrlBase64Cache: string | undefined | null;
  private _pack: Pack | undefined;
  private _primaryFile?: IFile;

  private _accessoryFolder: IFolder | null;

  public parentItems: ProjectItemRelationship[] | undefined;
  public childItems: ProjectItemRelationship[] | undefined;
  public unfulfilledRelationships: IProjectItemUnfulfilledRelationship[] | undefined;

  private _variants: { [label: string]: ProjectItemVariant };

  constructor(parent: Project, incomingData?: IProjectItemData) {
    this._project = parent;
    this._defaultFile = null;
    this._defaultFolder = null;
    this._accessoryFolder = null;
    this._isFileContentProcessed = false;
    this._variants = {};
    this._handleMCWorldLoaded = this._handleMCWorldLoaded.bind(this);
    this.sortVariantsMostImportantFirst = this.sortVariantsMostImportantFirst.bind(this);
    this.sortVariantsMostImportantLast = this.sortVariantsMostImportantLast.bind(this);
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

  hasCustomVariants() {
    for (const key in this._data.variants) {
      if (key !== "") {
        return true;
      }
    }

    return false;
  }

  hasVersionSliceCustomVariants() {
    for (const key in this._data.variants) {
      const varType = this._data.variants[key].variantType;
      if (
        key !== "" &&
        (varType === ProjectItemVariantType.versionSlice || varType === ProjectItemVariantType.versionSliceAlt)
      ) {
        return true;
      }
    }

    return false;
  }

  private _shouldEnsureDefaultVariant() {
    return (this.defaultFile && (this.defaultFile.content || !this.hasCustomVariants())) || this.defaultFolder;
  }

  getVariant(variantName: string) {
    if (variantName === "" && this._shouldEnsureDefaultVariant()) {
      return this.ensureDefaultVariant();
    }

    return this._variants[variantName];
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
    if (this._shouldEnsureDefaultVariant()) {
      return this.ensureDefaultVariant();
    }

    return this._variants[""];
  }

  async ensureAccessoryFolder() {
    if (this._accessoryFolder) {
      return this._accessoryFolder;
    }

    const rootAccessoryFolder = await this.project.ensureProjectItemAccessoryFolder();

    const folderPath = ProjectItemUtilities.getAccessoryFolderPathFromFilePath(this);

    this._accessoryFolder = await rootAccessoryFolder.ensureFolderFromRelativePath(folderPath);

    return this._accessoryFolder;
  }

  ensureDefaultVariant() {
    return this.ensureVariant("");
  }

  getVariantList() {
    if (this.defaultFile || this.defaultFolder) {
      this.ensureDefaultVariant();
    }

    return this._getVariantList();
  }

  _getVariantList() {
    const vararr = [];

    for (const key in this._data.variants) {
      const variant = this.ensureVariant(key);
      vararr.push(variant);
    }

    return vararr;
  }

  getVariantListMostImportantLast() {
    const vararr = [];

    const varKeys = Object.keys(this._data.variants);
    varKeys.sort(this.sortVariantsMostImportantLast);

    for (const key of varKeys) {
      const variant = this.ensureVariant(key);
      vararr.push(variant);
    }

    return vararr;
  }

  getVariantListMostImportantFirst() {
    const vararr = [];

    const varKeys = Object.keys(this._data.variants);
    varKeys.sort(this.sortVariantsMostImportantFirst);

    for (const key of varKeys) {
      const variant = this.ensureVariant(key);
      vararr.push(variant);
    }

    return vararr;
  }

  hasNonDefaultVariant() {
    const vararr = this._getVariantList();

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
    label = ProjectVariant.canonicalizeVariantLabel(label);

    if (!Utilities.isUsableAsObjectKey(label)) {
      Log.unsupportedToken(label);
      throw new Error();
    }

    if (!this._variants[label]) {
      const pv = this.project.ensureVariant(label);

      if (!this._data.variants) {
        this._data.variants = {};
      }

      if (this._data.variants[label] === undefined) {
        this._data.variants[label] = { label: label, variantType: ProjectItemVariantType.general };
      }

      this._primaryFile = undefined;

      this._variants[label] = new ProjectItemVariant(this, this._data.variants[label], pv);
    }

    return this._variants[label];
  }

  /// NOTE: ProjectItem.ensureFileStorage or ensureStorage should be called before this method.
  getFile(variantName?: string) {
    if (variantName === undefined || variantName === "") {
      return this._defaultFile;
    }

    const variant = this.ensureVariant(variantName);

    return variant.file;
  }

  /// NOTE: ProjectItem.ensureFolderStorage or ensureStorage should be called before this method.
  getFolder(variantName?: string) {
    if (variantName === undefined || variantName === "") {
      return this._defaultFolder;
    }

    const variant = this.ensureVariant(variantName);

    return variant.folder;
  }

  /// NOTE: ProjectItem.ensure*Storage should be called before this method.
  async getPack() {
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

    thisPath = StorageUtilities.canonicalizePath(thisPath);

    await this.project.ensurePacks();

    for (const pack of this.project.packs) {
      if (thisPath.startsWith(StorageUtilities.canonicalizePath(pack.folder.storageRelativePath))) {
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

  async ensureDependencies() {
    await ProjectItemRelations.calculateForItem(this);
  }

  addChildItem(childItem: ProjectItem) {
    if (this.childItems) {
      for (const rel of this.childItems) {
        if (rel.childItem === childItem && rel.parentItem === this) {
          return;
        }
      }
    }

    if (childItem === this) {
      return;
    }

    if (ProjectItemUtilities.wouldBeCircular(childItem)) {
      return;
    }

    let hasChild = false;
    let childHasParent = false;

    if (this.childItems === undefined) {
      this.childItems = [];
    }

    if (childItem.parentItems === undefined) {
      childItem.parentItems = [];
    }

    for (const existingRelation of this.childItems) {
      if (existingRelation.childItem === childItem && existingRelation.parentItem === this) {
        hasChild = true;
      }
    }

    for (const existingRelation of childItem.parentItems) {
      if (existingRelation.childItem === childItem && existingRelation.parentItem === this) {
        childHasParent = true;
      }
    }

    const pir: IProjectItemRelationship = {
      parentItem: this,
      childItem: childItem,
    };

    if (!hasChild) {
      this.childItems.push(pir);
    }

    if (!childHasParent) {
      childItem.parentItems.push(pir);
    }
  }

  addParentItem(parentItem: ProjectItem) {
    if (ProjectItemUtilities.wouldBeCircular(parentItem)) {
      return;
    }

    if (parentItem === this) {
      return;
    }

    if (this.parentItems === undefined) {
      this.parentItems = [];
    }

    if (parentItem.childItems === undefined) {
      parentItem.childItems = [];
    }

    let hasParent = false;
    let parentHasChild = false;

    for (const existingRelation of this.parentItems) {
      if (existingRelation.parentItem === parentItem && existingRelation.childItem === this) {
        hasParent = true;
      }
    }

    for (const existingRelation of parentItem.childItems) {
      if (existingRelation.parentItem === parentItem && existingRelation.childItem === this) {
        parentHasChild = true;
      }
    }

    const pir: IProjectItemRelationship = {
      parentItem: parentItem,
      childItem: this,
    };

    if (!hasParent) {
      this.parentItems.push(pir);
    }

    if (!parentHasChild) {
      parentItem.childItems.push(pir);
    }
  }

  toString() {
    return this.itemType + ": " + this.projectPath;
  }

  /// NOTE: ProjectItem.ensure*Storage should be called before this method.
  async getPackRelativePath() {
    const pack = await this.getPack();

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

  getPackFolderName() {
    if (this.projectPath === undefined || this.projectPath === null) {
      return undefined;
    }
    let folderStoragePath = StorageUtilities.getFolderPath(this.projectPath);

    if (folderStoragePath === undefined) {
      return undefined;
    }

    let folderStoragePathLower = folderStoragePath.toLowerCase();

    if (this.project.packs.length > 2) {
      const endOfPacks = folderStoragePathLower.indexOf("_packs/");

      if (endOfPacks > 0) {
        const endOfPacksSegment = folderStoragePathLower.indexOf("/", endOfPacks + 7);

        if (endOfPacksSegment > 0) {
          return folderStoragePath.substring(endOfPacks + 7, endOfPacksSegment);
        }
      }
    }

    return undefined;
  }

  get folderPath() {
    if (this.projectPath === undefined || this.projectPath === null) {
      return undefined;
    }

    return StorageUtilities.getFolderPath(this.projectPath);
  }

  getFolderGroupingPath() {
    if (this.projectPath === undefined || this.projectPath === null) {
      return undefined;
    }

    let folderStoragePath = StorageUtilities.getFolderPath(this.projectPath);

    if (folderStoragePath === undefined) {
      return undefined;
    }

    folderStoragePath = MinecraftUtilities.clearCommonTerms(folderStoragePath);
    let folderStoragePathLower = folderStoragePath.toLowerCase();

    const folderTypeRoots = ProjectItemUtilities.getFolderRootsForType(this.itemType);

    folderTypeRoots.push("zip");

    for (const folderTypeRoot of folderTypeRoots) {
      if (this.project.hasMultiplePacksOfSameType) {
        folderStoragePath = Utilities.replaceAllCaseInsensitive(folderStoragePath, "/" + folderTypeRoot + "/", "/");
      } else {
        const start = folderStoragePathLower.indexOf("/" + folderTypeRoot + "/");

        if (start >= 0) {
          let packPrefix = this.getPackFolderName();

          if (packPrefix === undefined) {
            packPrefix = "";
          } else {
            packPrefix += " ";
          }

          folderStoragePath = packPrefix + folderStoragePath.substring(start + 2 + folderTypeRoot.length);
          folderStoragePathLower = folderStoragePath.toLowerCase();
        }
      }
    }

    folderStoragePath = folderStoragePath.replace(/#/gi, " ").trim();

    return folderStoragePath;
  }

  getSchemaPath() {
    return ProjectItemUtilities.getSchemaPathForType(this.itemType);
  }

  getFormPath() {
    return ProjectItemUtilities.getFormPathForType(this.itemType);
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
      return this._project.effectiveEditPreference;
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

  sortVariantsMostImportantLast(a: string, b: string) {
    if (!this._variants) {
      this._getVariantList();
    }

    if (!this._variants) {
      return Utilities.staticCompare(a, b);
    }

    const va = this._variants[a];
    const vb = this._variants[b];

    if (!va || !vb || !va.label || !vb.label) {
      return 0;
    }

    if (
      (va.variantType === ProjectItemVariantType.versionSlice &&
        vb.variantType === ProjectItemVariantType.versionSlice) ||
      (va.variantType === ProjectItemVariantType.versionSliceAlt &&
        vb.variantType === ProjectItemVariantType.versionSliceAlt)
    ) {
      const versionIndexA = Database.getVersionIndexFromVersionStr(va.label);
      const versionIndexB = Database.getVersionIndexFromVersionStr(vb.label);

      return versionIndexA - versionIndexB;
    }

    return Utilities.staticCompare(va.label.toString(), vb.label.toString());
  }

  sortVariantsMostImportantFirst(a: string, b: string) {
    if (!this._variants) {
      this._getVariantList();
    }

    if (!this._variants) {
      return Utilities.staticCompare(a, b);
    }

    const va = this._variants[a];
    const vb = this._variants[b];

    if (!va || !vb || !va.label || !vb.label) {
      return 0;
    }

    if (
      (va.variantType === ProjectItemVariantType.versionSlice &&
        vb.variantType === ProjectItemVariantType.versionSlice) ||
      (va.variantType === ProjectItemVariantType.versionSliceAlt &&
        vb.variantType === ProjectItemVariantType.versionSliceAlt)
    ) {
      const versionIndexA = Database.getVersionIndexFromVersionStr(va.label);
      const versionIndexB = Database.getVersionIndexFromVersionStr(vb.label);

      return versionIndexB - versionIndexA;
    }

    return vb.label.localeCompare(va.label);
  }

  get primaryVariantLabel(): string | undefined {
    const variantKeys = Object.keys(this._variants);

    // if we have version slices, return the latest one that has a file
    if (this.hasVersionSliceCustomVariants()) {
      variantKeys.sort(this.sortVariantsMostImportantFirst);

      for (const variantName of variantKeys) {
        const variant = this._variants[variantName];

        if (
          variant.variantType === ProjectItemVariantType.versionSlice ||
          variant.variantType === ProjectItemVariantType.versionSliceAlt
        ) {
          if (variant.file) {
            return variant.label;
          }
        }
      }
    }

    if (this._defaultFile) {
      return undefined;
    }

    for (const variantName of variantKeys) {
      if (variantName) {
        const variant = this._variants[variantName];

        if (variant.file) {
          return variant.label;
        }
      }
    }

    return undefined;
  }

  get primaryFile(): IFile | null {
    if (this._primaryFile) {
      return this._primaryFile;
    }

    // if we have version slices, return the latest one that has a file
    if (this.hasVersionSliceCustomVariants()) {
      const variantKeys = Object.keys(this._variants);

      variantKeys.sort(this.sortVariantsMostImportantFirst);

      for (const variantName of variantKeys) {
        const variant = this._variants[variantName];

        if (
          variant.variantType === ProjectItemVariantType.versionSlice ||
          variant.variantType === ProjectItemVariantType.versionSliceAlt
        ) {
          if (variant.file) {
            this._primaryFile = variant.file;
            return this._primaryFile;
          }
        }
      }
    }

    if (this._defaultFile && (!this._defaultFile.isContentLoaded || this._defaultFile.content)) {
      return this._defaultFile;
    }

    const variantKeys = Object.keys(this._variants);

    variantKeys.sort(this.sortVariantsMostImportantFirst);

    for (const variantName of variantKeys) {
      if (variantName) {
        const variant = this._variants[variantName];

        if (variant.file) {
          this._primaryFile = variant.file;
          return this._primaryFile;
        }
      }
    }

    // as a last fallback, return an assumedly content-less default file
    if (this._defaultFile) {
      this._primaryFile = this._defaultFile;
      return this._primaryFile;
    }

    return null;
  }

  get defaultFolder() {
    return this._defaultFolder;
  }

  set itemType(newItemType) {
    this._data.itemType = newItemType;

    this._onPropertyChanged.dispatch(this, "itemType");

    this._project.notifyProjectItemChanged(this);
  }

  get isContentLoaded() {
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
      const itemFile = this.primaryFile;

      if (!itemFile) {
        return false;
      }

      if (!itemFile.isContentLoaded) {
        return false;
      }

      if (this.isWorld) {
        if (!itemFile.manager || !(itemFile.manager instanceof MCWorld)) {
          return false;
        }

        const world = itemFile.manager as MCWorld;

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

  async setFile(file: IFile) {
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
    if (!this.isContentLoaded) {
      await this.loadContent();
    }

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
    if (!this.isContentLoaded) {
      await this.loadContent();
    }
    await ProjectItemRelations.deleteLinksFromParents(this);

    if (this._defaultFile !== null) {
      await this._defaultFile.deleteThisFile();
    }

    this._project.removeItem(this);
  }

  get imageUrl() {
    if (this._imageUrlBase64Cache === null) {
      return undefined;
    }

    if (this._imageUrlBase64Cache) {
      return this._imageUrlBase64Cache;
    }

    if (this.itemType === ProjectItemType.worldFolder) {
      if (this.defaultFolder) {
        if (this.defaultFolder.manager instanceof MCWorld) {
          const world = this.defaultFolder.manager as MCWorld;

          if (world.isLoaded) {
            this._imageUrlBase64Cache = "data:image/jpg;base64, " + world.imageBase64;

            return this._imageUrlBase64Cache;
          }
        }
      }
    } else if (this.isWorld) {
      const itemFile = this.primaryFile;

      if (itemFile) {
        if (itemFile.manager instanceof MCWorld) {
          const world = itemFile.manager as MCWorld;

          if (world.isLoaded) {
            return "data:image/jpg;base64, " + world.imageBase64;
          }
        }
      }
    } else if (this.projectPath && ProjectItemUtilities.isImageType(this.itemType)) {
      if (this.projectPath && this.projectPath.endsWith(".tga")) {
        this._imageUrlBase64Cache = null;
      } else if (this._defaultFile && this._defaultFile.content && this._defaultFile.content instanceof Uint8Array) {
        if (this._defaultFile.content.length > 10000) {
          this._imageUrlBase64Cache = null;
          return undefined;
        }

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
      const itemFile = this.primaryFile;

      if (itemFile) {
        if (itemFile.manager instanceof MCWorld) {
          const world = itemFile.manager as MCWorld;

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

  async loadFolder() {
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

              if (!zipFile.isContentLoaded) {
                await zipFile.loadContent();
              }

              if (zipFile.content && zipFile.content instanceof Uint8Array) {
                if (!zipFile.fileContainerStorage) {
                  const zipStorage = new ZipStorage();

                  zipStorage.storagePath = zipFile.storageRelativePath + "#";

                  await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                  zipStorage.containerFile = zipFile;
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
    if (this._onLoaded && this.isContentLoaded) {
      this._onLoaded.dispatch(this, this);
    }
  }

  invalidateContentProcessedState() {
    if (this._defaultFile) {
      this._defaultFile.manager = undefined;
    }

    for (const varLabel in this._variants) {
      const variant = this._variants[varLabel];

      if (variant.file) {
        variant.file.manager = undefined;
      }
    }

    this._isFileContentProcessed = false;
  }

  async getManager() {
    if (!this.isContentLoaded) {
      await this.loadContent();
    }

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
      await this.loadFolder();
    } else if (this.storageType === ProjectItemStorageType.singleFile) {
      await this.ensureFileStorage();
    }
  }

  get isStorageEnsured() {
    if (this.storageType === ProjectItemStorageType.folder) {
      return !!this._defaultFolder;
    }
    return !!this.primaryFile;
  }

  async loadContentDirect() {
    if (this.storageType === ProjectItemStorageType.folder) {
      await this.loadFolder();
    } else if (this.storageType === ProjectItemStorageType.singleFile) {
      await this.loadFileContent();
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

            if (!zipFile.isContentLoaded) {
              await zipFile.loadContent();
            }

            if (zipFile.content && zipFile.content instanceof Uint8Array) {
              if (!zipFile.fileContainerStorage) {
                const zipStorage = new ZipStorage();

                zipStorage.storagePath = zipFile.storageRelativePath + "#";

                await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                zipStorage.containerFile = zipFile;
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

    return this._defaultFile;
  }

  async loadFileContent() {
    if (this._isFileContentProcessed && this._defaultFile) {
      return this._defaultFile;
    }

    if (!this._defaultFile) {
      await this.ensureFileStorage();
    }

    const variants = this._getVariantList();

    for (const variant of variants) {
      await variant.ensureAndLoadFileStorage();
    }

    if (this._defaultFile) {
      await this.loadFileStorage();
    }

    return this._defaultFile;
  }

  async loadFileStorage() {
    if (!this._isFileContentProcessed && this._defaultFile) {
      if (this._data.creationType === ProjectItemCreationType.generated) {
        await ProjectAutogeneration.updateItemAutogeneration(this, true);
      } else {
        if (!this._defaultFile.isContentLoaded) {
          await this._defaultFile.loadContent();
        }
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
    if (!this.isContentLoaded) {
      await this.loadContent();
    }

    const pf = this.primaryFile;

    if (!pf) {
      return undefined;
    }

    if (!pf.isContentLoaded) {
      await pf.loadContent();
    }

    if (pf.content instanceof Uint8Array || pf.content === null) {
      return undefined;
    }

    return pf.content;
  }

  async getContentAsJson(): Promise<any | null> {
    const file = await this.loadFileContent();
    return file && (await StorageUtilities.getJsonObject(file));
  }

  async loadContent() {
    if (this.isContentLoaded) {
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

      await this.loadContentDirect();

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
    if (!this.isContentLoaded) {
      await this.loadContent();
    }

    await ProjectAutogeneration.updateItemAutogeneration(this);
    await ProjectAutogeneration.updateItemAutogeneratedSideFiles(this);

    if (
      !this.isInFileContainer &&
      this.isFileContainerStorageItem &&
      this.primaryFile &&
      this.primaryFile.fileContainerStorage &&
      this.primaryFile.fileContainerStorage instanceof ZipStorage
    ) {
      const zs = this.primaryFile.fileContainerStorage as ZipStorage;

      if (zs.isContentUpdated && (zs.errorStatus === undefined || zs.errorStatus === StorageErrorStatus.none)) {
        const op = await this._project.creatorTools.notifyOperationStarted(
          "Zipping file '" + this.primaryFile.storageRelativePath + "'..."
        );
        const bytes = await zs.generateUint8ArrayAsync();
        await this._project.creatorTools.notifyOperationEnded(
          op,
          "Done zipping file '" + this.primaryFile.storageRelativePath + "'."
        );

        this.primaryFile.setContent(bytes, FileUpdateType.versionlessEdit);
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
