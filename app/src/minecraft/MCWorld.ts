// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCWorld.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * MCWorld is the primary class for managing Minecraft world data, including:
 * - World metadata (level.dat, level name, spawn position)
 * - World chunks and blocks (via LevelDB)
 * - Behavior/resource pack registrations
 * - Dynamic properties and experiments
 *
 * REAL-TIME SYNCHRONIZATION:
 * --------------------------
 * MCWorld can listen to IStorage events to automatically update when external
 * changes occur (e.g., file changes from a remote server):
 *
 * 1. Call startListeningToStorage() to subscribe to storage events
 * 2. When onFileContentsUpdated fires, MCWorld reloads affected data
 * 3. MCWorld fires appropriate events (onChunkUpdated, onDataReloaded, etc.)
 * 4. WorldView and other UI components update in response
 *
 * EVENTS:
 * -------
 * - onLoaded: Fired when world initially loads
 * - onDataLoaded: Fired when world data (chunks) finishes loading
 * - onChunkUpdated: Fired when a specific chunk is updated/reloaded
 * - onWorldDataReloaded: Fired when world files are externally modified and reloaded
 * - onPropertyChanged: Fired when a world property changes
 *
 * DATA FLOW:
 * ----------
 * HttpStorage (WebSocket notifications) -> MCWorld (this) ->
 *   onChunkUpdated/onWorldDataReloaded -> WorldView (React update)
 *
 * RELATED FILES:
 * --------------
 * - IStorage.ts: Storage events (onFileContentsUpdated, etc.)
 * - HttpStorage.ts: Client-side storage with WebSocket notifications
 * - WorldView.tsx: UI component that displays world data
 * - WorldChunk.ts: Individual chunk data
 * - LevelDb.ts: LevelDB file parser
 */

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
import LevelDb, { IChunkCoordinate } from "./LevelDb";
import DataUtilities from "../core/DataUtilities";
import WorldChunk from "./WorldChunk";
import BlockLocation from "./BlockLocation";
import BlockVolume from "./BlockVolume";
import IDimension from "./IDimension";
import Block from "./Block";
import Entity from "./Entity";
import { IPackageReference, IWorldSettings } from "./IWorldSettings";
import { StorageErrorStatus } from "../storage/IStorage";
import MinecraftUtilities from "./MinecraftUtilities";
import NbtBinary from "./NbtBinary";
import { NbtTagType } from "./NbtBinaryTag";
import AnchorSet from "./AnchorSet";
import Project from "../app/Project";
import ActorItem from "./ActorItem";
import { StatusTopic } from "../app/Status";
import { IErrorMessage, IErrorable } from "../core/IErrorable";
import ProjectItem from "../app/ProjectItem";
import WorldChunkCache from "./WorldChunkCache";

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

const CREATOR_TOOLS_EDITOR_BPUUID = "5d2f0b91-ca29-49da-a275-e6c6262ea3de";

export interface IWorldProcessingOptions {
  maxNumberOfRecordsToProcess?: number;
  progressCallback?: (phase: string, current: number, total: number) => void;
  /**
   * If true, unloads raw file content after parsing to reduce memory usage.
   * Recommended for large worlds to prevent out-of-memory errors.
   * Default: true (optimized for memory)
   */
  unloadFilesAfterParse?: boolean;
  /**
   * If true, deletes LevelDB keys from the keys Map after they are processed
   * and handed off to WorldChunks. This significantly reduces memory usage
   * for large worlds by eliminating duplicate references.
   * Default: true (optimized for memory)
   */
  clearKeysAfterProcess?: boolean;
  /**
   * If true, uses lazy loading mode for LevelDB.
   * Only manifest metadata is loaded initially; files are loaded on-demand.
   * This dramatically reduces initial memory usage for large worlds.
   *
   * When enabled:
   * - Initial load only parses manifest files
   * - LDB/LOG files are loaded only when their keys are needed
   * - Chunk cache manages memory by evicting least-recently-used chunks
   *
   * Default: false (full load for backwards compatibility)
   */
  lazyLoad?: boolean;
  /**
   * Maximum number of chunks to keep in the LRU cache when using lazy loading.
   * When exceeded, least-recently-used chunks have their parsed data cleared
   * (but can be re-parsed on demand from raw LevelKeyValue data).
   *
   * Default: 20000
   */
  maxChunksInCache?: number;
  /**
   * If true, skips the full "Phase 2" world data processing that creates
   * WorldChunk objects for every chunk upfront. Instead, chunks will be
   * created on-demand when they are first accessed.
   *
   * This is ideal for map viewing where only visible chunks need to be loaded.
   * It dramatically reduces memory usage for very large worlds (100k+ chunks).
   *
   * When enabled:
   * - World bounds (minX, maxX, minZ, maxZ) are calculated from key names
   * - Chunk objects are created lazily when getChunkAt() is called
   * - Full chunk data is only parsed when accessed
   *
   * Default: false (full processing for backwards compatibility)
   */
  skipFullProcessing?: boolean;
}

export interface IRegion {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export default class MCWorld implements IGetSetPropertyObject, IDimension, IErrorable {
  // Where possible, if _file is defined we'd prefer to use
  // _file.fileContentStorage for zip manip. _zipStorage is only used from
  // a pure "zip bytes in memory" scenario (for generating downloads.)
  private _zipStorage?: ZipStorage;

  private _file?: IFile;
  private _folder?: IFolder;
  private _project?: Project;

  private _autogenTsFile?: IFile;

  private _anchors = new AnchorSet();

  private _dynamicProperties: { [behaviorPackUid: string]: { [propertyName: string]: string | number | boolean } } = {};
  private _levelNameText?: string;

  private _manifest?: IWorldManifest;

  private _isLoaded = false;
  private _isDataLoaded = false;
  private _onLoaded = new EventDispatcher<MCWorld, MCWorld>();
  private _onDataLoaded = new EventDispatcher<MCWorld, MCWorld>();
  private _onChunkUpdated = new EventDispatcher<MCWorld, WorldChunk>();
  /** Event fired when world data is externally modified and reloaded */
  private _onWorldDataReloaded = new EventDispatcher<MCWorld, string>();
  /** Whether we're listening to storage events for automatic updates */
  private _isListeningToStorage = false;

  private _hasDynamicProps = false;
  private _hasCustomProps = false;

  private _onPropertyChanged = new EventDispatcher<MCWorld, string>();

  private _biomeData: NbtBinary | undefined;
  private _overworldData: NbtBinary | undefined;
  private _levelChunkMetaData: NbtBinary | undefined;
  private _generationSeed: string | undefined;

  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  worldBehaviorPacks?: IPackRegistration[];
  worldResourcePacks?: IPackRegistration[];
  worldBehaviorPackHistory?: IPackHistory;
  worldResourcePackHistory?: IPackHistory;
  chunkCount = 0;

  private _chunkMinY = -64;
  imageBase64?: string;

  levelDb?: LevelDb;

  actorsById: { [identifier: string]: ActorItem } = {};

  levelData?: WorldLevelDat;

  private _minX: number | undefined;
  private _maxX: number | undefined;
  private _minZ: number | undefined;
  private _maxZ: number | undefined;

  regionsByDimension: { [dim: number]: IRegion[] } = {};

  chunks: Map<number, Map<number, Map<number, WorldChunk>>> = new Map();

  /**
   * All dimension IDs found in LevelDB chunk keys, including custom dimensions (>= 1000).
   * Populated during processWorldData or buildMinimalWorldIndex.
   */
  private _dimensionIdsInChunks: Set<number> = new Set();

  /**
   * Parsed DimensionNameIdTable from LevelDB: maps dimension name to numeric ID.
   * Undefined if the DimensionNameIdTable key was not found.
   */
  private _dimensionNameIdTable: Map<string, number> | undefined;

  /** Whether the DimensionNameIdTable key exists in the LevelDB */
  private _hasDimensionNameIdTable = false;

  /** LRU cache for chunk data - manages memory by evicting old chunks */
  private _chunkCache?: WorldChunkCache;

  /** Whether lazy loading mode is enabled for this world */
  private _isLazyLoadMode = false;

  /**
   * Set of chunk keys that exist in the world (format: "dim_x_z").
   * Built during buildMinimalWorldIndex for O(1) chunk existence checking.
   * This allows fast filtering of empty/non-existent chunks without scanning LevelDB keys.
   */
  private _chunkExistsSet: Set<string> = new Set();

  /**
   * Returns the set of all known chunk keys (format: "dim_x_z").
   * Used by WorldMap to ensure sparse worlds render all known chunks,
   * not just those hit by the sampling grid.
   */
  public get knownChunkKeys(): ReadonlySet<string> {
    return this._chunkExistsSet;
  }

  /**
   * Index mapping chunk keys ("dim_x_z") to the list of LevelDB key names for that chunk.
   * Built during buildMinimalWorldIndex for O(1) chunk key lookup.
   * This eliminates the O(N) full-scan of LevelDB keys in getOrCreateChunk.
   */
  private _chunkKeyIndex: Map<string, string[]> = new Map();

  public get project() {
    return this._project;
  }

  public set project(newProject: Project | undefined) {
    this._project = newProject;
  }

  public get anchors() {
    return this._anchors;
  }

  public get chunkMinY() {
    return this._chunkMinY;
  }

