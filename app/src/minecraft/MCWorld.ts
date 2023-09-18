import IFile from "../storage/IFile";
import ZipStorage from "../storage/ZipStorage";
import { EventDispatcher, IEventHandler } from "ste-events";
import IPackRegistration from "./IPackRegistration";
import Log from "./../core/Log";
import IFolder from "./../storage/IFolder";
import IPackHistory from "./IPackHistory";
import WorldLevelDat from "./WorldLevelDat";
import IGetSetPropertyObject from "../dataform/IGetSetPropertyObject";
import Utilities from "../core/Utilities";
import IWorldManifest from "./IWorldManifest";
import StorageUtilities from "../storage/StorageUtilities";
import LevelDb from "./LevelDb";
import DataUtilities from "../core/DataUtilities";
import WorldChunk from "./WorldChunk";
import BlockLocation from "./BlockLocation";
import BlockCube from "./BlockCube";
import IDimension from "./IDimension";
import Block from "./Block";
import Entity from "./Entity";
import { IPackReference, IWorldSettings } from "./IWorldSettings";
import { StorageErrorStatus } from "../storage/IStorage";
import MinecraftUtilities from "./MinecraftUtilities";
import NbtBinary from "./NbtBinary";
import { NbtTagType } from "./NbtBinaryTag";
import AnchorSet from "./AnchorSet";
import Project from "../app/Project";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import ActorItem from "./ActorItem";

const BEHAVIOR_PACKS_RELPATH = "/world_behavior_packs.json";
const BEHAVIOR_PACK_HISTORY_RELPATH = "/world_behavior_pack_history.json";
const RESOURCE_PACKS_RELPATH = "/world_resource_packs.json";
const RESOURCE_PACK_HISTORY_RELPATH = "/world_resource_pack_history.json";
const LEVELDAT_RELPATH = "/level.dat";
const LEVELDATOLD_RELPATH = "/level.dat_old";
const LEVELNAMETXT_RELPATH = "/levelname.txt";
const MANIFEST_RELPATH = "/manifest.json";

const CHUNK_X_SIZE = 16;
const CHUNK_Z_SIZE = 16;
const SUBCHUNK_Y_SIZE = 16;

const CREATOR_TOOLS_EDITOR_BPUUID = "5d2f0b91-ca29-49da-a275-e6c6262ea3de";

export default class MCWorld implements IGetSetPropertyObject, IDimension {
  // Where possible, if _file is defined we'd prefer to use
  // _file.fileContentStorage for zip manip. _zipStorage is only used from
  // a pure "zip bytes in memory" scenario (for generating downloads.)
  private _zipStorage?: ZipStorage;

  private _file?: IFile;
  private _folder?: IFolder;
  private _bytes?: Uint8Array;
  private _project?: Project;

  private _autogenJsFile?: IFile;

  private _anchors = new AnchorSet();

  private _dynamicProperties: { [behaviorPackUid: string]: { [propertyName: string]: string | number | boolean } } = {};
  private _levelNameText?: string;

  private _manifest?: IWorldManifest;

  private _isLoaded = false;
  private _isDataLoaded = false;
  private _onLoaded = new EventDispatcher<MCWorld, MCWorld>();
  private _onDataLoaded = new EventDispatcher<MCWorld, MCWorld>();

  private _hasDynamicProps = false;
  private _hasCustomProps = false;

  private _onPropertyChanged = new EventDispatcher<MCWorld, string>();

  worldBehaviorPacks?: IPackRegistration[];
  worldResourcePacks?: IPackRegistration[];
  worldBehaviorPackHistory?: IPackHistory;
  worldResourcePackHistory?: IPackHistory;
  chunkCount = 0;

  private _absoluteY = -64;
  imageBase64?: string;

  levelDb?: LevelDb;

  actorsById: { [identifier: string]: ActorItem } = {};

  levelData?: WorldLevelDat;

  private _minX: number | undefined;
  private _maxX: number | undefined;
  private _minZ: number | undefined;
  private _maxZ: number | undefined;

  chunks: { [x: number]: { [z: number]: WorldChunk } } = {};

  public get project() {
    return this._project;
  }

  public set project(newProject: Project | undefined) {
    this._project = newProject;
  }

  public get anchors() {
    return this._anchors;
  }

  public get absoluteY() {
    return this._absoluteY;
  }

  public set absoluteY(newY: number) {
    this._absoluteY = newY;
  }

  public get effectiveRootFolder() {
    if (this._folder) {
      return this._folder;
    }

    if (this._file && this._file.fileContainerStorage) {
      return this._file.fileContainerStorage.rootFolder;
    }

    if (this._zipStorage !== undefined) {
      return this._zipStorage.rootFolder;
    }

    return undefined;
  }

  public get manifest() {
    return this._manifest;
  }

  public get hasDynamicProps() {
    return this._hasDynamicProps;
  }

  public get hasCustomProps() {
    return this._hasCustomProps;
  }

  public get minX() {
    return this._minX;
  }

  public get maxX() {
    return this._maxX;
  }

  public get minZ() {
    return this._minZ;
  }

  public get maxZ() {
    return this._maxZ;
  }

