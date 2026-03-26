// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: WorldBackupManager - Central Backup Service
 * ========================================================================
 *
 * WorldBackupManager is the central service for managing world backups.
 * It coordinates between ManagedWorld instances, handles file deduplication,
 * and maintains the global manifest.
 *
 * ## Responsibilities
 *
 * 1. **World Management**: Create, list, update, delete ManagedWorlds
 * 2. **Backup Operations**: Create, restore, export, delete backups
 * 3. **File Deduplication**: Track file hashes across all backups
 * 4. **Manifest Management**: Maintain the global worlds manifest
 *
 * ## Storage Structure
 *
 * ```
 * Documents/mctools/worlds/
 *   ├─ manifest.json           (global index of all worlds)
 *   ├─ a3k9m2p1/               (world folder)
 *   │   ├─ world.json          (world metadata)
 *   │   └─ world20260101.../   (backup folders)
 *   └─ b7n4x8q2/               (another world)
 * ```
 *
 * ## File Deduplication Strategy
 *
 * The manager maintains a global `FileListings` map:
 * - Key: `{filename}|{size}|{md5hash}`
 * - Value: Path to the first occurrence of this file
 *
 * When backing up:
 * 1. Compute MD5 hash of each file
 * 2. Check if it exists in FileListings
 * 3. If yes: Store reference in backup.json, skip copying
 * 4. If no: Copy file and add to FileListings
 *
 * This is especially effective for LevelDB's immutable .ldb files.
 *
 * ## Usage
 *
 * ```typescript
 * const manager = new WorldBackupManager(worldContainerStorage);
 * await manager.load();
 *
 * // Create a world
 * const world = await manager.createWorld("My World");
 *
 * // Create a backup
 * const backup = await manager.createBackup(world.id, sourceWorldPath);
 *
 * // Restore a backup
 * await manager.restoreBackup(world.id, backup.id, targetPath);
 *
 * // Export as .mcworld
 * await manager.exportMcWorld(world.id, backup.id, outputPath);
 * ```
 *
 * ## Related Files
 *
 * - IWorldBackupData.ts: Data interfaces
 * - ManagedWorld.ts: World entity class
 * - WorldBackup.ts: Backup entity class
 * - NodeFolder.ts: File operations with deduplication
 */

import IFolder from "../storage/IFolder";
import Log from "../core/Log";
import StorageUtilities from "../storage/StorageUtilities";
import NodeStorage from "./NodeStorage";
import NodeFolder, { FileListings, IFilePathAndSize } from "./NodeFolder";
import ManagedWorld from "./ManagedWorld";
import WorldBackup from "./WorldBackup";
import {
  IWorldBackupManifest,
  IWorldBackupMetadata,
  IBackupOptions,
  IBackupResult,
  IRestoreResult,
  IExportResult,
  WorldBackupType,
  MANIFEST_VERSION,
} from "./IWorldBackupData";
import * as fs from "fs";

export default class WorldBackupManager {
  private _containerStorage: NodeStorage;
  private _containerFolder: IFolder;
  private _manifest: IWorldBackupManifest;
  private _worlds: Map<string, ManagedWorld> = new Map();
  private _fileListings: FileListings = {};
  private _isLoaded: boolean = false;

  /**
   * Get the container folder for all worlds.
   */
  get containerFolder(): IFolder {
    return this._containerFolder;
  }

  /**
   * Get the global file listings for deduplication.
   */
  get fileListings(): FileListings {
    return this._fileListings;
  }

  /**
   * Check if the manager has been loaded.
   */
  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Get all loaded worlds.
   */
  get worlds(): ManagedWorld[] {
    return Array.from(this._worlds.values());
  }

  /**
   * Alias for worlds (for consistency with ServerManager API).
   */
  get managedWorlds(): ManagedWorld[] {
    return this.worlds;
  }

  /**
   * Get the total number of backups across all worlds.
   */
  get totalBackupCount(): number {
    let count = 0;
    for (const world of this._worlds.values()) {
      count += world.backups.length;
    }
    return count;
  }

  /**
   * Create a new WorldBackupManager.
   *
   * @param containerStorage NodeStorage pointing to the worlds container folder
   * @param initialFileListings Optional initial file listings for deduplication
   */
  constructor(containerStorage: NodeStorage, initialFileListings?: FileListings) {
    this._containerStorage = containerStorage;
    this._containerFolder = containerStorage.rootFolder;
    this._manifest = this.createEmptyManifest();
    if (initialFileListings) {
      this._fileListings = initialFileListings;
    }
  }