  public set chunkMinY(newY: number) {
    this._chunkMinY = newY;
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

  /** Get whether lazy loading mode is enabled */
  public get isLazyLoadMode(): boolean {
    return this._isLazyLoadMode;
  }

  /** Get the chunk cache (only available when using chunk caching) */
  public get chunkCache(): WorldChunkCache | undefined {
    return this._chunkCache;
  }

  /** All dimension IDs found in LevelDB chunk keys, including custom dimensions (>= 1000). */
  public get dimensionIdsInChunks(): ReadonlySet<number> {
    return this._dimensionIdsInChunks;
  }

  /** Whether the DimensionNameIdTable key was found in the LevelDB. */
  public get hasDimensionNameIdTable(): boolean {
    return this._hasDimensionNameIdTable;
  }

  /** Parsed DimensionNameIdTable: maps dimension name to numeric ID. Undefined if not found. */
  public get dimensionNameIdTable(): ReadonlyMap<string, number> | undefined {
    return this._dimensionNameIdTable;
  }

  /** Parse DimensionNameIdTable NBT bytes into the name-to-ID map. */
  private _parseDimensionNameIdTable(tableBytes: Uint8Array) {
    this._hasDimensionNameIdTable = true;

    const tableNbt = new NbtBinary();
    tableNbt.context = this.name + " DimensionNameIdTable";
    tableNbt.fromBinary(tableBytes, true, false, 0, true);

    if (tableNbt.singleRoot) {
      this._dimensionNameIdTable = new Map();
      const children = tableNbt.singleRoot.getTagChildren();

      for (const child of children) {
        if (child.name && (child.type === NbtTagType.int || child.type === NbtTagType.long)) {
          this._dimensionNameIdTable.set(child.name, child.valueAsInt);
        }
      }
    }
  }

  /**
   * Check if chunk data exists at the specified coordinates without loading it.
   * This is O(1) when buildMinimalWorldIndex has been called (skipFullProcessing mode).
   * Returns true if the chunk exists in the world's LevelDB data.
   * Returns undefined if existence cannot be determined (index not built).
   */
  public hasChunkData(dim: number, x: number, z: number): boolean | undefined {
    // If we have the chunk exists set, use it for O(1) lookup
    if (this._chunkExistsSet.size > 0) {
      return this._chunkExistsSet.has(`${dim}_${x}_${z}`);
    }

    // If we already have the chunk loaded, it exists
    const existing = this.getChunkAt(dim, x, z);
    if (existing) {
      return true;
    }

    // Can't determine without scanning LevelDB
    return undefined;
  }

  /**
   * Get a chunk by coordinates.
   * If chunk caching is enabled, marks the chunk as recently accessed.
   */
  public getChunkAt(dim: number, x: number, z: number): WorldChunk | undefined {
    const dimMap = this.chunks.get(dim);
    if (!dimMap) return undefined;

    const xPlane = dimMap.get(x);
    if (!xPlane) return undefined;

    const chunk = xPlane.get(z);

    // Track access for LRU cache
    if (chunk && this._chunkCache) {
      this._chunkCache.access(dim, x, z);
    }

    return chunk;
  }

  /**
   * Get a chunk by cache key (format: "dim_x_z").
   * Used by WorldChunkCache for eviction callbacks.
   */
  public getChunkByKey(key: string): WorldChunk | undefined {
    const coords = WorldChunkCache.parseKey(key);
    if (!coords) return undefined;

    const dimMap = this.chunks.get(coords.dim);
    if (!dimMap) return undefined;

    const xPlane = dimMap.get(coords.x);
    if (!xPlane) return undefined;

    return xPlane.get(coords.z);
  }

  public get generationSeed() {
    if (this._generationSeed === undefined && this._levelChunkMetaData && this._levelChunkMetaData.singleRoot) {
      const tag = this._levelChunkMetaData.singleRoot.find("GenerationSeed");
      if (tag !== null) {
        this._generationSeed = tag.valueAsBigInt.toString();
      }
    }

    return this._generationSeed;
  }

  public async copyAsFolderTo(targetFolder: IFolder) {
    if (this._folder) {
      await StorageUtilities.syncFolderTo(this._folder, targetFolder, true, true, true);
    } else if (this._file) {
      const storage = this.storage;

      if (storage) {
        await StorageUtilities.syncFolderTo(this.storage.rootFolder, targetFolder, true, true, true);
      }
    }
  }

  public get storage() {
    if (this._file) {
      if (!this._file.fileContainerStorage) {
        this._file.fileContainerStorage = new ZipStorage();
        this._file.fileContainerStorage.containerFile = this._file;
        this._file.fileContainerStorage.storagePath = this._file.extendedPath + "#";
      }

      return this._file.fileContainerStorage;
    }

    if (this._zipStorage === undefined) {
      this._zipStorage = new ZipStorage();
    }

    return this._zipStorage;
  }

  public ensureZipStorage() {
    if (this._zipStorage === undefined) {
      this._zipStorage = new ZipStorage();
    }
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

  get deferredTechnicalPreviewExperiment() {
    if (this.levelData !== undefined) {
      const val = this.levelData.deferredTechnicalPreviewExperiment;

      if (val === undefined) {
        return false;
      }

      return val;
    }

    return false;
  }

  set deferredTechnicalPreviewExperiment(newVal: boolean) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    if (this.levelData !== undefined) {
      this.levelData.deferredTechnicalPreviewExperiment = newVal;
    }
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

  get dataDrivenItemsExperiment() {
    if (this.levelData !== undefined) {
      const val = this.levelData.dataDrivenItemsExperiment;

      if (val === undefined) {
        return false;
      }

      return val;
    }

    return false;
  }

  set dataDrivenItemsExperiment(newVal: boolean) {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    if (this.levelData !== undefined) {
      this.levelData.dataDrivenItemsExperiment = newVal;
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

  public get onChunkUpdated() {
    return this._onChunkUpdated.asEvent();
  }

  /**
   * Event fired when world data is externally modified and reloaded.
   * Subscribe to this event to update UI when remote changes occur.
   */
  public get onWorldDataReloaded() {
    return this._onWorldDataReloaded.asEvent();
  }

  /**
   * Whether this world is listening to storage events for automatic updates.
   */
  public get isListeningToStorage(): boolean {
    return this._isListeningToStorage;
  }

  /**
   * Start listening to storage events for automatic world data updates.
   * When file changes are detected (via WebSocket or fs watcher), the world
   * will automatically reload affected data and fire appropriate events.
   */
  public startListeningToStorage(): void {
    Log.verbose("[MCWorld] startListeningToStorage called, _isListeningToStorage=" + this._isListeningToStorage);

    if (this._isListeningToStorage) {
      Log.verbose("[MCWorld] Already listening to storage events - returning");
      return;
    }

    const storage = this.effectiveRootFolder?.storage;
    Log.verbose(
      "[MCWorld] effectiveRootFolder=" +
        this.effectiveRootFolder?.fullPath +
        ", storage=" +
        (storage ? storage.constructor.name : "null")
    );

    if (!storage) {
      Log.verbose("[MCWorld] Cannot start listening: no storage available");
      return;
    }

    Log.message(`[MCWorld] Starting to listen to storage events on ${storage.constructor.name}`);

    // Subscribe to file content updates
    storage.onFileContentsUpdated.subscribe((sender, event) => {
      Log.message(`[MCWorld] Received onFileContentsUpdated: ${event.file.storageRelativePath}`);
      this._handleStorageFileUpdate(event.file.storageRelativePath, event);
    });

    // Subscribe to file additions
    storage.onFileAdded.subscribe((sender, file) => {
      Log.message(`[MCWorld] Received onFileAdded: ${file.storageRelativePath}`);
      this._handleStorageFileAdded(file.storageRelativePath);
    });

    // Subscribe to file removals
    storage.onFileRemoved.subscribe((sender, path) => {
      Log.message(`[MCWorld] Received onFileRemoved: ${path}`);
      this._handleStorageFileRemoved(path);
    });

    this._isListeningToStorage = true;
    Log.message("[MCWorld] Successfully subscribed to storage events");
  }

  /**
   * Stop listening to storage events.
   */
  public stopListeningToStorage(): void {
    // Note: ste-events doesn't have a simple "unsubscribe all" mechanism
    // In a full implementation, we'd need to track subscription handles
    this._isListeningToStorage = false;
    Log.verbose("MCWorld: Stopped listening to storage events");
  }

  /**
   * Handle a file update from storage.
   */
  private async _handleStorageFileUpdate(path: string, event: any): Promise<void> {
    if (!path) return;

    // The path coming from storage events may be like /world/db/000039.log
    // But MCWorld's effectiveRootFolder is already the world folder,
    // so we need to strip the /world prefix if present
    let relativePath = path;
    if (relativePath.startsWith("/world/")) {
      relativePath = relativePath.substring(6); // Keep the leading / after "world"
    } else if (relativePath.startsWith("world/")) {
      relativePath = "/" + relativePath.substring(6);
    }

    const pathLower = relativePath.toLowerCase();
    const rootFolder = this.effectiveRootFolder;

    if (!rootFolder) return;

    try {
      // Check what type of file changed
      if (pathLower.endsWith("level.dat")) {
        // Reload level data
        const levelDatFile = await rootFolder.getFileFromRelativePath(LEVELDAT_RELPATH);
        if (levelDatFile) {
          await levelDatFile.loadContent(true);
          if (levelDatFile.content instanceof Uint8Array) {
            this.levelData = new WorldLevelDat();
            this.levelData.loadFromNbtBytes(levelDatFile.content);
            this._loadFromNbt();
          }
        }
        this._onWorldDataReloaded.dispatch(this, "level.dat");
      } else if (pathLower.endsWith("levelname.txt")) {
        // Reload level name
        const levelNameFile = await rootFolder.getFileFromRelativePath(LEVELNAMETXT_RELPATH);
        if (levelNameFile) {
          await levelNameFile.loadContent(true);
          if (typeof levelNameFile.content === "string") {
            this.name = levelNameFile.content;
          }
        }
        this._onWorldDataReloaded.dispatch(this, "levelname.txt");
      } else if (pathLower.includes("/db/") && (pathLower.endsWith(".ldb") || pathLower.endsWith(".log"))) {
        // LevelDB file changed - use incremental loading
        await this._handleIncrementalLevelDbUpdate(relativePath);
      } else if (pathLower.endsWith("world_behavior_packs.json")) {
        const packsFile = await rootFolder.getFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);
        if (packsFile) {
          await packsFile.loadContent(true);
          if (typeof packsFile.content === "string") {
            this.worldBehaviorPacks = StorageUtilities.getJsonObject(packsFile);
          }
        }
        this._onWorldDataReloaded.dispatch(this, "behavior_packs");
      } else if (pathLower.endsWith("world_resource_packs.json")) {
        const packsFile = await rootFolder.getFileFromRelativePath(RESOURCE_PACKS_RELPATH);
        if (packsFile) {
          await packsFile.loadContent(true);
          if (typeof packsFile.content === "string") {
            this.worldResourcePacks = StorageUtilities.getJsonObject(packsFile);
          }
        }
        this._onWorldDataReloaded.dispatch(this, "resource_packs");
      }

      Log.verbose(`MCWorld: Handled file update: ${path}`);
    } catch (e) {
      Log.debug(`MCWorld: Error handling file update ${path}: ${e}`);
    }
  }

  /**
   * Handle a new file being added to storage.
   */
  private async _handleStorageFileAdded(path: string): Promise<void> {
    // For now, treat file additions similar to updates
    await this._handleStorageFileUpdate(path, null);
  }

  /**
   * Handle a file being removed from storage.
   */
  private async _handleStorageFileRemoved(path: string): Promise<void> {
    if (!path) return;

    const pathLower = path.toLowerCase();

    // Handle removal of important files
    if (pathLower.includes("/db/") && pathLower.endsWith(".ldb")) {
      // LevelDB compaction - chunks may have moved to new files
      // This is a rare case where we might need a broader refresh,
      // but typically compaction doesn't lose data, just reorganizes it
      Log.verbose(`MCWorld: LDB file removed (compaction): ${path}`);
    }

    Log.verbose(`MCWorld: Handled file removal: ${path}`);
  }

  /**
   * Handle incremental LevelDB file updates.
   *
   * When a new .ldb or .log file is detected, this method:
   * 1. Parses just that file to extract new keys
   * 2. Identifies which chunks are affected by those keys
   * 3. Updates only those chunks with the new data
   * 4. Fires onChunkUpdated for each affected chunk (for UI updates)
   *
   * This is much more efficient than reloading the entire world.
   */
  private async _handleIncrementalLevelDbUpdate(path: string): Promise<void> {
    if (!this.levelDb) {
      // LevelDB not yet loaded - nothing to update incrementally
      return;
    }

    const rootFolder = this.effectiveRootFolder;
    if (!rootFolder) {
      return;
    }

    try {
      // Get the file that changed
      const file = await rootFolder.getFileFromRelativePath(path);
      if (!file) {
        Log.debug(`MCWorld: Could not find LDB file for incremental update: ${path}`);
        return;
      }

      // Parse the file and get affected chunk coordinates
      const affectedChunks = await this.levelDb.parseIncrementalFile(file);

      if (affectedChunks.length === 0) {
        return;
      }

      Log.verbose(`MCWorld: Incremental update - ${affectedChunks.length} chunks affected from ${path}`);

      // Update each affected chunk
      for (const coord of affectedChunks) {
        await this._updateChunkFromLevelDb(coord);
      }
    } catch (e) {
      Log.error(`MCWorld: Error in incremental LDB update ${path}: ${e}`);
      // Fall back to signaling a broader refresh
      this._onWorldDataReloaded.dispatch(this, "leveldb");
    }
  }

  /**
   * Update a single chunk from LevelDB keys.
   *
   * This finds all keys for the specified chunk coordinates and either:
   * - Updates an existing chunk with the new data
   * - Creates a new chunk if one doesn't exist
   *
   * After updating, fires onChunkUpdated for UI refresh.
   */
  private async _updateChunkFromLevelDb(coord: IChunkCoordinate): Promise<void> {
    if (!this.levelDb) return;

    const { x, z, dimension } = coord;

    // Get or create the chunk
    let chunk = this.getChunkAt(dimension, x, z);
    const isNewChunk = !chunk;

    if (!chunk) {
      chunk = new WorldChunk(this, x, z);
    } else {
      // Clear cached/parsed data so it will be re-parsed from the updated keys
      chunk.clearCachedData();
    }

    // Find all keys that belong to this chunk and add them
    const chunkKey = `${dimension}_${x}_${z}`;
    const indexedKeyNames = this._chunkKeyIndex.get(chunkKey);

    if (indexedKeyNames && indexedKeyNames.length > 0) {
      // Fast path: use the pre-built chunk key index
      for (const keyname of indexedKeyNames) {
        const keyValue = this.levelDb.keys.get(keyname);
        if (!keyValue || typeof keyValue === "boolean") continue;
        chunk.addKeyValue(keyValue);
      }
    } else {
      // Fallback: scan all LevelDB keys (used when index isn't built)
      const hasDim = dimension !== 0;
      for (const [keyname, keyValue] of this.levelDb.keys) {
        // Skip if keyValue is undefined, false (deleted marker), or not a LevelKeyValue
        if (!keyValue || typeof keyValue === "boolean") continue;

        const keyBytes = keyValue.keyBytes;
        if (!keyBytes) continue;
        if (keyBytes.length < 9 || keyBytes.length > 14) continue;

        const expectedLength = hasDim ? 13 : 9;
        if (keyBytes.length !== expectedLength && keyBytes.length !== expectedLength + 1) continue;

        const kx = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
        const kz = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);

        if (kx !== x || kz !== z) continue;

        let kDim = 0;
        if (hasDim && keyBytes.length >= 13) {
          kDim = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);
        }

        if (kDim !== dimension) continue;

        // This key belongs to this chunk - add it
        chunk.addKeyValue(keyValue);
      }
    }

    // Add new chunk to the chunks map if needed
    if (isNewChunk) {
      let dimMap = this.chunks.get(dimension);
      if (!dimMap) {
        dimMap = new Map();
        this.chunks.set(dimension, dimMap);
      }

      let xPlane = dimMap.get(x);
      if (!xPlane) {
        xPlane = new Map();
        dimMap.set(x, xPlane);
      }

      xPlane.set(z, chunk);
      this.chunkCount++;

      // Update bounds
      if (this._minX === undefined || x * 16 < this._minX) {
        this._minX = x * 16;
      }
      if (this._maxX === undefined || (x + 1) * 16 > this._maxX) {
        this._maxX = (x + 1) * 16;
      }
      if (this._minZ === undefined || z * 16 < this._minZ) {
        this._minZ = z * 16;
      }
      if (this._maxZ === undefined || (z + 1) * 16 > this._maxZ) {
        this._maxZ = (z + 1) * 16;
      }

      // Add to chunk exists set
      if (this._chunkExistsSet) {
        this._chunkExistsSet.add(`${dimension}_${x}_${z}`);
      }
    }

    // Track access for LRU cache
    if (this._chunkCache) {
      this._chunkCache.access(dimension, x, z);
    }

    // Notify listeners that this chunk was updated
    this._onChunkUpdated.dispatch(this, chunk);
  }

  /**
   * Called by WorldChunk when chunk data is superceded by newer LevelDB keys.
   * This notifies subscribers (like WorldMap) that they may need to redraw affected tiles.
   */
  notifyChunkUpdated(chunk: WorldChunk) {
    this._onChunkUpdated.dispatch(this, chunk);
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
        await mcworld.loadMetaFiles(false);
      } else if (handler) {
        handler(mcworld, mcworld, { unsub: () => {}, stopPropagation: () => {} });
      }

      return mcworld;
    }