  public get storage() {
    if (this._file) {
      if (!this._file.fileContainerStorage) {
        this._file.fileContainerStorage = new ZipStorage();
        this._file.fileContainerStorage.storagePath = this._file.extendedPath + "#";
      }

      return this._file.fileContainerStorage;
    }

    if (this._zipStorage === undefined) {
      this._zipStorage = new ZipStorage();
    }

    return this._zipStorage;
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get storageErrorStatus() {
    if (!this.storage) {
      return StorageErrorStatus.none;
    }

    return this.storage.errorStatus;
  }

  get storageErrorMessage() {
    return this.storage.errorMessage;
  }

  get storageFullPath() {
    if (this._file) {
      return this._file.fullPath;
    }

    if (this._folder) {
      return this._folder.fullPath;
    }

    return undefined;
  }

  get betaApisExperiment() {
    if (this.levelData !== undefined) {
      const val = this.levelData.betaApisExperiment;

      if (val === undefined) {
        return false;
      }

      return val;
    }

    return false;
  }

  set betaApisExperiment(newVal: boolean) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    if (this.levelData !== undefined) {
      this.levelData.betaApisExperiment = newVal;
    }
  }

  get name() {
    if (this._levelNameText !== undefined) {
      return this._levelNameText;
    }

    if (this.levelData !== undefined && this.levelData.levelName !== undefined) {
      return this.levelData.levelName;
    }

    if (this._file !== undefined) {
      return this._file.name;
    }

    return "";
  }

  set name(newValue: string) {
    this._levelNameText = newValue;

    if (this.levelData !== undefined) {
      this.levelData.levelName = newValue;
    }
  }

  get file() {
    return this._file;
  }

  set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  get folder() {
    return this._folder;
  }

  set folder(newFolder: IFolder | undefined) {
    this._folder = newFolder;
  }

  get isLoaded() {
    return this._isLoaded;
  }

  get spawnX(): number | undefined {
    if (this.levelData === undefined) {
      return undefined;
    }

    return this.levelData.spawnX;
  }

  set spawnX(newX: number | undefined) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    this.levelData.spawnX = newX;