  /**
   * Create an empty manifest.
   */
  private createEmptyManifest(): IWorldBackupManifest {
    return {
      version: MANIFEST_VERSION,
      lastModified: new Date().toISOString(),
      worlds: {},
    };
  }

  /**
   * Load the manager: read manifest and discover worlds.
   */
  async load(): Promise<void> {
    if (this._isLoaded) {
      return;
    }

    await this._containerFolder.ensureExists();
    await this._containerFolder.load(true);

    // Load manifest
    await this.loadManifest();

    // Discover worlds
    await this.discoverWorlds();

    // Build file listings for deduplication
    await this.buildFileListings();

    this._isLoaded = true;

    if (this._worlds.size > 0) {
      Log.verbose(`WorldBackupManager loaded: ${this._worlds.size} worlds, ${this.totalBackupCount} backups`);
    }
  }

  /**
   * Load the global manifest.
   */
  private async loadManifest(): Promise<void> {
    const manifestFile = this._containerFolder.files["manifest.json"];
    if (!manifestFile) {
      this._manifest = this.createEmptyManifest();
      return;
    }

    await manifestFile.loadContent(false);
    const data = StorageUtilities.getJsonObject(manifestFile) as IWorldBackupManifest | undefined;

    if (data && data.version) {
      this._manifest = data;
    } else {
      this._manifest = this.createEmptyManifest();
    }
  }

  /**
   * Save the global manifest.
   */
  async saveManifest(): Promise<void> {
    // Update world summaries
    this._manifest.worlds = {};
    for (const [id, world] of this._worlds) {
      this._manifest.worlds[id] = world.getSummary();
    }
    this._manifest.lastModified = new Date().toISOString();

    const manifestFile = this._containerFolder.ensureFile("manifest.json");
    manifestFile.setContent(JSON.stringify(this._manifest, null, 2));
    await manifestFile.saveContent();
  }

  /**
   * Discover all worlds in the container folder.
   * Worlds are identified by their 8-character ID folder names.
   */
  private async discoverWorlds(): Promise<void> {
    for (const folderName in this._containerFolder.folders) {
      // World folders are 8-character IDs
      if (ManagedWorld.isValidId(folderName)) {
        const folder = this._containerFolder.folders[folderName];
        if (folder) {
          const world = await ManagedWorld.load(folder);
          if (world) {
            this._worlds.set(world.id, world);
          }
        }
      }
    }
  }

  /**
   * Build file listings from all existing backups for deduplication.
   */
  private async buildFileListings(): Promise<void> {
    this._fileListings = {};

    for (const world of this._worlds.values()) {
      const worldFolder = world.folder;
      if (worldFolder instanceof NodeFolder) {
        const listings = await worldFolder.generateFileListings(this._fileListings);
        Object.assign(this._fileListings, listings);
      }
    }

    Log.verbose(`Built file listings: ${Object.keys(this._fileListings).length} unique files`);
  }

  /**
   * Create a new managed world.
   *
   * @param friendlyName User-visible name
   * @param configurationHash Optional initial configuration hash
   * @returns The newly created ManagedWorld
   */
  async createWorld(friendlyName: string, configurationHash?: string): Promise<ManagedWorld> {
    await this.ensureLoaded();

    const world = await ManagedWorld.create(friendlyName, this._containerFolder, configurationHash);
    this._worlds.set(world.id, world);

    await this.saveManifest();

    return world;
  }

  /**
   * Get a world by ID (synchronous lookup).
   */
  getWorld(worldId: string): ManagedWorld | undefined {
    return this._worlds.get(worldId);
  }

  /**
   * Get a world by ID (async version, ensures loaded).
   */
  async getWorldAsync(worldId: string): Promise<ManagedWorld | undefined> {
    await this.ensureLoaded();
    return this._worlds.get(worldId);
  }

  /**
   * Get a world by friendly name (first match).
   */
  async getWorldByName(friendlyName: string): Promise<ManagedWorld | undefined> {
    await this.ensureLoaded();
    for (const world of this._worlds.values()) {
      if (world.friendlyName === friendlyName) {
        return world;
      }
    }
    return undefined;
  }

  /**
   * Get or create a world for a server slot.
   * This provides a consistent way to manage backups for server slots.
   *
   * @param slotNumber The slot number (0, 1, 2, etc.)
   * @returns The ManagedWorld for this slot
   */
  async getOrCreateWorldForSlot(slotNumber: number): Promise<ManagedWorld> {
    await this.ensureLoaded();

    const slotName = `Slot ${slotNumber} World`;

    // Look for existing world for this slot
    let world = await this.getWorldByName(slotName);

    if (!world) {
      // Create a new world for this slot
      world = await this.createWorld(slotName);
      Log.verbose(`Created managed world for slot ${slotNumber}: ${world.id}`);
    }

    return world;
  }