    return undefined;
  }

  static async ensureOnItem(projectItem: ProjectItem) {
    let mcworld: MCWorld | undefined = undefined;

    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (projectItem.defaultFolder) {
      mcworld = await MCWorld.ensureMCWorldOnFolder(projectItem.defaultFolder, projectItem.project);
    } else if (projectItem.primaryFile) {
      mcworld = await MCWorld.ensureOnFile(projectItem.primaryFile, projectItem.project);
    }

    if (!mcworld) {
      Log.debugAlert("Could not find respective world.");
    }

    return mcworld;
  }

  static async ensureOnFile(file: IFile, project?: Project, handler?: IEventHandler<MCWorld, MCWorld>) {
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
        await mcworld.loadMetaFiles(false);
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

  public _updateMeta() {
    this.regionsByDimension = {};

    const chunkDims = this.chunks.keys();

    for (const dimNum of chunkDims) {
      const dim = this.chunks.get(dimNum);

      let regions: IRegion[] = [];

      if (dim) {
        const xNums = dim.keys();

        for (const xNum of xNums) {
          const xPlane = dim.get(xNum);

          if (xPlane) {
            const zNums = xPlane.keys();
            for (const zNum of zNums) {
              let addedToRegion = false;

              for (const region of regions) {
                if (xNum >= region.minX && xNum <= region.maxX && zNum >= region.minZ && zNum <= region.maxZ) {
                  region.minX = Math.min(region.minX, xNum - 1);
                  region.minZ = Math.min(region.minZ, zNum - 1);
                  region.maxX = Math.max(region.maxX, xNum + 1);
                  region.maxZ = Math.max(region.maxZ, zNum + 1);
                  addedToRegion = true;
                }
              }

              if (!addedToRegion) {
                regions.push({
                  minX: xNum - 1,
                  minZ: zNum - 1,
                  maxX: xNum + 1,
                  maxZ: zNum + 1,
                });
              }
            }
          }
        }
      }

      this.regionsByDimension[dimNum] = this._coalesceRegions(regions);
    }
  }

  private _coalesceRegions(regions: IRegion[]) {
    const newRegions: IRegion[] = [];

    for (const region of regions) {
      let addedToRegion = false;

      for (const newRegion of newRegions) {
        if (
          region.minX >= newRegion.minX &&
          region.minX <= newRegion.maxX &&
          region.minZ >= newRegion.minZ &&
          region.minZ <= newRegion.maxZ
        ) {
          newRegion.minX = Math.min(newRegion.minX, region.minX - 1);
          newRegion.minZ = Math.min(newRegion.minZ, region.minZ - 1);
          newRegion.maxX = Math.max(newRegion.maxX, region.minX + 1);
          newRegion.maxZ = Math.max(newRegion.maxZ, region.minZ + 1);
          addedToRegion = true;
          break;
        }
        if (
          region.maxX >= newRegion.minX &&
          region.maxX <= newRegion.maxX &&
          region.minZ >= newRegion.minZ &&
          region.minZ <= newRegion.maxZ
        ) {
          newRegion.minX = Math.min(newRegion.minX, region.maxX - 1);
          newRegion.minZ = Math.min(newRegion.minZ, region.minZ - 1);
          newRegion.maxX = Math.max(newRegion.maxX, region.maxX + 1);
          newRegion.maxZ = Math.max(newRegion.maxZ, region.minZ + 1);
          addedToRegion = true;
          break;
        }
        if (
          region.minX >= newRegion.minX &&
          region.minX <= newRegion.maxX &&
          region.maxZ >= newRegion.minZ &&
          region.maxZ <= newRegion.maxZ
        ) {
          newRegion.minX = Math.min(newRegion.minX, region.minX - 1);
          newRegion.minZ = Math.min(newRegion.minZ, region.maxZ - 1);
          newRegion.maxX = Math.max(newRegion.maxX, region.minX + 1);
          newRegion.maxZ = Math.max(newRegion.maxZ, region.maxZ + 1);
          addedToRegion = true;
          break;
        }

        if (
          region.maxX >= newRegion.minX &&
          region.maxX <= newRegion.maxX &&
          region.maxZ >= newRegion.minZ &&
          region.maxZ <= newRegion.maxZ
        ) {
          newRegion.minX = Math.min(newRegion.minX, region.maxX - 1);
          newRegion.minZ = Math.min(newRegion.minZ, region.maxZ - 1);
          newRegion.maxX = Math.max(newRegion.maxX, region.maxX + 1);
          newRegion.maxZ = Math.max(newRegion.maxZ, region.maxZ + 1);
          addedToRegion = true;
          break;
        }
      }

      if (!addedToRegion) {
        newRegions.push(region);
      }
    }

    return newRegions;
  }

  private _pushError(message: string, contextIn?: string) {
    this.isInErrorState = true;

    if (this.errorMessages === undefined) {
      this.errorMessages = [];
    }

    Log.error(message + (contextIn ? " " + contextIn : ""));

    this.errorMessages.push({
      message: message,
      context: contextIn,
    });
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
    await this.saveWorldResourcePacks();
    await this.saveWorldResourcePackHistory();
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

        this._file.fileContainerStorage.containerFile = this._file;
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

  ensurePackReferenceSet(packRefSet: IPackageReference) {
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

    if (packRefSet.behaviorPackReferences) {
      for (let i = 0; i < packRefSet.behaviorPackReferences.length; i++) {
        this.ensurePackReferenceInCollection(packRefSet.behaviorPackReferences[i], this.worldBehaviorPacks);
        this.ensurePackReferenceInHistory(
          packRefSet.behaviorPackReferences[i],
          this.worldBehaviorPackHistory,
          packRefSet.name
        );
      }
    }

    if (packRefSet.resourcePackReferences) {
      for (let i = 0; i < packRefSet.resourcePackReferences.length; i++) {
        this.ensurePackReferenceInCollection(packRefSet.resourcePackReferences[i], this.worldResourcePacks);
        this.ensurePackReferenceInHistory(
          packRefSet.resourcePackReferences[i],
          this.worldResourcePackHistory,
          packRefSet.name
        );
      }
    }
  }

  ensurePackReferenceInCollection(
    packRef: { uuid: string; version: number[]; priority?: number },
    packRefs: IPackRegistration[]
  ) {
    Log.assert(packRef.version.length === 3, "Packref version not within bounds.");

    const compareUuid = Utilities.canonicalizeId(packRef.uuid);

    for (let i = 0; i < packRefs.length; i++) {
      if (Utilities.canonicalizeId(packRefs[i].pack_id) === compareUuid) {
        return;
      }
    }

    packRefs.push({
      pack_id: packRef.uuid,
      version: packRef.version,
      priority: packRef.priority ? packRef.priority : 32767,
    });
  }

  ensurePackReferenceInHistory(
    packRef: { uuid: string; version: number[]; priority?: number },
    packHistory: IPackHistory,
    name: string
  ) {
    Log.assert(packRef.version.length === 3, "Packref version not within bounds.");
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
    const ld = this.levelData;

    switch (id.toLowerCase()) {
      // World identity
      case "levelname":
        return ld?.levelName;
      case "gametype":
        return ld?.gameType;
      case "difficulty":
        return ld?.difficulty;
      case "generator":
        return ld?.generator;
      case "flatworldlayers":
        return ld?.flatWorldLayers ? JSON.stringify(ld.flatWorldLayers) : undefined;
      case "randomseed":
        return ld?.randomSeed;
      case "basegameversion":
        return ld?.baseGameVersion;
      case "inventoryversion":
        return ld?.inventoryVersion;

      // Spawn & bounds
      case "spawnx":
        return this.spawnX;
      case "spawny":
        return this.spawnY;
      case "spawnz":
        return this.spawnZ;
      case "limitedworldoriginx":
        return ld?.limitedWorldOriginX;
      case "limitedworldoriginy":
        return ld?.limitedWorldOriginY;
      case "limitedworldoriginz":
        return ld?.limitedWorldOriginZ;
      case "limitedworlddepth":
        return ld?.limitedWorldDepth;
      case "limitedworldwidth":
        return ld?.limitedWorldWidth;
      case "spawnradius":
        return ld?.spawnRadius;

      // Game rules (boolean)
      case "commandsenabled":
        return ld?.commandsEnabled;
      case "commandblocksenabled":
        return ld?.commandBlocksEnabled;
      case "commandblockoutput":
        return ld?.commandBlockOutput;
      case "cheatsenabled":
        return ld?.cheatsEnabled;
      case "dodaylightcycle":
        return ld?.doDaylightCycle;
      case "doentitydrops":
        return ld?.doEntityDrops;
      case "dofiretick":
        return ld?.doFireTick;
      case "doimmediaterespawn":
        return ld?.doImmediateRespawn;
      case "doinsomnia":
        return ld?.doInsomnia;
      case "domobloot":
        return ld?.doMobLoot;
      case "domobspawning":
        return ld?.doMobSpawning;
      case "dotiledrops":
        return ld?.doTileDrops;
      case "doweathercycle":
        return ld?.doWeatherCycle;
      case "drowningdamage":
        return ld?.drowningDamage;
      case "falldamage":
        return ld?.fallDamage;
      case "firedamage":
        return ld?.fireDamage;
      case "freezedamage":
        return ld?.freezeDamage;
      case "keepinventory":
        return ld?.keepInventory;
      case "mobgriefing":
        return ld?.mobGriefing;
      case "naturalregeneration":
        return ld?.naturalRegeneration;
      case "pvp":
        return ld?.pvp;
      case "respawnblocksexplode":
        return ld?.respawnBlocksExplode;
      case "sendcommandfeedback":
        return ld?.sendCommandFeedback;
      case "showcoordinates":
        return ld?.showCoordinates;
      case "showdeathmessages":
        return ld?.showDeathMessages;
      case "showtags":
        return ld?.showTags;
      case "showbordereffect":
        return ld?.showBorderEffect;
      case "tntexplodes":
        return ld?.tntExplodes;
      case "forcegametype":
        return ld?.forceGameType;
      case "immutableworld":
        return ld?.immutableWorld;
      case "spawnmobs":
        return ld?.spawnMobs;
      case "bonuschestenabled":
        return ld?.bonusChestEnabled;
      case "bonuschestspawned":
        return ld?.bonusChestSpawned;
      case "startwithmapenabled":
        return ld?.startWithMapEnabled;

      // Game rules (numeric)
      case "randomtickspeed":
        return ld?.randomTickSpeed;
      case "functioncommandlimit":
        return ld?.functionCommandLimit;
      case "maxcommandchainlength":
        return ld?.maxCommandChainLength;
      case "serverchunktickrange":
        return ld?.serverChunkTickRange;
      case "netherscale":
        return ld?.netherScale;

      // Multiplayer
      case "multiplayergame":
        return ld?.multiplayerGame;
      case "multiplayergameintent":
        return ld?.multiplayerGameIntent;
      case "lanbroadcast":
        return ld?.lanBroadcast;
      case "lanbroadcastintent":
        return ld?.lanBroadcastIntent;
      case "platformbroadcastintent":
        return ld?.platformBroadcastIntent;
      case "xblbroadcastintent":
        return ld?.xblBroadcastIntent;
      case "usemsagamertagsonly":
        return ld?.useMsaGamertagsOnly;
      case "texturepacksrequired":
        return ld?.texturePacksRequired;

      // Editor
      case "iscreatedineditor":
        return ld?.isCreatedInEditor;
      case "isexportedfromeditor":
        return ld?.isExportedFromEditor;
      case "editorworldtype":
        return ld?.editorWorldType;

      // Experiments
      case "experimentalgameplay":
        return ld?.experimentalGameplay;
      case "betaapisexperiment":
        return ld?.betaApisExperiment;
      case "deferredtechnicalpreviewexperiment":
        return ld?.deferredTechnicalPreviewExperiment;
      case "datadrivenitemsexperiment":
        return ld?.dataDrivenItemsExperiment;
      case "savedwithtoggledexperiments":
        return ld?.savedWithToggledExperiments;
      case "experimentseverused":
        return ld?.experimentsEverUsed;

      // Permissions & abilities
      case "permissionslevel":
        return ld?.permissionsLevel;
      case "playerpermissionslevel":
        return ld?.playerPermissionsLevel;
      case "attackmobs":
        return ld?.attackMobs;
      case "attackplayers":
        return ld?.attackPlayers;
      case "build":
        return ld?.build;
      case "doorsandswitches":
        return ld?.doorsAndSwitches;
      case "flying":
        return ld?.flying;
      case "instabuild":
        return ld?.instaBuild;
      case "invulnerable":
        return ld?.invulnerable;
      case "lightning":
        return ld?.lightning;
      case "mayfly":
        return ld?.mayFly;
      case "mine":
        return ld?.mine;
      case "op":
        return ld?.op;
      case "opencontainers":
        return ld?.openContainers;
      case "teleport":
        return ld?.teleport;
      case "flyspeed":
        return ld?.flySpeed;
      case "walkspeed":
        return ld?.walkSpeed;

      // Template & lock
      case "haslockedbehaviorpack":
        return ld?.hasLockedBehaviorPack;
      case "haslockedresourcepack":
        return ld?.hasLockedResourcePack;
      case "isfromlockedtemplate":
        return ld?.isFromLockedTemplate;
      case "isfromworldtemplate":
        return ld?.isFromWorldTemplate;
      case "issingleuseworld":
        return ld?.isSingleUseWorld;
      case "isworldtemplateoptionlocked":
        return ld?.isWorldTemplateOptionLocked;
      case "confirmedplatformlockedcontent":
        return ld?.confirmedPlatformLockedContent;
      case "requirescopiedpackremovalcheck":
        return ld?.requiresCopiedPackRemovalCheck;

      // Misc
      case "israndomseedallowed":
        return ld?.isRandomSeedAllowed;
      case "biomeoverride":
        return ld?.biomeOverride;
      case "centermapstoorigin":
        return ld?.centerMapsToOrigin;
      case "hasbeenloadedincreative":
        return ld?.hasBeenLoadedInCreative;
      case "spawnv1villagers":
        return ld?.spawnV1Villagers;
      case "educationfeaturesenabled":
        return ld?.educationFeaturesEnabled;
      case "daylightcycle":
        return ld?.daylightCycle;
      case "lightningtime":
        return ld?.lightningTime;
      case "lightninglevel":
        return ld?.lightningLevel;
      case "rainlevel":
        return ld?.rainLevel;
      case "raintime":
        return ld?.rainTime;

      default:
        return undefined;
    }
  }

  getBaseValue(): any {
    throw new Error("Method not implemented.");
  }

  setBaseValue(value: any): void {
    throw new Error("Method not implemented.");
  }

  public setProperty(id: string, newVal: any): any {
    if (this.levelData === undefined) {
      this.levelData = new WorldLevelDat();
    }

    const ld = this.levelData;

    switch (id.toLowerCase()) {
      // World identity
      case "levelname":
        ld.levelName = newVal as string;
        break;
      case "gametype":
        ld.gameType = newVal as number;
        break;
      case "difficulty":
        ld.difficulty = newVal as number;
        break;
      case "generator":
        ld.generator = newVal as number;
        break;
      case "randomseed":
        ld.randomSeed = newVal as string;
        break;
      case "basegameversion":
        ld.baseGameVersion = newVal as string;
        break;
      case "inventoryversion":
        ld.inventoryVersion = newVal as string;
        break;

      // Spawn & bounds
      case "spawnx":
        this.spawnX = newVal as number;
        break;
      case "spawny":
        this.spawnY = newVal as number;
        break;
      case "spawnz":
        this.spawnZ = newVal as number;
        break;
      case "limitedworldoriginx":
        ld.limitedWorldOriginX = newVal as number;
        break;
      case "limitedworldoriginy":
        ld.limitedWorldOriginY = newVal as number;
        break;
      case "limitedworldoriginz":
        ld.limitedWorldOriginZ = newVal as number;
        break;
      case "limitedworlddepth":
        ld.limitedWorldDepth = newVal as number;
        break;
      case "limitedworldwidth":
        ld.limitedWorldWidth = newVal as number;
        break;
      case "spawnradius":
        ld.spawnRadius = newVal as number;
        break;

      // Game rules (boolean)
      case "commandsenabled":
        ld.commandsEnabled = newVal as boolean;
        break;
      case "commandblocksenabled":
        ld.commandBlocksEnabled = newVal as boolean;
        break;
      case "commandblockoutput":
        ld.commandBlockOutput = newVal as boolean;
        break;
      case "cheatsenabled":
        ld.cheatsEnabled = newVal as boolean;
        break;
      case "dodaylightcycle":
        ld.doDaylightCycle = newVal as boolean;
        break;
      case "doentitydrops":
        ld.doEntityDrops = newVal as boolean;
        break;
      case "dofiretick":
        ld.doFireTick = newVal as boolean;
        break;
      case "doimmediaterespawn":
        ld.doImmediateRespawn = newVal as boolean;
        break;
      case "doinsomnia":
        ld.doInsomnia = newVal as boolean;
        break;
      case "domobloot":
        ld.doMobLoot = newVal as boolean;
        break;
      case "domobspawning":
        ld.doMobSpawning = newVal as boolean;
        break;
      case "dotiledrops":
        ld.doTileDrops = newVal as boolean;
        break;
      case "doweathercycle":
        ld.doWeatherCycle = newVal as boolean;
        break;
      case "drowningdamage":
        ld.drowningDamage = newVal as boolean;
        break;
      case "falldamage":
        ld.fallDamage = newVal as boolean;
        break;
      case "firedamage":
        ld.fireDamage = newVal as boolean;
        break;
      case "freezedamage":
        ld.freezeDamage = newVal as boolean;
        break;
      case "keepinventory":
        ld.keepInventory = newVal as boolean;
        break;
      case "mobgriefing":
        ld.mobGriefing = newVal as boolean;
        break;
      case "naturalregeneration":
        ld.naturalRegeneration = newVal as boolean;
        break;
      case "pvp":
        ld.pvp = newVal as boolean;
        break;
      case "respawnblocksexplode":
        ld.respawnBlocksExplode = newVal as boolean;
        break;
      case "sendcommandfeedback":
        ld.sendCommandFeedback = newVal as boolean;
        break;
      case "showcoordinates":
        ld.showCoordinates = newVal as boolean;
        break;
      case "showdeathmessages":
        ld.showDeathMessages = newVal as boolean;
        break;
      case "showtags":
        ld.showTags = newVal as boolean;
        break;
      case "showbordereffect":
        ld.showBorderEffect = newVal as boolean;
        break;
      case "tntexplodes":
        ld.tntExplodes = newVal as boolean;
        break;
      case "forcegametype":
        ld.forceGameType = newVal as boolean;
        break;
      case "immutableworld":
        ld.immutableWorld = newVal as boolean;
        break;
      case "spawnmobs":
        ld.spawnMobs = newVal as boolean;
        break;
      case "bonuschestenabled":
        ld.bonusChestEnabled = newVal as boolean;
        break;
      case "bonuschestspawned":
        ld.bonusChestSpawned = newVal as boolean;
        break;
      case "startwithmapenabled":
        ld.startWithMapEnabled = newVal as boolean;
        break;

      // Game rules (numeric)
      case "randomtickspeed":
        ld.randomTickSpeed = newVal as number;
        break;
      case "functioncommandlimit":
        ld.functionCommandLimit = newVal as number;
        break;
      case "maxcommandchainlength":
        ld.maxCommandChainLength = newVal as number;
        break;
      case "serverchunktickrange":
        ld.serverChunkTickRange = newVal as number;
        break;
      case "netherscale":
        ld.netherScale = newVal as number;
        break;

      // Multiplayer
      case "multiplayergame":
        ld.multiplayerGame = newVal as boolean;
        break;
      case "multiplayergameintent":
        ld.multiplayerGameIntent = newVal as boolean;
        break;
      case "lanbroadcast":
        ld.lanBroadcast = newVal as boolean;
        break;
      case "lanbroadcastintent":
        ld.lanBroadcastIntent = newVal as boolean;
        break;
      case "platformbroadcastintent":
        ld.platformBroadcastIntent = newVal as number;
        break;
      case "xblbroadcastintent":
        ld.xblBroadcastIntent = newVal as number;
        break;
      case "usemsagamertagsonly":
        ld.useMsaGamertagsOnly = newVal as boolean;
        break;
      case "texturepacksrequired":
        ld.texturePacksRequired = newVal as boolean;
        break;

      // Editor
      case "iscreatedineditor":
        ld.isCreatedInEditor = newVal as boolean;
        break;
      case "isexportedfromeditor":
        ld.isExportedFromEditor = newVal as boolean;
        break;
      case "editorworldtype":
        ld.editorWorldType = newVal as number;
        break;

      // Experiments
      case "experimentalgameplay":
        ld.experimentalGameplay = newVal as boolean;
        break;
      case "betaapisexperiment":
        ld.betaApisExperiment = newVal as boolean;
        break;
      case "deferredtechnicalpreviewexperiment":
        ld.deferredTechnicalPreviewExperiment = newVal as boolean;
        break;
      case "datadrivenitemsexperiment":
        ld.dataDrivenItemsExperiment = newVal as boolean;
        break;
      case "savedwithtoggledexperiments":
        ld.savedWithToggledExperiments = newVal as boolean;
        break;
      case "experimentseverused":
        ld.experimentsEverUsed = newVal as boolean;
        break;

      // Permissions & abilities
      case "permissionslevel":
        ld.permissionsLevel = newVal as number;
        break;
      case "playerpermissionslevel":
        ld.playerPermissionsLevel = newVal as number;
        break;
      case "attackmobs":
        ld.attackMobs = newVal as boolean;
        break;
      case "attackplayers":
        ld.attackPlayers = newVal as boolean;
        break;
      case "build":
        ld.build = newVal as boolean;
        break;
      case "doorsandswitches":
        ld.doorsAndSwitches = newVal as boolean;
        break;
      case "flying":
        ld.flying = newVal as boolean;
        break;
      case "instabuild":
        ld.instaBuild = newVal as boolean;
        break;
      case "invulnerable":
        ld.invulnerable = newVal as boolean;
        break;
      case "lightning":
        ld.lightning = newVal as boolean;
        break;
      case "mayfly":
        ld.mayFly = newVal as boolean;
        break;
      case "mine":
        ld.mine = newVal as boolean;
        break;
      case "op":
        ld.op = newVal as boolean;
        break;
      case "opencontainers":
        ld.openContainers = newVal as boolean;
        break;
      case "teleport":
        ld.teleport = newVal as boolean;
        break;
      case "flyspeed":
        ld.flySpeed = newVal as number;
        break;
      case "walkspeed":
        ld.walkSpeed = newVal as number;
        break;

      // Template & lock
      case "haslockedbehaviorpack":
        ld.hasLockedBehaviorPack = newVal as boolean;
        break;
      case "haslockedresourcepack":
        ld.hasLockedResourcePack = newVal as boolean;
        break;
      case "isfromlockedtemplate":
        ld.isFromLockedTemplate = newVal as boolean;
        break;
      case "isfromworldtemplate":
        ld.isFromWorldTemplate = newVal as boolean;
        break;
      case "issingleuseworld":
        ld.isSingleUseWorld = newVal as boolean;
        break;
      case "isworldtemplateoptionlocked":
        ld.isWorldTemplateOptionLocked = newVal as boolean;
        break;
      case "confirmedplatformlockedcontent":
        ld.confirmedPlatformLockedContent = newVal as boolean;
        break;
      case "requirescopiedpackremovalcheck":
        ld.requiresCopiedPackRemovalCheck = newVal as boolean;
        break;

      // Misc
      case "israndomseedallowed":
        ld.isRandomSeedAllowed = newVal as boolean;
        break;
      case "biomeoverride":
        ld.biomeOverride = newVal as string;
        break;
      case "centermapstoorigin":
        ld.centerMapsToOrigin = newVal as boolean;
        break;
      case "hasbeenloadedincreative":
        ld.hasBeenLoadedInCreative = newVal as boolean;
        break;
      case "spawnv1villagers":
        ld.spawnV1Villagers = newVal as boolean;
        break;
      case "educationfeaturesenabled":
        ld.educationFeaturesEnabled = newVal as boolean;
        break;
      case "daylightcycle":
        ld.daylightCycle = newVal as number;
        break;
      case "lightningtime":
        ld.lightningTime = newVal as number;
        break;
      case "lightninglevel":
        ld.lightningLevel = newVal as number;
        break;
      case "rainlevel":
        ld.rainLevel = newVal as number;
        break;
      case "raintime":
        ld.rainTime = newVal as number;
        break;
    }

    this._onPropertyChanged.dispatch(this, id);
  }

  async loadMetaFiles(force?: boolean) {
    if ((this._isLoaded && !force) || (this._file === undefined && this._folder === undefined)) {
      return;
    }

    if (this._file) {
      if (!this._file.isContentLoaded) {
        await this._file.loadContent();
      }

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

  public ensureBehaviorPack(packId: string, version: number[], packName: string, packPriority?: number) {
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
        priority: packPriority,
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

  static sortPackRegByPriority(a: IPackRegistration, b: IPackRegistration) {
    return (a.priority === undefined ? 32767 : a.priority) - (b.priority === undefined ? 32767 : b.priority);
  }

  static sortPackCollectionByPriority(packRefs: IPackRegistration[]) {
    MCWorld.freezePackRegistrationOrder(packRefs);

    return packRefs.sort(MCWorld.sortPackRegByPriority);
  }

  static freezePackRegistrationOrder(packRefs: IPackRegistration[]) {
    for (let i = 0; i < packRefs.length; i++) {
      if (packRefs[i].priority === undefined) {
        packRefs[i].priority = i * 100;
      }
    }
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

    let packRefColl = MCWorld.freezeAndStripPriorities(this.worldBehaviorPacks);

    packsFile.setContent(JSON.stringify(packRefColl, null, 2));

    packsFile.saveContent();
  }

  static freezeAndStripPriorities(coll: IPackRegistration[]) {
    let returnColl: IPackRegistration[] = [];

    const collSort = MCWorld.sortPackCollectionByPriority(coll);

    for (let i = 0; i < collSort.length; i++) {
      returnColl.push({
        pack_id: collSort[i].pack_id,
        version: collSort[i].version,
      });
    }

    return returnColl;
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

  public ensureResourcePack(packId: string, version: number[], packName: string, packPriority?: number) {
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
        priority: packPriority,
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
      await rootFolder.deleteFileFromRelativePath(RESOURCE_PACKS_RELPATH);
      return;
    }

    const packsFile = await rootFolder.ensureFileFromRelativePath(RESOURCE_PACKS_RELPATH);

    let packRefColl = MCWorld.freezeAndStripPriorities(this.worldResourcePacks);

    packsFile.setContent(JSON.stringify(packRefColl, null, 2));

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

        this._file.fileContainerStorage.containerFile = this._file;
        this._file.fileContainerStorage.storagePath = this._file.extendedPath + "#";
      }

      storage = this._file.fileContainerStorage as ZipStorage;
    } else {
      this._zipStorage = new ZipStorage();
      storage = this._zipStorage;
    }

    await storage.loadFromUint8Array(content, this._file?.name);

    const rootFolder = storage.rootFolder;

    await this.loadFromFolder(rootFolder);
  }

  async applyWorldSettings(worldSettings?: IWorldSettings) {
    if (!this._isLoaded) {
      await this.loadMetaFiles(false);
    }

    this.ensureLevelData();

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
      if (!this.file?.isContentLoaded) {
        await rootDataFile.loadContent();
      }

      if (rootDataFile.content !== undefined && rootDataFile.content instanceof Uint8Array) {
        this.levelData = new WorldLevelDat();

        this.levelData.loadFromNbtBytes(rootDataFile.content);

        Utilities.appendErrors(this, this.levelData);

        this._loadFromNbt();
      }
    }

    const levelNameTextFile = await rootFolder.getFileFromRelativePath(LEVELNAMETXT_RELPATH);

    if (levelNameTextFile !== undefined) {
      if (!levelNameTextFile.isContentLoaded) {
        await levelNameTextFile.loadContent();
      }

      if (levelNameTextFile.content !== undefined && typeof levelNameTextFile.content === "string") {
        this.name = levelNameTextFile.content;
      }
    }

    const manifestJsonFile = await rootFolder.getFileFromRelativePath(MANIFEST_RELPATH);

    if (manifestJsonFile !== undefined) {
      if (!manifestJsonFile.isContentLoaded) {
        await manifestJsonFile.loadContent();
      }

      if (manifestJsonFile.content !== undefined && typeof manifestJsonFile.content === "string") {
        this._manifest = StorageUtilities.getJsonObject(manifestJsonFile);
      }
    }

    let packsFile = await rootFolder.getFileFromRelativePath(BEHAVIOR_PACKS_RELPATH);

    if (packsFile !== undefined) {
      if (!packsFile.isContentLoaded) {
        await packsFile.loadContent();
      }

      if (packsFile.content !== undefined && typeof packsFile.content === "string") {
        try {
          this.worldBehaviorPacks = StorageUtilities.getJsonObject(packsFile);
        } catch {
          this._pushError("Could not parse behavior pack file content");
          this.worldBehaviorPacks = undefined;
        }
      }
    }

    packsFile = await rootFolder.getFileFromRelativePath(RESOURCE_PACKS_RELPATH);

    if (packsFile !== undefined) {
      if (!packsFile.isContentLoaded) {
        await packsFile.loadContent();
      }

      if (packsFile.content !== undefined && typeof packsFile.content === "string") {
        try {
          this.worldResourcePacks = StorageUtilities.getJsonObject(packsFile);
        } catch {
          this._pushError("Could not parse resource pack file content." + packsFile.fullPath);
          this.worldResourcePacks = undefined;
        }
      }
    }

    let packHistoryFile = await rootFolder.getFileFromRelativePath(BEHAVIOR_PACK_HISTORY_RELPATH);

    if (packHistoryFile !== undefined) {
      if (!packHistoryFile.isContentLoaded) {
        await packHistoryFile.loadContent();
      }

      if (packHistoryFile.content !== undefined && typeof packHistoryFile.content === "string") {
        try {
          this.worldBehaviorPackHistory = StorageUtilities.getJsonObject(packHistoryFile);
        } catch {
          this._pushError("Could not parse behavior pack history file content");
          this.worldBehaviorPackHistory = undefined;
        }
      }
    }

    packHistoryFile = await rootFolder.getFileFromRelativePath(RESOURCE_PACK_HISTORY_RELPATH);

    if (packHistoryFile !== undefined) {
      if (!packHistoryFile.isContentLoaded) {
        await packHistoryFile.loadContent();
      }

      if (packHistoryFile.content !== undefined && typeof packHistoryFile.content === "string") {
        try {
          this.worldResourcePackHistory = StorageUtilities.getJsonObject(packHistoryFile);
        } catch {
          this._pushError("Could not parse resource pack history file content: " + packHistoryFile.fullPath);
          this.worldResourcePackHistory = undefined;
        }
      }
    }

    const imageFile = await rootFolder.getFileFromRelativePath("/world_icon.jpeg");

    if (imageFile !== undefined) {
      if (!imageFile.isContentLoaded) {
        await imageFile.loadContent();
      }

      if (imageFile.content instanceof Uint8Array) {
        this.imageBase64 = Utilities.uint8ArrayToBase64(imageFile.content);
      }
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }

  async loadLevelDb(force: boolean = false, options?: IWorldProcessingOptions): Promise<boolean> {
    if (!force && this._isDataLoaded) {
      return true;
    }

    const useLazyLoad = options?.lazyLoad === true;
    this._isLazyLoadMode = useLazyLoad;

    // Initialize chunk cache if requested
    if (options?.maxChunksInCache !== undefined || useLazyLoad) {
      this._chunkCache = new WorldChunkCache(options?.maxChunksInCache ?? 20000);
      this._chunkCache.setChunkProvider((key) => this.getChunkByKey(key));
    }

    const loadOper = await this._project?.creatorTools.notifyOperationStarted(
      "Starting first-pass load of '" + this.name + "' world",
      StatusTopic.worldLoad
    );

    const rootFolder = this.effectiveRootFolder;

    if (!rootFolder) {
      return false;
    }

    await rootFolder.load(force);

    const dbFolder = await rootFolder.getFolderFromRelativePath("/db");

    const ldbFileArr: IFile[] = [];
    const logFileArr: IFile[] = [];
    const manifestFileArr: IFile[] = [];

    if (dbFolder) {
      await dbFolder.load(force);

      for (const fileName in dbFolder.files) {
        const file = dbFolder.files[fileName];

        if (file) {
          const extension = StorageUtilities.getTypeFromName(file.name);

          if (fileName.startsWith("MANIFEST")) {
            manifestFileArr.push(file);
          } else if (extension === "ldb") {
            // console.log("Adding map file " + file.name + "|" + ldbFileArr.length);
            ldbFileArr.push(file);
          } else if (extension === "log") {
            // console.log("Adding map file " + file.name);
            logFileArr.push(file);
          }
        }
      }
      Log.verbose(
        "[MCWorld] loadLevelDb: Found " +
          ldbFileArr.length +
          " LDB files, " +
          logFileArr.length +
          " LOG files, " +
          manifestFileArr.length +
          " MANIFEST files"
      );
    } else {
      Log.verbose("[MCWorld] loadLevelDb: No db folder found");
    }

    this.levelDb = new LevelDb(ldbFileArr, logFileArr, manifestFileArr, this.name);

    if (useLazyLoad) {
      // Lazy loading mode: only load manifest initially
      await this._project?.creatorTools.notifyStatusUpdate(
        `Initializing lazy loading for '${this.name}'...`,
        StatusTopic.worldLoad
      );

      await this.levelDb.initLazy({
        maxKeysInMemory: 50000,
        progressCallback: options?.progressCallback,
      });

      // Now load all files but with memory management
      const totalFiles = this.levelDb.index?.totalFiles ?? 0;
      let loadedFiles = 0;

      await this.levelDb.loadAllFiles({
        progressCallback: (phase, current, total) => {
          loadedFiles = current;
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          this._project?.creatorTools.notifyStatusUpdate(`${phase}... (${percent}%)`, StatusTopic.worldLoad);
          if (options?.progressCallback) {
            options.progressCallback(phase, current, total);
          }
        },
        unloadFilesAfterParse: true, // Always unload in lazy mode
      });
    } else {
      // Traditional full-load mode
      const totalLdbFiles = ldbFileArr.length + logFileArr.length + manifestFileArr.length;
      let loadedLdbFiles = 0;

      await this.levelDb.init(
        async (message: string): Promise<void> => {
          loadedLdbFiles++;
          const percent = totalLdbFiles > 0 ? Math.round((loadedLdbFiles / totalLdbFiles) * 100) : 0;
          await this._project?.creatorTools.notifyStatusUpdate(
            `Loading world files (1/2)... (${percent}%)`,
            StatusTopic.worldLoad
          );
          if (options?.progressCallback) {
            options.progressCallback("Loading world files (1/2)", loadedLdbFiles, totalLdbFiles);
          }
        },
        { unloadFilesAfterParse: options?.unloadFilesAfterParse !== false }
      );
    }

    Utilities.appendErrors(this, this.levelDb);

    if (loadOper !== undefined) {
      await this._project?.creatorTools.notifyOperationEnded(
        loadOper,
        "Completed first-pass load of '" + this.name + "' world",
        StatusTopic.worldLoad
      );
    }

    return await this.loadFromLevelDb(this.levelDb, options);
  }

  async loadFromLevelDb(levelDb: LevelDb, options?: IWorldProcessingOptions): Promise<boolean> {
    this.levelDb = levelDb;

    // If skipFullProcessing is enabled, only build a minimal index
    // Chunks will be created on-demand when accessed
    if (options?.skipFullProcessing) {
      const result = await this.buildMinimalWorldIndex(options);
      if (!result) {
        return false;
      }
    } else {
      const result = await this.processWorldData(options);
      if (!result) {
        return false;
      }
    }

    this._updateMeta();

    this._onDataLoaded.dispatch(this, this);

    this._isDataLoaded = true;
    return true;
  }

  /**
   * Builds a minimal world index without creating WorldChunk objects.
   * This calculates world bounds and chunk count from key names only.
   * Chunks are created on-demand when getChunkAt() or getOrCreateChunk() is called.
   *
   * This dramatically reduces memory usage for large worlds (100k+ chunks).
   *
   * IMPORTANT: Key filtering must use the same approach as processWorldData():
   * explicit named-key prefix checks + keyname.length checks. Do NOT filter by
   * checking if the first byte of keyBytes is in printable ASCII range, because
   * chunk coordinate keys are binary little-endian integers whose low byte can
   * legitimately be any value 0-255 (e.g., chunk X=32 → first byte 0x20 = space).
   */
  private async buildMinimalWorldIndex(options?: IWorldProcessingOptions): Promise<boolean> {
    if (!this.levelDb) {
      return false;
    }

    this.chunks = new Map();
    this.chunkCount = 0;
    this._dimensionIdsInChunks = new Set();
    this._dimensionNameIdTable = undefined;
    this._hasDimensionNameIdTable = false;

    const processOper = await this._project?.creatorTools.notifyOperationStarted(
      "Building minimal index for '" + this.name + "' world",
      StatusTopic.worldLoad
    );

    const levelDbKeysArray = Array.from(this.levelDb.keys.keys());
    const totalKeys = levelDbKeysArray.length;
    let processedKeys = 0;

    // Track unique chunks we've seen (format: "dim_x_z")
    const seenChunks = new Set<string>();

    // Build index mapping chunk keys to their LevelDB key names for fast lookup
    const chunkKeyIndex = new Map<string, string[]>();

    // Report progress less frequently for this fast operation
    const keyProgressInterval = Math.max(1000, Math.floor(totalKeys / 50));

    // Yield periodically to allow garbage collection
    const yieldInterval = 5000;

    for (const keyname of levelDbKeysArray) {
      processedKeys++;

      // Report progress
      if (processedKeys % keyProgressInterval === 0) {
        const percent = totalKeys > 0 ? Math.round((processedKeys / totalKeys) * 100) : 0;
        await this._project?.creatorTools.notifyStatusUpdate(
          `Building world index... (${percent}%)`,
          StatusTopic.worldLoad
        );
        if (options?.progressCallback) {
          options.progressCallback("Building world index", processedKeys, totalKeys);
        }

        // Yield periodically
        if (processedKeys % yieldInterval === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Handle DimensionNameIdTable before skipping named keys
      if (keyname === "DimensionNameIdTable") {
        const keyValue = this.levelDb.keys.get(keyname);

        if (keyValue && typeof keyValue !== "boolean" && keyValue.value) {
          this._parseDimensionNameIdTable(keyValue.value);
        } else {
          this._hasDimensionNameIdTable = true;
        }
        continue;
      }

      // Skip known named keys using the same filtering approach as processWorldData.
      // We must NOT filter by first-byte ASCII range because chunk coordinate keys
      // are binary little-endian integers whose low byte can be any value (0-255),
      // including printable ASCII (32-126). For example, chunk X=32 has first byte 0x20 (space).
      if (
        keyname.startsWith("AutonomousEntities") ||
        keyname.startsWith("schedulerWT") ||
        keyname.startsWith("Overworld") ||
        keyname.startsWith("BiomeData") ||
        keyname.startsWith("digp") ||
        keyname.startsWith("actorprefix") ||
        keyname.startsWith("player") ||
        keyname.startsWith("portals") ||
        keyname.startsWith("LevelChunk") ||
        keyname.startsWith("structuretemplate") ||
        keyname.startsWith("~local_player") ||
        keyname.startsWith("game_") ||
        keyname.startsWith("CustomProperties") ||
        keyname.startsWith("DynamicProperties") ||
        keyname.startsWith("LevelSpawnWasFixed") ||
        keyname.startsWith("VILLAGE_") ||
        keyname.startsWith("gametestinstance_") ||
        keyname.startsWith("tickingarea_") ||
        keyname.startsWith("map_") ||
        keyname.startsWith("scoreboard") ||
        keyname.startsWith("SavedEntity") ||
        keyname.startsWith("ServerMapRuntime") ||
        keyname.startsWith("VillageRuntime") ||
        keyname.startsWith("WorldFeatureRuntime") ||
        keyname.startsWith("WorldGenerationRuntime") ||
        keyname.startsWith("WorldStreamRuntime") ||
        keyname.startsWith("BSharpRuntime") ||
        keyname.startsWith("BadgerSynced") ||
        keyname.startsWith("CinematicsRuntime") ||
        keyname.startsWith("CustomGameOptions") ||
        keyname.startsWith("DeckRuntime") ||
        keyname.startsWith("EntityFactorySetup") ||
        keyname.startsWith("GeologyRuntime") ||
        keyname.startsWith("InvasionRuntime") ||
        keyname.startsWith("MapRevealRuntime") ||
        keyname.startsWith("RealmsStoriesData") ||
        keyname.startsWith("mobevents") ||
        keyname.startsWith("dimension") ||
        keyname.startsWith("structureplacement") ||
        keyname.startsWith("chunk_loaded_request") ||
        keyname.startsWith("legacy_console_player") ||
        keyname.startsWith("PosTrackDB") ||
        keyname.startsWith("PositionTrackDB") ||
        keyname.startsWith("OwnedEntitiesLimbo") ||
        keyname.startsWith("MCeditMap") ||
        keyname.startsWith("EDU_CurrentCodingURL") ||
        keyname.startsWith("TheEnd") ||
        keyname.startsWith("SST_") ||
        keyname.startsWith("SUSP") ||
        keyname.startsWith("neteaseData") ||
        keyname.startsWith("scriptGid") ||
        keyname.startsWith("Nether") ||
        keyname.startsWith("game_flatworldlayers")
      ) {
        continue;
      }

      // Only process keys whose length matches chunk coordinate key formats.
      // Chunk keys are 9, 10, 13, or 14 bytes:
      //   [x:4][z:4][tag:1] = 9 bytes (overworld)
      //   [x:4][z:4][tag:1][subchunk:1] = 10 bytes (overworld with subchunk)
      //   [x:4][z:4][dim:4][tag:1] = 13 bytes (nether/end)
      //   [x:4][z:4][dim:4][tag:1][subchunk:1] = 14 bytes (nether/end with subchunk)
      // Use keyname.length as a fast pre-filter (matching processWorldData's approach).
      if (keyname.length !== 9 && keyname.length !== 10 && keyname.length !== 13 && keyname.length !== 14) {
        continue;
      }

      // Get the LevelKeyValue to access raw keyBytes
      const keyValue = this.levelDb.keys.get(keyname);
      if (!keyValue) {
        continue;
      }

      // keyValue can be boolean (false for deleted markers)
      if (typeof keyValue === "boolean") {
        continue;
      }

      const keyBytes = keyValue.keyBytes;
      if (!keyBytes) {
        continue;
      }

      // Key format: [x:4 bytes][z:4 bytes][dim?:4 bytes][tag:1 byte][subchunk?:1 byte]
      if (keyBytes.length >= 9 && keyBytes.length <= 14) {
        const hasDimensionParam = keyBytes.length >= 13;

        const x = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
        const z = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);
        let dim = 0;

        if (hasDimensionParam) {
          dim = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

          // Track all dimension IDs, including custom dimensions (>= 1000)
          this._dimensionIdsInChunks.add(dim);

          if (dim < 0 || dim > 2) {
            continue; // Skip custom/invalid dimensions from chunk index
          }
        } else {
          // 9/10-byte keys are overworld (dim 0)
          this._dimensionIdsInChunks.add(0);
        }

        // Track unique chunks
        const chunkKey = `${dim}_${x}_${z}`;
        if (!seenChunks.has(chunkKey)) {
          seenChunks.add(chunkKey);
          this.chunkCount++;

          // Update bounds
          if (this._minX === undefined || x * 16 < this._minX) {
            this._minX = x * 16;
          }
          if (this._maxX === undefined || (x + 1) * 16 > this._maxX) {
            this._maxX = (x + 1) * 16;
          }
          if (this._minZ === undefined || z * 16 < this._minZ) {
            this._minZ = z * 16;
          }
          if (this._maxZ === undefined || (z + 1) * 16 > this._maxZ) {
            this._maxZ = (z + 1) * 16;
          }
        }

        // Build chunk key index: map chunk key to list of LevelDB key names
        let keyList = chunkKeyIndex.get(chunkKey);
        if (!keyList) {
          keyList = [];
          chunkKeyIndex.set(chunkKey, keyList);
        }
        keyList.push(keyname);
      }
    }

    // Store the seen chunks set for O(1) existence checking
    this._chunkExistsSet = seenChunks;

    // Store the chunk key index for O(1) key lookup in getOrCreateChunk
    this._chunkKeyIndex = chunkKeyIndex;

    await this.notifyLoadEnded(processOper);

    return true;
  }

  /**
   * Gets or creates a chunk at the specified coordinates.
   * If the chunk doesn't exist, creates it and populates it from LevelDB keys.
   * This is used for on-demand chunk loading when skipFullProcessing is enabled.
   */
  getOrCreateChunk(dim: number, x: number, z: number): WorldChunk | undefined {
    // Check if chunk already exists
    let dimMap = this.chunks.get(dim);
    if (dimMap) {
      const xPlane = dimMap.get(x);
      if (xPlane) {
        const existing = xPlane.get(z);
        if (existing) {
          // Track access for LRU cache
          if (this._chunkCache) {
            this._chunkCache.access(dim, x, z);
          }
          return existing;
        }
      }
    }

    // Chunk doesn't exist - create it on demand if we have LevelDB data
    if (!this.levelDb) {
      return undefined;
    }

    // Create the chunk
    const chunk = new WorldChunk(this, x, z);

    // Find all keys that belong to this chunk using the pre-built index (O(1) lookup)
    const chunkKey = `${dim}_${x}_${z}`;
    const indexedKeyNames = this._chunkKeyIndex.get(chunkKey);

    if (indexedKeyNames && indexedKeyNames.length > 0) {
      // Fast path: use the pre-built chunk key index
      for (const keyname of indexedKeyNames) {
        const keyValue = this.levelDb.keys.get(keyname);
        if (!keyValue || typeof keyValue === "boolean") continue;
        chunk.addKeyValue(keyValue);
      }
    } else if (this._chunkKeyIndex.size > 0) {
      // Index is built but this chunk has no keys — it doesn't exist in the world.
      // Return undefined to avoid creating empty chunk objects.
      return undefined;
    } else {
      // Fallback: scan all LevelDB keys (used when index isn't built, e.g., full processing mode)
      const hasDim = dim !== 0;
      for (const [keyname, keyValue] of this.levelDb.keys) {
        if (!keyValue) continue;

        const keyBytes = keyValue.keyBytes;
        if (!keyBytes) continue;
        if (keyBytes.length < 9 || keyBytes.length > 14) continue;

        const expectedLength = hasDim ? 13 : 9;
        if (keyBytes.length !== expectedLength && keyBytes.length !== expectedLength + 1) continue;

        const kx = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
        const kz = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);

        if (kx !== x || kz !== z) continue;

        let kDim = 0;
        if (hasDim && keyBytes.length >= 13) {
          kDim = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);
        }

        if (kDim !== dim) continue;

        // This key belongs to this chunk
        chunk.addKeyValue(keyValue);
      }
    }

    // Add chunk to the chunks map
    if (!dimMap) {
      dimMap = new Map();
      this.chunks.set(dim, dimMap);
    }

    let xPlane = dimMap.get(x);
    if (!xPlane) {
      xPlane = new Map();
      dimMap.set(x, xPlane);
    }

    xPlane.set(z, chunk);

    // Track access for LRU cache
    if (this._chunkCache) {
      this._chunkCache.access(dim, x, z);
    }

    return chunk;
  }

  /**
   * Iterates over all chunks in a memory-efficient manner, calling the processor function
   * for each chunk and optionally clearing chunk data after processing.
   *
   * @param processor - Async function to process each chunk. Receives the chunk and its coordinates.
   * @param options - Optional configuration for iteration behavior.
   * @param options.clearCacheAfterProcess - If true, clears parsed/cached data after processing but preserves
   *                                          raw LevelKeyValue data, allowing chunks to be re-parsed on demand.
   *                                          This is the recommended option for memory optimization.
   * @param options.clearAllAfterProcess - If true, aggressively clears ALL chunk data including raw bytes.
   *                                        WARNING: Chunks cannot be re-parsed after this. Only use when
   *                                        the world data will never be accessed again.
   * @param options.dimensionFilter - If specified, only iterate chunks in this dimension (0=overworld, 1=nether, 2=end).
   * @param options.progressCallback - Optional callback for progress updates during iteration.
   */
  async forEachChunk(
    processor: (chunk: WorldChunk, x: number, z: number, dimension: number) => Promise<void>,
    options?: {
      clearCacheAfterProcess?: boolean;
      clearAllAfterProcess?: boolean;
      dimensionFilter?: number;
      progressCallback?: (processed: number, total: number) => Promise<void>;
    }
  ): Promise<void> {
    // Handle legacy option name
    const clearCacheAfterProcess = options?.clearCacheAfterProcess ?? false;
    const clearAllAfterProcess = options?.clearAllAfterProcess ?? false;
    const dimensionFilter = options?.dimensionFilter;
    let processedCount = 0;

    const chunkKeys = this.chunks.keys();

    for (const dimIndex of chunkKeys) {
      if (dimensionFilter !== undefined && dimIndex !== dimensionFilter) {
        continue;
      }

      const dim = this.chunks.get(dimIndex);
      if (!dim) {
        continue;
      }

      const xKeys = dim.keys();
      for (const chunkSliverIndex of xKeys) {
        const chunkSliver = dim.get(chunkSliverIndex);
        if (!chunkSliver) {
          continue;
        }

        const zKeys = chunkSliver.keys();
        for (const chunkZ of zKeys) {
          const chunk = chunkSliver.get(chunkZ);
          if (!chunk) {
            continue;
          }

          await processor(chunk, chunkSliverIndex, chunkZ, dimIndex);
          processedCount++;

          // Clear data after processing based on options
          if (clearAllAfterProcess) {
            chunk.clearAllData();
          } else if (clearCacheAfterProcess) {
            chunk.clearCachedData();
          }

          // Report progress frequently enough for smooth UI updates (~100 updates total)
          // Use dynamic interval based on total chunk count
          const progressInterval = Math.max(100, Math.floor(this.chunkCount / 100));
          if (options?.progressCallback && processedCount % progressInterval === 0) {
            await options.progressCallback(processedCount, this.chunkCount);
          }
        }
      }
    }
  }

  /**
   * Clears parsed/cached data from all chunks to free memory while preserving the ability
   * to re-parse chunks on demand. This is the recommended approach for memory optimization
   * when you may need to access chunk data again (e.g., for map rendering).
   */
  clearAllChunkCaches() {
    const chunkKeys = this.chunks.keys();

    for (const dimIndex of chunkKeys) {
      const dim = this.chunks.get(dimIndex);
      if (!dim) {
        continue;
      }

      const xKeys = dim.keys();
      for (const x of xKeys) {
        const xPlane = dim.get(x);
        if (!xPlane) {
          continue;
        }

        const zKeys = xPlane.keys();
        for (const z of zKeys) {
          const chunk = xPlane.get(z);
          if (chunk) {
            chunk.clearCachedData();
          }
        }
      }
    }
  }

  /**
   * Clears the raw LevelDB data to free memory after world data has been processed.
   * This can significantly reduce memory usage for large worlds.
   * WARNING: After calling this, the world cannot be re-loaded from the LevelDb.
   */
  clearLevelDbData() {
    if (this.levelDb) {
      this.levelDb.keys.clear();
    }
  }

  /**
   * Clears all world data to free memory.
   * Use this when the world is no longer needed.
   * WARNING: The world cannot be used after calling this without reloading.
   */
  clearAllData() {
    // Clear chunk cache first
    if (this._chunkCache) {
      this._chunkCache.clear();
    }

    // Clear all chunk data
    for (const dimIndex of this.chunks.keys()) {
      const dim = this.chunks.get(dimIndex);
      if (!dim) continue;

      for (const x of dim.keys()) {
        const xPlane = dim.get(x);
        if (!xPlane) continue;

        for (const z of xPlane.keys()) {
          const chunk = xPlane.get(z);
          if (chunk) {
            chunk.clearAllData();
          }
        }
        xPlane.clear();
      }
      dim.clear();
    }
    this.chunks.clear();

    // Clear LevelDB data
    this.clearLevelDbData();

    // Clear actors
    this.actorsById = {};

    // Reset state
    this._isDataLoaded = false;
    this.chunkCount = 0;
    this._minX = undefined;
    this._maxX = undefined;
    this._minZ = undefined;
    this._maxZ = undefined;
  }

  /**
   * Get statistics about memory usage for this world.
   * Useful for debugging memory issues with large worlds.
   */
  getMemoryStats(): {
    chunkCount: number;
    levelDbKeyCount: number;
    isLazyMode: boolean;
    chunkCacheSize?: number;
    chunkCacheMaxSize?: number;
  } {
    return {
      chunkCount: this.chunkCount,
      levelDbKeyCount: this.levelDb?.keys.size ?? 0,
      isLazyMode: this._isLazyLoadMode,
      chunkCacheSize: this._chunkCache?.size,
      chunkCacheMaxSize: this._chunkCache?.maxChunks,
    };
  }

  /**
   * Clears all chunk data to free memory.
   * WARNING: After calling this, chunk data cannot be accessed without reloading.
   */
  clearAllChunkData() {
    const chunkKeys = this.chunks.keys();

    for (const dimIndex of chunkKeys) {
      const dim = this.chunks.get(dimIndex);
      if (!dim) {
        continue;
      }

      const xKeys = dim.keys();
      for (const x of xKeys) {
        const xPlane = dim.get(x);
        if (!xPlane) {
          continue;
        }

        const zKeys = xPlane.keys();
        for (const z of zKeys) {
          const chunk = xPlane.get(z);
          if (chunk) {
            chunk.clearAllData();
          }
        }
      }
    }
  }

  getTopBlockY(x: number, z: number, dim?: number) {
    const chunkX = Math.floor(x / CHUNK_X_SIZE);
    const chunkZ = Math.floor(z / CHUNK_Z_SIZE);
    const dimension = dim ?? 0;

    // Quick check: if the chunk index has been built and this chunk isn't in it,
    // skip creating an empty chunk object (avoids wasteful allocations on mouse hover)
    if (this.hasChunkData(dimension, chunkX, chunkZ) === false) {
      return undefined;
    }

    // Use getOrCreateChunk to support on-demand loading when skipFullProcessing is enabled
    const chunk = this.getOrCreateChunk(dimension, chunkX, chunkZ);

    if (chunk === undefined) {
      return undefined;
    }

    return chunk.getTopBlockY(x - chunkX * CHUNK_X_SIZE, z - chunkZ * CHUNK_Z_SIZE);
  }

  getTopBlock(x: number, z: number, dim?: number) {
    const chunkX = Math.floor(x / CHUNK_X_SIZE);
    const chunkZ = Math.floor(z / CHUNK_Z_SIZE);
    const dimension = dim ?? 0;

    // Quick check: if the chunk index has been built and this chunk isn't in it,
    // skip creating an empty chunk object (avoids wasteful allocations on mouse hover)
    if (this.hasChunkData(dimension, chunkX, chunkZ) === false) {
      return undefined;
    }

    // Use getOrCreateChunk to support on-demand loading when skipFullProcessing is enabled
    const chunk = this.getOrCreateChunk(dimension, chunkX, chunkZ);

    if (chunk === undefined) {
      return undefined;
    }

    return chunk.getTopBlock(x - chunkX * CHUNK_X_SIZE, z - chunkZ * CHUNK_Z_SIZE);
  }

  spawnEntity(entityTypeId: string, location: BlockLocation) {
    const e = new Entity();

    return e;
  }

  getBlock(blockLocation: BlockLocation, dim?: number) {
    const chunkX = Math.floor(blockLocation.x / CHUNK_X_SIZE);
    const chunkZ = Math.floor(blockLocation.z / CHUNK_Z_SIZE);
    const dimension = dim ?? 0;

    // Use getOrCreateChunk to support on-demand loading when skipFullProcessing is enabled
    const chunk = this.getOrCreateChunk(dimension, chunkX, chunkZ);

    if (chunk === undefined) {
      return new Block("air");
    }

    let offsetX = blockLocation.x % 16;
    let offsetZ = blockLocation.z % 16;

    if (offsetX < 0) {
      offsetX += 16;
    }

    if (offsetZ < 0) {
      offsetZ += 16;
    }

    const block = chunk.getBlock(offsetX, blockLocation.y, offsetZ);

    if (!block) {
      return new Block("air");
    }

    return block;
  }

  private async processWorldData(options?: IWorldProcessingOptions) {
    if (!this.levelDb) {
      return false;
    }

    this.chunks = new Map();
    this.chunkCount = 0;
    this._dimensionIdsInChunks = new Set();
    this._dimensionNameIdTable = undefined;
    this._hasDimensionNameIdTable = false;

    const processOper = await this._project?.creatorTools.notifyOperationStarted(
      "Starting second-pass load of '" + this.name + "' world",
      StatusTopic.worldLoad
    );

    const levelDbKeysArray = Array.from(this.levelDb.keys.keys());
    const totalKeys = levelDbKeysArray.length;
    let processedKeys = 0;

    // Whether to delete keys from LevelDb after processing to reduce memory
    // Default is true for memory optimization
    const clearKeysAfterProcess = options?.clearKeysAfterProcess !== false;

    // Report progress frequently enough for smooth UI updates (~100 updates total)
    const keyProgressInterval = Math.max(100, Math.floor(totalKeys / 100));

    // Yield periodically to allow garbage collection and prevent memory pressure
    const yieldInterval = 500;

    for (const keyname of levelDbKeysArray) {
      const keyValue = this.levelDb.keys.get(keyname);

      processedKeys++;

      // Report progress at dynamic intervals for smooth updates
      if (processedKeys % keyProgressInterval === 0) {
        const percent = totalKeys > 0 ? Math.round((processedKeys / totalKeys) * 100) : 0;
        await this._project?.creatorTools.notifyStatusUpdate(
          `Processing world records (2/2)... (${percent}%)`,
          StatusTopic.worldLoad
        );
        if (options?.progressCallback) {
          options.progressCallback("Processing world records (2/2)  ", processedKeys, totalKeys);
        }

        // Yield to event loop periodically to allow garbage collection
        if (processedKeys % yieldInterval === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (options?.maxNumberOfRecordsToProcess && processedKeys > options.maxNumberOfRecordsToProcess) {
        return false;
      }

      if (keyname.startsWith("AutonomousEntities")) {
      } else if (keyname.startsWith("schedulerWT")) {
      } else if (keyname.startsWith("Overworld") && keyValue) {
        const overworldBytes = keyValue.value;

        if (overworldBytes) {
          const overworld = new NbtBinary();

          overworld.context = this.name + " overworld";

          overworld.fromBinary(overworldBytes, true, false, 0, true);

          this._overworldData = overworld;
        }
      } else if (keyname.startsWith("BiomeData") && keyValue) {
        const biomeDataBytes = keyValue.value;

        if (biomeDataBytes) {
          const biomeData = new NbtBinary();

          biomeData.context = this.name + " biome data";

          biomeData.fromBinary(biomeDataBytes, true, false, 0, true);

          this._biomeData = biomeData;
        }
      } else if (keyname.startsWith("CustomProperties")) {
        this._hasCustomProps = true;
      } else if (keyname.startsWith("DynamicProperties") && keyValue) {
        this._hasDynamicProps = true;
        const dynamicPropertyBytes = keyValue.value;

        if (dynamicPropertyBytes) {
          const dynamicProps = new NbtBinary();

          dynamicProps.context = this.name + " dynamic props";

          dynamicProps.fromBinary(dynamicPropertyBytes, true, false, 0, true);

          if (dynamicProps.singleRoot) {
            const children = dynamicProps.singleRoot.getTagChildren();
            this._dynamicProperties = {};

            for (const child of children) {
              if (child.name && Utilities.isValidUuid(child.name)) {
                this._dynamicProperties[child.name] = {};

                const bpChildren = child.getTagChildren();

                for (const propChild of bpChildren) {
                  if (
                    propChild.name &&
                    propChild.type === NbtTagType.string &&
                    Utilities.isUsableAsObjectKey(child.name) &&
                    Utilities.isUsableAsObjectKey(propChild.name)
                  ) {
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
      } else if (keyname.startsWith("LevelChunkMetaDataDictionary") && keyValue) {
        const levelChunkMetaBytes = keyValue.value;

        if (levelChunkMetaBytes) {
          const levelChunkMeta = new NbtBinary();

          levelChunkMeta.context = this.name + " level chunk metadata";

          levelChunkMeta.fromBinary(levelChunkMetaBytes, true, false, 12, true);

          this._levelChunkMetaData = levelChunkMeta;
        }
      } else if (keyname === "DimensionNameIdTable" && keyValue) {
        if (keyValue.value) {
          this._parseDimensionNameIdTable(keyValue.value);
        } else {
          this._hasDimensionNameIdTable = true;
        }
      } else if (keyname.startsWith("structuretemplate_")) {
      } else if (keyname.startsWith("digp") && keyValue) {
        const keyBytes = keyValue.keyBytes;

        if (keyBytes) {
          const x = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);
          const z = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

          Log.assert(
            keyBytes.length === 16 ||
              keyBytes.length === 24 ||
              keyBytes.length === 20 ||
              keyBytes.length === 14 ||
              keyBytes.length === 13 ||
              keyBytes.length === 12,
            "Unexpected digp key size (" + keyBytes.length + ")"
          );

          let dim = 0;

          if (keyBytes.length >= 17) {
            dim = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

            Log.assert(dim >= 0 && dim <= 2, "Unexpected dimension index - digp (" + dim + ")");
          }

          let dimMap = this.chunks.get(dim);

          if (!dimMap) {
            dimMap = new Map();
            this.chunks.set(dim, dimMap);
          }

          let xPlane = dimMap.get(x);

          if (!xPlane) {
            xPlane = new Map();
            dimMap.set(x, xPlane);
          }

          let wc = xPlane.get(z);

          if (wc === undefined) {
            wc = new WorldChunk(this, x, z);
            this.chunkCount++;

            xPlane.set(z, wc);
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

              wc.addActorDigest(hexStr);
            } else if (keyValueBytes.length !== 0) {
              // Log.error("Unexpected actor digest length", this.name);
            }
          }
        }
      } else if (keyname.startsWith("actorprefix") && keyValue) {
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
          // Log.error("Unexpected actor prefix length - " + keyname + " (" + keyBytes?.length + ")", this.name);
        }
      } else if (keyname.startsWith("player")) {
      } else if (keyname.startsWith("portals")) {
      } else if (keyname.startsWith("LevelSpawnWasFixed")) {
      } else if (keyname.startsWith("VILLAGE_")) {
      } else if (keyname.startsWith("gametestinstance_")) {
      } else if (keyname.startsWith("tickingarea_")) {
      } else if (keyname.startsWith("map_")) {
      } else if (keyname.startsWith("scoreboard")) {
      } else if (keyname.startsWith("SavedEntity")) {
      } else if (keyname.startsWith("ServerMapRuntime")) {
      } else if (keyname.startsWith("VillageRuntime")) {
      } else if (keyname.startsWith("WorldFeatureRuntime")) {
      } else if (keyname.startsWith("WorldGenerationRuntime")) {
      } else if (keyname.startsWith("WorldStreamRuntime")) {
      } else if (keyname.startsWith("BSharpRuntime")) {
      } else if (keyname.startsWith("BadgerSynced")) {
      } else if (keyname.startsWith("CinematicsRuntime")) {
      } else if (keyname.startsWith("CustomGameOptions")) {
      } else if (keyname.startsWith("DeckRuntime")) {
      } else if (keyname.startsWith("EntityFactorySetup")) {
      } else if (keyname.startsWith("GeologyRuntime")) {
      } else if (keyname.startsWith("InvasionRuntime")) {
      } else if (keyname.startsWith("MapRevealRuntime")) {
      } else if (keyname.startsWith("~local_player")) {
      } else if (keyname.startsWith("RealmsStoriesData")) {
      } else if (keyname.startsWith("mobevents")) {
      } else if (keyname.startsWith("game_flatworldlayers")) {
      } else if (keyname.startsWith("dimension")) {
      } else if (keyname.startsWith("structureplacement")) {
      } else if (keyname.startsWith("chunk_loaded_request")) {
      } else if (keyname.startsWith("legacy_console_player")) {
      } else if (keyname.startsWith("PosTrackDB")) {
      } else if (keyname.startsWith("PositionTrackDB")) {
      } else if (keyname.startsWith("OwnedEntitiesLimbo")) {
      } else if (keyname.startsWith("MCeditMap")) {
      } else if (keyname.startsWith("EDU_CurrentCodingURL")) {
      } else if (keyname.startsWith("TheEnd")) {
      } else if (keyname.indexOf("WasPicked") >= 0) {
      } else if (keyname.indexOf("TextIg") >= 0) {
      } else if (keyname.startsWith("SST_SALOG")) {
      } else if (keyname.startsWith("SST_WORD")) {
      } else if (keyname.startsWith("SST_NAME")) {
      } else if (keyname.startsWith("SST_")) {
      } else if (keyname.startsWith("SUSP")) {
      } else if (keyname.startsWith("neteaseData")) {
      } else if (keyname.startsWith("scriptGid")) {
      } else if (keyname.startsWith("Nether")) {
      } else if (
        keyValue &&
        (keyname.length === 9 || keyname.length === 10 || keyname.length === 13 || keyname.length === 14)
      ) {
        const keyBytes = keyValue.keyBytes;
        const hasDimensionParam = keyname.length >= 13;

        Log.assertDefined(keyBytes);

        if (keyBytes) {
          const x = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
          const z = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);
          let dim = 0;

          if (hasDimensionParam) {
            dim = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

            // Track all dimension IDs, including custom dimensions (>= 1000)
            this._dimensionIdsInChunks.add(dim);

            if (dim < 1 || dim > 2) {
              // note overworld dimension = 0, but should be omitted so we should not see overworld = 0.
              // Custom dimensions (>= 1000) are also skipped from chunk processing.
              continue;
            }
          } else {
            // 9/10-byte keys are overworld (dim 0)
            this._dimensionIdsInChunks.add(0);
          }

          if (this._minX === undefined || x * 16 < this._minX) {
            this._minX = x * 16;
          }

          if (this._maxX === undefined || (x + 1) * 16 > this._maxX) {
            this._maxX = (x + 1) * 16;
          }

          if (this._minZ === undefined || z * 16 < this._minZ) {
            this._minZ = z * 16;
          }

          if (this._maxZ === undefined || (z + 1) * 16 > this._maxZ) {
            this._maxZ = (z + 1) * 16;
          }

          let didIncrement = false;
          let dimMap = this.chunks.get(dim);

          if (!dimMap) {
            dimMap = new Map();
            this.chunks.set(dim, dimMap);
          }

          let xPlane = dimMap.get(x);

          if (!xPlane) {
            xPlane = new Map();
            dimMap.set(x, xPlane);
          }

          let wc = xPlane.get(z);

          if (wc === undefined) {
            wc = new WorldChunk(this, x, z);
            this.chunkCount++;
            didIncrement = true;
            xPlane.set(z, wc);
          }

          wc.addKeyValue(keyValue);

          if (this.chunkCount % 10000 === 0 && didIncrement) {
            const chunkPercent = totalKeys > 0 ? Math.round((processedKeys / totalKeys) * 100) : 0;
            await this._project?.creatorTools.notifyStatusUpdate(
              `Initialized ${this.chunkCount / 1000}K chunks... (${chunkPercent}%)`,
              StatusTopic.worldLoad
            );
          }
        }
      } else if (
        keyValue === false &&
        (keyname.length === 9 || keyname.length === 10 || keyname.length === 13 || keyname.length === 14)
      ) {
        // keyValue === false means this is a deleted marker
        // We cannot reliably parse coordinates from keyname string (charCodeAt doesn't give raw bytes)
        // Skip trying to clear the chunk data - the deleted data is inaccessible anyway
      } else if (keyValue === false) {
        // console.log("Nulling record '" + keyname + "'");
      } else if (keyValue !== undefined) {
        // this._pushError("Unknown record type: '" + keyname + "'", this.name);
      } else {
        // this._pushError("Unknown record.", this.name);
      }

      // Clear the key from LevelDb to reduce memory usage
      // The key data has been handed off to WorldChunks or is no longer needed
      if (clearKeysAfterProcess) {
        this.levelDb.keys.delete(keyname);
      }
    }

    await this.notifyLoadEnded(processOper);

    return true;
  }

  private async notifyLoadEnded(processOper?: number) {
    if (processOper !== undefined) {
      await this._project?.creatorTools.notifyOperationEnded(
        processOper,
        "Completed second-pass load of '" + this.name + "' world.",
        StatusTopic.worldLoad
      );
    }
  }

  private async saveAutoGenItems() {
    if (!this._project) {
      return;
    }

    if (this._autogenTsFile === undefined) {
      /*const newFileName = "LocalWorld.ts";

      const genFolder = await this._project.ensureScriptGenFolder();

      if (genFolder) {
        this._autogenTsFile = genFolder.ensureFile(newFileName);

        this._project.ensureItemByProjectPath(
          this._autogenTsFile.storageRelativePath,
          ProjectItemStorageType.singleFile,
          this._autogenTsFile.name,
          ProjectItemType.ts,
          FolderContext.behaviorPack,
          undefined,
          ProjectItemCreationType.generated
        );
      }*/
    }

    if (this._autogenTsFile) {
      const content = this.getAutoGenScript();

      this._autogenTsFile.setContent(content);

      await this._autogenTsFile.saveContent(false);
    }
  }

  private getAutoGenScript() {
    const content: string[] = [];

    content.push("export const " + MinecraftUtilities.makeNameScriptSafe(this.name) + " = {");
    if (this.anchors) {
      const anchorKeys = this.anchors.getKeys();

      content.push("  anchors: {");
      for (const anchorKey of anchorKeys) {
        const anchor = this.anchors.get(anchorKey);

        if (anchor) {
          content.push(
            "    " +
              MinecraftUtilities.makeNameScriptSafe(anchor.name) +
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

  getCube(from: BlockLocation, to: BlockLocation, dim?: number) {
    const bc = new BlockVolume();

    let fromY = from.y;
    if (fromY) {
      if (fromY < this.chunkMinY) {
        fromY = this.chunkMinY;
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
        const chunkX = this.chunks.get(dim ? dim : 0)?.get(iX);

        if (chunkX) {
          const chunk = chunkX.get(iZ);
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

  getSubChunkCube(x: number, y: number, z: number, dim?: number) {
    const xDim = this.chunks.get(dim ? dim : 0)?.get(Math.floor(x / 16));

    if (!xDim) {
      return undefined;
    }

    const zDim = xDim.get(Math.floor(z / 16));

    if (zDim === undefined) {
      return undefined;
    }

    return zDim.getSubChunkCube(Math.floor(y / 16));
  }
}