    this._onPropertyChanged.dispatch(this, "spawnX");
  }

  get spawnY() {
    if (this.levelData === undefined) {
      return undefined;
    }

    return this.levelData.spawnY;
  }

  set spawnY(newY: number | undefined) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    this.levelData.spawnY = newY;

    this._onPropertyChanged.dispatch(this, "spawnY");
  }

  get spawnZ() {
    if (this.levelData === undefined) {
      return undefined;
    }

    return this.levelData.spawnZ;
  }

  set spawnZ(newZ: number | undefined) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    this.levelData.spawnZ = newZ;

    this._onPropertyChanged.dispatch(this, "spawnZ");
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get onDataLoaded() {
    return this._onDataLoaded.asEvent();
  }

  static async ensureMCWorldOnFolder(folder: IFolder, project?: Project, handler?: IEventHandler<MCWorld, MCWorld>) {
    if (folder.manager === undefined) {
      const world = new MCWorld();
      world.project = project;

      world.folder = folder;

      folder.manager = world;
    }

    if (folder.manager !== undefined && folder.manager instanceof MCWorld) {
      const mcworld = folder.manager as MCWorld;

      if (!mcworld.isLoaded) {
        if (handler) {
          mcworld.onLoaded.subscribe(handler);
        }
        await mcworld.load(false);
      } else if (handler) {
        handler(mcworld, mcworld, { unsub: () => {}, stopPropagation: () => {} });
      }

      return mcworld;
    }

    return undefined;
  }

  static async ensureMCWorldOnFile(file: IFile, project?: Project, handler?: IEventHandler<MCWorld, MCWorld>) {
    if (file.manager === undefined) {
      const world = new MCWorld();
      world.project = project;
      world.file = file;

      file.manager = world;
    }

    if (file.manager !== undefined && file.manager instanceof MCWorld) {
      const mcworld = file.manager as MCWorld;

      if (!mcworld.isLoaded) {
        if (handler) {
          mcworld.onLoaded.subscribe(handler);
        }
        await mcworld.load(false);
      } else if (handler) {
        handler(mcworld, mcworld, { unsub: () => {}, stopPropagation: () => {} });
      }

      return mcworld;
    }

    return undefined;
  }

  loadAnchorsFromDynamicProperties() {
    if (this._dynamicProperties && this._dynamicProperties[CREATOR_TOOLS_EDITOR_BPUUID]) {
      this._anchors.clearAll();

      const anchorStr = this._dynamicProperties && this._dynamicProperties[CREATOR_TOOLS_EDITOR_BPUUID]["anchors"];

      if (anchorStr && typeof anchorStr === "string") {
        this._anchors.fromString(anchorStr);
        this.saveAutoGenItems();
      }
    }
  }

  async save() {
    if (this.storageErrorStatus === StorageErrorStatus.unprocessable) {
      return;
    }

    await this.saveWorldManifest();
    await this.saveLevelnameTxt();
    await this.saveLevelDat();
    await this.saveAutoGenItems();
    await this.saveWorldBehaviorPacks();
    await this.saveWorldBehaviorPackHistory();
  }

  private async saveWorldManifest() {
    if (this._manifest !== undefined && this.effectiveRootFolder !== undefined) {
      this._manifest.header.name = this.name;

      const manifestJsonFile = await this.effectiveRootFolder.ensureFileFromRelativePath(MANIFEST_RELPATH);

      if (manifestJsonFile !== undefined) {
        manifestJsonFile.setContent(JSON.stringify(this._manifest, null, 2));

        await manifestJsonFile.saveContent();
      }
    }
  }

  private async saveLevelnameTxt() {
    const name = this.name;

    if (name !== undefined && this.effectiveRootFolder !== undefined) {
      const rootDataFile = await this.effectiveRootFolder.ensureFileFromRelativePath(LEVELNAMETXT_RELPATH);

      if (rootDataFile !== undefined) {
        rootDataFile.setContent(name);
        await rootDataFile.saveContent();
      }
    }
  }

  private async saveLevelDat() {
    if (this.levelData !== undefined && this.effectiveRootFolder !== undefined) {
      this.levelData.persist();

      let rootDataFile = await this.effectiveRootFolder.ensureFileFromRelativePath(LEVELDAT_RELPATH);
      const bytes = this.levelData.getBytes();

      if (rootDataFile !== undefined && bytes !== undefined) {
        rootDataFile.setContent(bytes);
        await rootDataFile.saveContent();
      }

      rootDataFile = await this.effectiveRootFolder.ensureFileFromRelativePath(LEVELDATOLD_RELPATH);

      if (rootDataFile !== undefined && bytes !== undefined) {
        rootDataFile.setContent(bytes);
        await rootDataFile.saveContent();
      }
    }
  }

  async getBytes() {
    if (this._file) {
      if (!this._file.fileContainerStorage) {
        this._file.fileContainerStorage = new ZipStorage();
        this._file.fileContainerStorage.storagePath = this._file.extendedPath + "#";
      }

      await this.save();

      return await (this._file.fileContainerStorage as ZipStorage).generateUint8ArrayAsync();
    }

    if (this._zipStorage === undefined) {
      return undefined;
    }

    await this.save();

    return await this._zipStorage.generateUint8ArrayAsync();
  }

  async syncFolderTo(folder: IFolder) {
    await this.save();

    const sourceFolder = this.effectiveRootFolder;

    if (!sourceFolder) {
      Log.unexpectedUndefined("SFT");
      return;
    }

    await StorageUtilities.syncFolderTo(sourceFolder, folder, true, true, true);
  }

  async saveToFile() {
    if (this._zipStorage === undefined || this._file === undefined) {
      return;
    }

    const bytes = await this.getBytes();

    if (bytes !== undefined) {
      this._file.setContent(bytes);
    }
  }

  ensurePackReference(packRef: IPackReference) {
    if (this.worldBehaviorPacks === undefined) {
      this.worldBehaviorPacks = [];
    }

    if (this.worldResourcePacks === undefined) {
      this.worldResourcePacks = [];
    }

    if (this.worldBehaviorPackHistory === undefined) {
      this.worldBehaviorPackHistory = {
        packs: [],
      };
    }

    if (this.worldResourcePackHistory === undefined) {
      this.worldResourcePacks = [];
    }

    if (this.worldResourcePackHistory === undefined) {
      this.worldResourcePackHistory = {
        packs: [],
      };
    }

    if (packRef.behaviorPackReferences) {
      for (let i = 0; i < packRef.behaviorPackReferences.length; i++) {
        this.ensurePackReferenceInCollection(packRef.behaviorPackReferences[i], this.worldBehaviorPacks);
        this.ensurePackReferenceInHistory(
          packRef.behaviorPackReferences[i],
          this.worldBehaviorPackHistory,
          packRef.name
        );
      }
    }

    if (packRef.resourcePackReferences) {
      for (let i = 0; i < packRef.resourcePackReferences.length; i++) {
        this.ensurePackReferenceInCollection(packRef.resourcePackReferences[i], this.worldResourcePacks);
        this.ensurePackReferenceInHistory(
          packRef.resourcePackReferences[i],
          this.worldResourcePackHistory,
          packRef.name
        );
      }
    }
  }

  ensurePackReferenceInCollection(packRef: { uuid: string; version: number[] }, packRefs: IPackRegistration[]) {
    Log.assert(packRef.version.length === 3);

    const compareUuid = Utilities.canonicalizeId(packRef.uuid);

    for (let i = 0; i < packRefs.length; i++) {
      if (Utilities.canonicalizeId(packRefs[i].pack_id) === compareUuid) {
        return;
      }
    }

    packRefs.push({ pack_id: packRef.uuid, version: packRef.version });
  }

  ensurePackReferenceInHistory(packRef: { uuid: string; version: number[] }, packHistory: IPackHistory, name: string) {
    Log.assert(packRef.version.length === 3);
    if (packHistory.packs === undefined) {
      packHistory.packs = [];
    }

    const compareUuid = Utilities.canonicalizeId(packRef.uuid);

    for (let i = 0; i < packHistory.packs.length; i++) {
      if (Utilities.canonicalizeId(packHistory.packs[i].uuid) === compareUuid) {
        return;
      }
    }

    packHistory.packs.push({ can_be_redownloaded: false, name: name, uuid: packRef.uuid, version: packRef.version });
  }

  private _loadFromNbt() {}

  public getProperty(id: string): any {
    switch (id.toLowerCase()) {
      case "spawnx":
        return this.spawnX;

      case "spawny":
        return this.spawnY;

      case "spawnz":
        return this.spawnZ;

      case "gametype":
        return this.levelData?.gameType;

      case "difficulty":
        return this.levelData?.difficulty;

      case "generator":
        return this.levelData?.generator;
    }
  }

  public setProperty(id: string, newVal: any): any {
    switch (id.toLowerCase()) {
      case "spawnX":
        this.spawnX = newVal as number;
        break;

      case "spawnY":
        this.spawnY = newVal as number;
        break;

      case "spawnZ":
        this.spawnZ = newVal as number;
        break;
    }
  }

  async load(force: boolean) {
    if ((this._isLoaded && !force) || (this._file === undefined && this._folder === undefined)) {
      return;
    }

    if (this._file) {
      await this._file.loadContent();

      if (this._file.content === undefined || !(this._file.content instanceof Uint8Array)) {
        return;
      }
      await this.loadFromBytes(this._file.content);
    }

    if (this._folder) {
      await this.loadFromFolder(this._folder);
    }
  }

  public ensureResourcePacksFromString(packStr: string) {
    const refs = MinecraftUtilities.getIdsAndVersions(packStr);

    for (const ref of refs) {
      this.ensureResourcePack(ref.uuid, ref.version, ref.uuid);
    }
  }

  public ensureBehaviorPacksFromString(packStr: string) {
    const refs = MinecraftUtilities.getIdsAndVersions(packStr);

    for (const ref of refs) {
      this.ensureBehaviorPack(ref.uuid, ref.version, ref.uuid);
    }
  }

  public ensureBehaviorPack(packId: string, version: number[], packName: string) {
    if (this.worldBehaviorPacks === undefined) {
      this.worldBehaviorPacks = [];
    }

    if (this.worldBehaviorPackHistory === undefined) {
      this.worldBehaviorPackHistory = {
        packs: [],
      };
    }

    let wasAdded = false;

    const bp = this.getBehaviorPack(packId);

    if (bp === undefined) {
      this.worldBehaviorPacks.push({
        pack_id: packId,
        version: version,
      });
      wasAdded = true;
    }

    const bph = this.getBehaviorPackHistory(packId);

    if (bph === undefined) {
      this.worldBehaviorPackHistory.packs.push({
        uuid: packId,
        version: version,
        name: packName,
        can_be_redownloaded: false,
      });
      wasAdded = true;
    }
    return wasAdded;
  }

  public getBehaviorPack(packId: string) {
    if (this.worldBehaviorPacks === undefined) {
      return undefined;
    }

    packId = Utilities.canonicalizeId(packId);

    for (let i = 0; i < this.worldBehaviorPacks.length; i++) {
      const worldBP = this.worldBehaviorPacks[i];

      if (Utilities.canonicalizeId(worldBP.pack_id) === packId) {
        return worldBP;
      }
    }

    return undefined;
  }

  public getBehaviorPackHistory(packId: string) {
    if (this.worldBehaviorPackHistory === undefined) {
      return undefined;
    }

    packId = Utilities.canonicalizeId(packId);

    const packs = this.worldBehaviorPackHistory.packs;

    for (let i = 0; i < packs.length; i++) {
      const worldBPH = packs[i];

      if (Utilities.canonicalizeId(worldBPH.uuid) === packId) {
        return worldBPH;
      }
    }

    return undefined;
  }

  async saveWorldBehaviorPacks() {
    if (this.effectiveRootFolder === undefined) {
      return;
    }

    const rootFolder = this.effectiveRootFolder;

    if (this.worldBehaviorPacks === undefined || this.worldBehaviorPacks.length === 0) {
      await rootFolder.deleteFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);
      return;
    }

    const packsFile = await rootFolder.ensureFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);

    packsFile.setContent(JSON.stringify(this.worldBehaviorPacks, null, 2));

    packsFile.saveContent();
  }

  async saveWorldBehaviorPackHistory() {
    if (this.effectiveRootFolder === undefined) {
      return;
    }

    const rootFolder = this.effectiveRootFolder;

    if (this.worldBehaviorPackHistory === undefined || this.worldBehaviorPackHistory.packs.length === 0) {
      await rootFolder.deleteFileFromRelativePath(BEHAVIOR_PACK_HISTORY_RELPATH);
      return;
    }

    const packsFile = await rootFolder.ensureFileFromRelativePath(BEHAVIOR_PACK_HISTORY_RELPATH);

    packsFile.setContent(JSON.stringify(this.worldBehaviorPackHistory, null, 2));

    packsFile.saveContent();
  }

  public ensureResourcePack(packId: string, version: number[], packName: string) {
    if (this.worldResourcePacks === undefined) {
      this.worldResourcePacks = [];
    }

    if (this.worldResourcePackHistory === undefined) {
      this.worldResourcePackHistory = {
        packs: [],
      };
    }

    let wasAdded = false;

    const rp = this.getResourcePack(packId);

    if (rp === undefined) {
      this.worldResourcePacks.push({
        pack_id: packId,
        version: version,
      });
      wasAdded = true;
    }

    const rph = this.getResourcePackHistory(packId);

    if (rph === undefined) {
      this.worldResourcePackHistory.packs.push({
        uuid: packId,
        version: version,
        name: packName,
        can_be_redownloaded: false,
      });
      wasAdded = true;
    }

    return wasAdded;
  }

  public getResourcePack(packId: string) {
    if (this.worldResourcePacks === undefined) {
      return undefined;
    }

    packId = Utilities.canonicalizeId(packId);

    for (let i = 0; i < this.worldResourcePacks.length; i++) {
      const worldRP = this.worldResourcePacks[i];

      if (Utilities.canonicalizeId(worldRP.pack_id) === packId) {
        return worldRP;
      }
    }

    return undefined;
  }

  public getResourcePackHistory(packId: string) {
    if (this.worldResourcePackHistory === undefined) {
      return undefined;
    }

    packId = Utilities.canonicalizeId(packId);

    const packs = this.worldResourcePackHistory.packs;

    for (let i = 0; i < packs.length; i++) {
      const worldBPH = packs[i];

      if (Utilities.canonicalizeId(worldBPH.uuid) === packId) {
        return worldBPH;
      }
    }

    return undefined;
  }

  async saveWorldResourcePacks() {
    if (this.effectiveRootFolder === undefined) {
      return;
    }

    const rootFolder = this.effectiveRootFolder;

    if (this.worldResourcePacks === undefined || this.worldResourcePacks.length === 0) {
      await rootFolder.deleteFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);
      return;
    }

    const packsFile = await rootFolder.ensureFileFromRelativePath(RESOURCE_PACKS_RELPATH);

    packsFile.setContent(JSON.stringify(this.worldResourcePacks, null, 2));

    packsFile.saveContent();
  }

  async saveWorldResourcePackHistory() {
    if (this.effectiveRootFolder === undefined) {
      return;
    }

    const rootFolder = this.effectiveRootFolder;

    if (this.worldResourcePackHistory === undefined || this.worldResourcePackHistory.packs.length === 0) {
      await rootFolder.deleteFileFromRelativePath(RESOURCE_PACK_HISTORY_RELPATH);
      return;
    }

    const packsFile = await rootFolder.ensureFileFromRelativePath(RESOURCE_PACK_HISTORY_RELPATH);

    packsFile.setContent(JSON.stringify(this.worldResourcePackHistory, null, 2));

    packsFile.saveContent();
  }

  async loadFromBytes(content: Uint8Array) {
    let storage = undefined;

    if (this._file) {
      if (!this._file.fileContainerStorage) {
        this._file.fileContainerStorage = new ZipStorage();
        this._file.fileContainerStorage.storagePath = this._file.extendedPath + "#";
      }

      storage = this._file.fileContainerStorage as ZipStorage;
    } else {
      this._zipStorage = new ZipStorage();
      storage = this._zipStorage;
    }

    await storage.loadFromUint8Array(content);

    const rootFolder = storage.rootFolder;

    await this.loadFromFolder(rootFolder);
  }

  async applyWorldSettings(worldSettings?: IWorldSettings) {
    if (!this._isLoaded) {
      await this.load(false);
    }

    await this.ensureLevelData();

    if (this.levelData) {
      this.levelData.ensureDefaults();
      if (worldSettings) {
        this.levelData.applyFromWorldSettings(worldSettings);
      }
    }
  }

  ensureLevelData() {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    return this.levelData;
  }

  async loadFromFolder(rootFolder: IFolder) {
    const rootDataFile = await rootFolder.getFileFromRelativePath(LEVELDAT_RELPATH);

    if (rootDataFile !== undefined) {
      await rootDataFile.loadContent();

      if (rootDataFile.content !== undefined && rootDataFile.content instanceof Uint8Array) {
        this.levelData = new WorldLevelDat();

        this.levelData.loadFromNbtBytes(rootDataFile.content);

        this._loadFromNbt();
      }
    }

    const levelNameTextFile = await rootFolder.getFileFromRelativePath(LEVELNAMETXT_RELPATH);

    if (levelNameTextFile !== undefined) {
      await levelNameTextFile.loadContent();

      if (levelNameTextFile.content !== undefined && typeof levelNameTextFile.content === "string") {
        this.name = levelNameTextFile.content;
      }
    }

    const manifestJsonFile = await rootFolder.getFileFromRelativePath(MANIFEST_RELPATH);

    if (manifestJsonFile !== undefined) {
      await manifestJsonFile.loadContent();

      if (manifestJsonFile.content !== undefined && typeof manifestJsonFile.content === "string") {
        this._manifest = JSON.parse(manifestJsonFile.content);
      }
    }

    let packsFile = await rootFolder.getFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);

    if (packsFile !== undefined) {
      await packsFile.loadContent();

      if (packsFile.content !== undefined && typeof packsFile.content === "string") {
        try {
          this.worldBehaviorPacks = JSON.parse(packsFile.content);
        } catch {
          Log.fail("Could not parse behavior pack file content");
          this.worldBehaviorPacks = undefined;
        }
      }
    }

    packsFile = await rootFolder.getFileFromRelativePath(RESOURCE_PACKS_RELPATH);

    if (packsFile !== undefined) {
      await packsFile.loadContent();

      if (packsFile.content !== undefined && typeof packsFile.content === "string") {
        try {
          this.worldResourcePacks = JSON.parse(packsFile.content);
        } catch {
          Log.fail("Could not parse resource pack file content");
          this.worldResourcePacks = undefined;
        }
      }
    }

    let packHistoryFile = await rootFolder.getFileFromRelativePath(BEHAVIOR_PACK_HISTORY_RELPATH);

    if (packHistoryFile !== undefined) {
      await packHistoryFile.loadContent();

      if (packHistoryFile.content !== undefined && typeof packHistoryFile.content === "string") {
        try {
          this.worldBehaviorPackHistory = JSON.parse(packHistoryFile.content);
        } catch {
          Log.fail("Could not parse behavior pack history file content");
          this.worldBehaviorPackHistory = undefined;
        }
      }
    }

    packHistoryFile = await rootFolder.getFileFromRelativePath(RESOURCE_PACK_HISTORY_RELPATH);

    if (packHistoryFile !== undefined) {
      await packHistoryFile.loadContent();

      if (packHistoryFile.content !== undefined && typeof packHistoryFile.content === "string") {
        try {
          this.worldResourcePackHistory = JSON.parse(packHistoryFile.content);
        } catch {
          Log.fail("Could not parse resource pack history file content");
          this.worldResourcePackHistory = undefined;
        }
      }
    }

    const imageFile = await rootFolder.getFileFromRelativePath("/world_icon.jpeg");

    if (imageFile !== undefined) {
      await imageFile.loadContent();

      if (imageFile.content instanceof Uint8Array) {
        this.imageBase64 = Utilities.uint8ArrayToBase64(imageFile.content);
      }
    }

    this._onLoaded.dispatch(this, this);

    this._isLoaded = true;
  }

  async loadData(force: boolean = false) {
    if (!force && this._isDataLoaded) {
      return;
    }

    const rootFolder = this.effectiveRootFolder;

    if (!rootFolder) {
      return;
    }

    const dbFolder = await rootFolder.getFolderFromRelativePath("/db");

    const ldbFileArr: IFile[] = [];
    const logFileArr: IFile[] = [];

    if (dbFolder) {
      await dbFolder.load(false);

      for (const fileName in dbFolder.files) {
        const file = dbFolder.files[fileName];

        if (file) {
          const extension = StorageUtilities.getTypeFromName(file.name);

          if (extension === "ldb") {
            // console.log("Adding map file " + file.name + "|" + ldbFileArr.length);
            ldbFileArr.push(file);
          } else if (extension === "log") {
            // console.log("Adding map file " + file.name);
            logFileArr.push(file);
          }
        }
      }
    }

    this.levelDb = new LevelDb(ldbFileArr, logFileArr);

    await this.levelDb.init();

    this.processWorldData();

    this._onDataLoaded.dispatch(this, this);

    this._isDataLoaded = true;
  }

  getTopBlockY(x: number, z: number) {
    const chunkX = Math.floor(x / CHUNK_X_SIZE);
    const xDim = this.chunks[chunkX];

    if (xDim === undefined) {
      return undefined;
    }

    const chunkZ = Math.floor(z / CHUNK_Z_SIZE);
    const zDim = xDim[chunkZ];

    if (zDim === undefined) {
      return undefined;
    }

    return zDim.getTopBlockY(x - chunkX * CHUNK_X_SIZE, z - chunkZ * CHUNK_Z_SIZE);
  }

  getTopBlock(x: number, z: number) {
    const chunkX = Math.floor(x / CHUNK_X_SIZE);
    const xDim = this.chunks[chunkX];

    if (xDim === undefined) {
      return undefined;
    }

    const chunkZ = Math.floor(z / CHUNK_Z_SIZE);
    const zDim = xDim[chunkZ];

    if (zDim === undefined) {
      return undefined;
    }

    return zDim.getTopBlock(x - chunkX * CHUNK_X_SIZE, z - chunkZ * CHUNK_Z_SIZE);
  }

  spawnEntity(entityTypeId: string, location: BlockLocation) {
    const e = new Entity();

    return e;
  }

  getBlock(blockLocation: BlockLocation) {
    const chunkX = Math.floor(blockLocation.x / CHUNK_X_SIZE);
    const xDim = this.chunks[chunkX];

    if (xDim === undefined) {
      return new Block("air");
    }

    const chunkZ = Math.floor(blockLocation.z / CHUNK_Z_SIZE);
    const zDim = xDim[chunkZ];
    if (zDim === undefined) {
      return new Block("air");
    }

    const subChunk = zDim.subChunks[Math.floor(blockLocation.y / SUBCHUNK_Y_SIZE)];

    if (subChunk === undefined) {
      return new Block("air");
    }

    const block = zDim.getBlock(
      blockLocation.x - chunkX * CHUNK_X_SIZE,
      blockLocation.y,
      blockLocation.z - chunkZ * CHUNK_Z_SIZE
    );

    if (!block) {
      return new Block("air");
    }

    return block;
  }

  private processWorldData() {
    if (!this.levelDb) {
      return;
    }

    this.chunks = [];

    for (const keyname in this.levelDb.keys) {
      const keyValue = this.levelDb.keys[keyname];

      if (keyname.startsWith("AutonomousEntities")) {
      } else if (keyname.startsWith("schedulerWT")) {
      } else if (keyname.startsWith("Overworld")) {
      } else if (keyname.startsWith("BiomeData")) {
      } else if (keyname.startsWith("CustomProperties")) {
        this._hasCustomProps = true;
      } else if (keyname.startsWith("DynamicProperties") && keyValue !== undefined) {
        this._hasDynamicProps = true;
        const dynamicPropertyBytes = keyValue.value;

        if (dynamicPropertyBytes) {
          const dynamicProps = new NbtBinary();

          dynamicProps.fromBinary(dynamicPropertyBytes, true, false, 0, true);

          if (dynamicProps.root) {
            const children = dynamicProps.root.getTagChildren();
            this._dynamicProperties = {};

            for (const child of children) {
              if (child.name && Utilities.isValidUuid(child.name)) {
                this._dynamicProperties[child.name] = {};

                const bpChildren = child.getTagChildren();

                for (const propChild of bpChildren) {
                  if (propChild.name && propChild.type === NbtTagType.string) {
                    this._dynamicProperties[child.name][propChild.name] = propChild.valueAsString;

                    if (child.name === CREATOR_TOOLS_EDITOR_BPUUID) {
                      this.loadAnchorsFromDynamicProperties();
                    }
                  }
                }
              }
            }
          }
        }
      } else if (keyname.startsWith("LevelChunkMetaDataDictionary")) {
      } else if (keyname.startsWith("structuretemplate_")) {
      } else if (keyname.startsWith("digp") && keyValue !== undefined) {
        const keyBytes = keyValue.keyBytes;

        if (keyBytes) {
          const x = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);
          const z = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

          if (this.chunks[x] === undefined) {
            this.chunks[x] = [];
          }

          if (this.chunks[x][z] === undefined) {
            const wc = new WorldChunk(this, x, z);
            this.chunkCount++;

            this.chunks[x][z] = wc;
          }

          if (keyValue.value !== undefined) {
            const keyValueBytes = keyValue.value;
            if (keyValueBytes.length > 0 && keyValueBytes.length % 8 === 0) {
              let hexStr = "";

              for (let bc = 0; bc < keyValueBytes.length; bc += 8) {
                hexStr += Utilities.convertToHexString([
                  keyValueBytes[bc + 0],
                  keyValueBytes[bc + 1],
                  keyValueBytes[bc + 2],
                  keyValueBytes[bc + 3],
                  keyValueBytes[bc + 4],
                  keyValueBytes[bc + 5],
                  keyValueBytes[bc + 6],
                  keyValueBytes[bc + 7],
                ]);
              }

              this.chunks[x][z].addActorDigest(hexStr);
            } else if (keyValueBytes.length !== 0) {
              Log.error("Unexpected actor digest length");
            }
          }

          //    this.chunks[x][z].addKeyValue(keyValue);

          if (this.chunkCount % 10000 === 0) {
            console.log("Loaded " + this.chunkCount + " chunks.");
          }
        }
      } else if (keyname.startsWith("actorprefix") && keyValue !== undefined) {
        const keyBytes = keyValue.keyBytes;

        if (keyBytes && keyBytes.length === 19 && keyValue.value) {
          const hexStr = Utilities.convertToHexString([
            keyBytes[11],
            keyBytes[12],
            keyBytes[13],
            keyBytes[14],
            keyBytes[15],
            keyBytes[16],
            keyBytes[17],
            keyBytes[18],
          ]);

          const actorItem = new ActorItem(hexStr, keyValue.value);
          this.actorsById[hexStr] = actorItem;
        } else if (keyBytes && keyBytes.length === 27 && keyValue.value) {
          const hexStr = Utilities.convertToHexString([
            keyBytes[11],
            keyBytes[12],
            keyBytes[13],
            keyBytes[14],
            keyBytes[15],
            keyBytes[16],
            keyBytes[17],
            keyBytes[18],
            keyBytes[19],
            keyBytes[20],
            keyBytes[21],
            keyBytes[22],
            keyBytes[23],
            keyBytes[24],
            keyBytes[25],
            keyBytes[26],
          ]);

          const actorItem = new ActorItem(hexStr, keyValue.value);
          this.actorsById[hexStr] = actorItem;
        } else {
          Log.error("Unexpected actor prefix length");
        }
      } else if (keyname.startsWith("player")) {
      } else if (keyname.startsWith("portals")) {
      } else if (keyname.startsWith("LevelSpawnWasFixed")) {
      } else if (keyname.startsWith("VILLAGE_")) {
      } else if (keyname.startsWith("gametestinstance_")) {
      } else if (keyname.startsWith("tickingarea_")) {
      } else if (keyname.startsWith("map_")) {
      } else if (keyname.startsWith("scoreboard")) {
      } else if (keyname.startsWith("~local_player")) {
      } else if (keyname.startsWith("mobevents")) {
      } else if (keyname.startsWith("game_flatworldlayers")) {
      } else if (keyname.startsWith("dimension")) {
      } else if (
        keyValue !== undefined &&
        (keyname.length === 9 ||
          keyname.length === 10 ||
          keyname.length === 17 ||
          keyname.length === 18 ||
          keyname.length === 13 ||
          keyname.length === 14)
      ) {
        const keyBytes = keyValue.keyBytes;

        if (keyBytes) {
          const x = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
          const z = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);

          if (this._minX === undefined || x * 16 < this._minX) {
            this._minX = x * 16;
          }

          if (this._maxX === undefined || x * 16 > this._maxX) {
            this._maxX = x * 16;
          }

          if (this._minZ === undefined || z * 16 < this._minZ) {
            this._minZ = z * 16;
          }

          if (this._maxZ === undefined || z * 16 > this._maxZ) {
            this._maxZ = z * 16;
          }

          if (this.chunks[x] === undefined) {
            this.chunks[x] = [];
          }

          if (this.chunks[x][z] === undefined) {
            const wc = new WorldChunk(this, x, z);
            this.chunkCount++;

            this.chunks[x][z] = wc;
          }

          this.chunks[x][z].addKeyValue(keyValue);

          if (this.chunkCount % 10000 === 0) {
            console.log("Loaded " + this.chunkCount + " chunks.");
          }
        }
      } else if (keyValue === undefined) {
        console.log("Nulling record '" + keyname + "'");
      } else if (keyValue !== undefined) {
        Log.fail("Unknown record type: '" + keyname + "'");
      } else {
        Log.fail("Unknown record.");
      }
    }

    // let block = this.getBlock(new BlockLocation(344, 58, 4));
  }

  private async saveAutoGenItems() {
    if (!this._project) {
      return;
    }

    if (this._autogenJsFile === undefined) {
      const newFileName = "LocalWorld.js";

      const scriptFolder = await this._project.ensureScriptsFolder();

      const genFolder = scriptFolder.ensureFolder("generated");

      if (scriptFolder) {
        this._autogenJsFile = genFolder.ensureFile(newFileName);

        this._project.ensureItemByStoragePath(
          this._autogenJsFile.storageRelativePath,
          ProjectItemStorageType.singleFile,
          this._autogenJsFile.name,
          ProjectItemType.js,
          true
        );
      }
    }

    if (this._autogenJsFile) {
      const content = this.getAutoGenScript();
      this._autogenJsFile.setContent(content);

      await this._autogenJsFile.saveContent(false);
    }
  }

  private getAutoGenScript() {
    const content: string[] = [];

    content.push("export default const " + this.name + " = {");
    if (this.anchors) {
      const anchorKeys = this.anchors.getKeys();

      content.push("  anchors: {");
      for (const anchorKey of anchorKeys) {
        const anchor = this.anchors.get(anchorKey);

        if (anchor) {
          content.push(
            "    " +
              anchor.name +
              ": { from: { x: " +
              anchor.from.x +
              ", y: " +
              anchor.from.y +
              ", z:" +
              anchor.from.z +
              "}},"
          );
        }
      }

      content.push("  }");
    }

    content.push("}");

    return content.join("\n");
  }

  getCube(from: BlockLocation, to: BlockLocation) {
    const bc = new BlockCube();

    let fromY = from.y;
    if (fromY) {
      if (fromY < this.absoluteY) {
        fromY = this.absoluteY;
      }
    }

    bc.setMaxDimensions(Math.abs(to.x - from.x), Math.abs(to.y - fromY), Math.abs(to.z - from.z));

    const subChunkXStart = Math.floor(from.x / 16);
    const subChunkXEnd = Math.floor(to.x / 16);

    const subChunkZStart = Math.floor(from.z / 16);
    const subChunkZEnd = Math.floor(to.z / 16);

    let cubeX = 0;
    let insetX = (from.x - subChunkXStart * 16) % 16;
    let toGoX = Math.abs(to.x - from.x) + 1;

    for (let iX = subChunkXStart; iX <= subChunkXEnd; iX++) {
      const nextChunkToGoX = Math.min(toGoX, 16, 16 - insetX);

      let cubeZ = 0;
      let insetZ = (from.z - subChunkZStart * 16) % 16;
      let toGoZ = Math.abs(to.z - from.z) + 1;

      for (let iZ = subChunkZStart; iZ <= subChunkZEnd; iZ++) {
        const chunkX = this.chunks[iX];

        if (chunkX) {
          const chunk = chunkX[iZ];
          const nextChunkToGoZ = Math.min(toGoZ, 16, 16 - insetZ);

          if (chunk) {
            chunk.fillCube(
              bc,
              cubeX,
              0,
              cubeZ,
              cubeX + nextChunkToGoX,
              Math.abs(to.y - fromY),
              cubeZ + nextChunkToGoZ,
              insetX,
              fromY,
              insetZ
            );
          }
        }

        if (iZ === subChunkZStart) {
          cubeZ += 16 - insetZ;
          toGoZ -= 16 - insetZ;
          insetZ = 0;
        } else {
          cubeZ += 16;
          toGoZ -= 16;
        }
      }

      if (iX === subChunkXStart) {
        cubeX += 16 - insetX;
        toGoX -= 16 - insetX;
        insetX = 0;
      } else {
        cubeX += 16;
        toGoX -= 16;
      }
    }

    return bc;
  }

  getSubChunkCube(x: number, y: number, z: number) {
    const xDim = this.chunks[Math.floor(x / 16)];

    if (xDim === null) {
      return undefined;
    }

    const zDim = xDim[Math.floor(z / 16)];

    if (zDim === undefined) {
      return undefined;
    }

    return zDim.getSubChunkCube(Math.floor(y / 16));
  }
}