  /**
   * List all worlds.
   */
  async listWorlds(): Promise<ManagedWorld[]> {
    await this.ensureLoaded();
    return this.worlds;
  }

  /**
   * Update a world's metadata.
   */
  async updateWorld(
    worldId: string,
    updates: { friendlyName?: string; notes?: string; tags?: string[] }
  ): Promise<boolean> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return false;
    }

    if (updates.friendlyName !== undefined) {
      world.friendlyName = updates.friendlyName;
    }
    if (updates.notes !== undefined) {
      world.notes = updates.notes;
    }
    if (updates.tags !== undefined) {
      world.tags = updates.tags;
    }

    await world.save();
    await this.saveManifest();

    return true;
  }

  /**
   * Delete a world and all its backups.
   */
  async deleteWorld(worldId: string): Promise<boolean> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return false;
    }

    const success = await world.delete();
    if (success) {
      this._worlds.delete(worldId);
      await this.saveManifest();
    }

    return success;
  }

  /**
   * Create a backup of a world from a source path.
   *
   * @param worldId The world ID to backup to
   * @param sourceWorldPath Path to the world folder to backup (e.g., slot0/worlds/defaultWorld/)
   * @param options Backup options
   * @returns Backup result
   */
  async createBackup(worldId: string, sourceWorldPath: string, options?: IBackupOptions): Promise<IBackupResult> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return { success: false, error: `World ${worldId} not found` };
    }

    // Check if source path exists
    if (!fs.existsSync(sourceWorldPath)) {
      return { success: false, error: `Source world path does not exist: ${sourceWorldPath}` };
    }

    try {
      const backupId = WorldBackup.generateId();
      const backupFolder = world.folder.ensureFolder(backupId);
      await backupFolder.ensureExists();

      const backupType = options?.backupType || options?.type || WorldBackupType.full;
      const inclusionList: IFilePathAndSize[] = options?.incrementalFileList || options?.inclusionList || [];
      const addFilesToInclusionList = !options?.incrementalFileList && !options?.inclusionList;

      // Get source storage
      const sourceStorage = new NodeStorage(sourceWorldPath, "");
      await sourceStorage.rootFolder.load(true);

      // Read world name if available
      let worldName: string | undefined;
      const levelNameFile = sourceStorage.rootFolder.files["levelname.txt"];
      if (levelNameFile) {
        await levelNameFile.loadContent(false);
        if (typeof levelNameFile.content === "string") {
          worldName = levelNameFile.content.trim();
        }
      }

      // Copy files with deduplication
      const destStorageRelativePath = StorageUtilities.ensureStartsWithDelimiter(
        StorageUtilities.ensureEndsWithDelimiter(`${worldId}/${backupId}`)
      );

      await (sourceStorage.rootFolder as NodeFolder).copyContentsTo(
        backupFolder.fullPath,
        inclusionList,
        addFilesToInclusionList,
        this._fileListings,
        destStorageRelativePath
      );

      // Optionally copy behavior_packs
      if (options?.includeBehaviorPacks) {
        const bpPath = NodeStorage.ensureEndsWithDelimiter(sourceWorldPath) + "behavior_packs";
        if (fs.existsSync(bpPath)) {
          const bpStorage = new NodeStorage(bpPath, "");
          await bpStorage.rootFolder.load(true);
          const bpFolder = backupFolder.ensureFolder("behavior_packs");
          await bpFolder.ensureExists();
          await (bpStorage.rootFolder as NodeFolder).copyContentsTo(
            bpFolder.fullPath,
            inclusionList,
            addFilesToInclusionList,
            this._fileListings,
            destStorageRelativePath + "behavior_packs/"
          );
        }
      }

      // Optionally copy resource_packs
      if (options?.includeResourcePacks) {
        const rpPath = NodeStorage.ensureEndsWithDelimiter(sourceWorldPath) + "resource_packs";
        if (fs.existsSync(rpPath)) {
          const rpStorage = new NodeStorage(rpPath, "");
          await rpStorage.rootFolder.load(true);
          const rpFolder = backupFolder.ensureFolder("resource_packs");
          await rpFolder.ensureExists();
          await (rpStorage.rootFolder as NodeFolder).copyContentsTo(
            rpFolder.fullPath,
            inclusionList,
            addFilesToInclusionList,
            this._fileListings,
            destStorageRelativePath + "resource_packs/"
          );
        }
      }

      // Calculate stats
      let totalBytes = 0;
      let newFiles = 0;
      let deduplicatedFiles = 0;

      for (const file of inclusionList) {
        if (file.sourcePath) {
          deduplicatedFiles++;
        } else {
          newFiles++;
          if (file.size) {
            totalBytes += file.size;
          }
        }
      }

      // Create metadata
      const metadata: IWorldBackupMetadata = {
        id: backupId,
        worldId: worldId,
        createdAt: new Date().toISOString(),
        backupType: backupType,
        configurationHash: options?.configurationHash,
        serverVersion: options?.serverVersion,
        sizeBytes: totalBytes,
        fileCount: inclusionList.length,
        deduplicatedFileCount: deduplicatedFiles,
        worldName: worldName,
        notes: options?.notes,
        files: inclusionList,
      };

      // Create and save backup
      const backup = await WorldBackup.create(metadata, world.folder);
      world.registerBackup(backup);

      await world.save();
      await this.saveManifest();

      Log.message(
        `Created backup ${backupId} for world ${worldId}: ${inclusionList.length} files, ${newFiles} new, ${deduplicatedFiles} deduplicated`
      );

      return {
        success: true,
        backupId: backupId,
        backupPath: backupFolder.fullPath,
        stats: {
          totalFiles: inclusionList.length,
          newFiles: newFiles,
          deduplicatedFiles: deduplicatedFiles,
          totalBytes: totalBytes,
          savedBytes: 0, // TODO: Calculate actual savings
        },
      };
    } catch (e: any) {
      Log.error(`Failed to create backup for world ${worldId}: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * List backups for a world.
   */
  async listBackups(worldId: string): Promise<WorldBackup[]> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return [];
    }

    return await world.loadBackups();
  }

  /**
   * Get a specific backup.
   */
  async getBackup(worldId: string, backupId: string): Promise<WorldBackup | undefined> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return undefined;
    }

    return await world.getBackup(backupId);
  }

  /**
   * Restore a backup to a target path.
   */
  async restoreBackup(
    worldId: string,
    backupId: string,
    targetPath: string,
    clearTarget?: boolean
  ): Promise<IRestoreResult> {
    await this.ensureLoaded();

    const backup = await this.getBackup(worldId, backupId);
    if (!backup) {
      return { success: false, error: `Backup ${backupId} not found in world ${worldId}` };
    }

    return await backup.restore({ targetPath, clearTarget }, this._containerFolder);
  }

  /**
   * Delete a backup.
   */
  async deleteBackup(worldId: string, backupId: string): Promise<boolean> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return false;
    }

    const success = await world.deleteBackup(backupId);
    if (success) {
      await this.saveManifest();
    }

    return success;
  }

  /**
   * Export a backup as .mcworld file.
   */
  async exportMcWorld(
    worldId: string,
    backupId: string,
    outputPath: string,
    worldName?: string
  ): Promise<IExportResult> {
    await this.ensureLoaded();

    const backup = await this.getBackup(worldId, backupId);
    if (!backup) {
      return { success: false, error: `Backup ${backupId} not found in world ${worldId}` };
    }

    return await backup.exportMcWorld({ outputPath, worldName }, this._containerFolder);
  }

  /**
   * Prune old backups for a world.
   */
  async pruneBackups(worldId: string, keepCount: number): Promise<number> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return 0;
    }

    const deleted = await world.pruneBackups(keepCount);
    if (deleted > 0) {
      await this.saveManifest();
    }

    return deleted;
  }

  /**
   * Get or create a world for a given friendly name.
   * If a world with this name exists, returns it. Otherwise creates a new one.
   */
  async getOrCreateWorld(friendlyName: string, configurationHash?: string): Promise<ManagedWorld> {
    await this.ensureLoaded();

    const existing = await this.getWorldByName(friendlyName);
    if (existing) {
      return existing;
    }

    return await this.createWorld(friendlyName, configurationHash);
  }

  /**
   * Get the latest backup for a world.
   */
  async getLatestBackup(worldId: string): Promise<WorldBackup | undefined> {
    await this.ensureLoaded();

    const world = this._worlds.get(worldId);
    if (!world) {
      return undefined;
    }

    return await world.getLatestBackup();
  }

  /**
   * Ensure the manager is loaded.
   */
  private async ensureLoaded(): Promise<void> {
    if (!this._isLoaded) {
      await this.load();
    }
  }

  /**
   * Reload the manager (refresh from disk).
   */
  async reload(): Promise<void> {
    this._isLoaded = false;
    this._worlds.clear();
    this._fileListings = {};
    await this.load();
  }
}
