// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: ManagedWorld - World Entity
 * ========================================================
 *
 * ManagedWorld represents a Minecraft world that is tracked by the backup system.
 * Each world has a unique 8-character ID and can have multiple backups.
 *
 * ## Lifecycle
 *
 * 1. Create: `ManagedWorld.create(friendlyName)` generates a new ID
 * 2. Load: `ManagedWorld.load(folder)` loads from existing world.json
 * 3. Backup: `world.createBackup(sourcePath, options)` creates a new backup
 * 4. Restore: `world.restoreBackup(backupId, targetPath)` restores a backup
 * 5. Export: `world.exportMcWorld(backupId, outputPath)` creates .mcworld file
 *
 * ## Storage
 *
 * Each ManagedWorld has a folder at: worlds/{worldId}/
 * - world.json: World metadata (IManagedWorldData)
 * - world{timestamp}/: Backup folders
 *
 * ## Related Files
 *
 * - IWorldBackupData.ts: Data interfaces
 * - WorldBackup.ts: Individual backup class
 * - WorldBackupManager.ts: Central management service
 */

import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import { IManagedWorldData, IWorldSummary, WORLD_ID_CHARS, WORLD_ID_LENGTH } from "./IWorldBackupData";
import WorldBackup from "./WorldBackup";
import NodeFolder from "./NodeFolder";

export default class ManagedWorld {
  private _data: IManagedWorldData;
  private _folder: IFolder;
  private _backups: WorldBackup[] = [];
  private _backupsLoaded: boolean = false;

  /**
   * Get the unique world ID.
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Alias for id (for consistency with some API usage).
   */
  get worldId(): string {
    return this._data.id;
  }

  /**
   * Get the user-visible friendly name.
   */
  get friendlyName(): string {
    return this._data.friendlyName;
  }

  /**
   * Set the user-visible friendly name.
   */
  set friendlyName(value: string) {
    this._data.friendlyName = value;
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Get the description.
   */
  get description(): string | undefined {
    return this._data.description;
  }

  /**
   * Set the description.
   */
  set description(value: string | undefined) {
    this._data.description = value;
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Get the creation timestamp.
   */
  get createdAt(): Date {
    return new Date(this._data.createdAt);
  }

  /**
   * Get the last modified timestamp.
   */
  get lastModified(): Date {
    return new Date(this._data.lastModified);
  }

  /**
   * Get the initial configuration hash.
   */
  get initialConfigurationHash(): string | undefined {
    return this._data.initialConfigurationHash;
  }

  /**
   * Set the initial configuration hash.
   */
  set initialConfigurationHash(value: string | undefined) {
    this._data.initialConfigurationHash = value;
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Get optional notes.
   */
  get notes(): string | undefined {
    return this._data.notes;
  }

  /**
   * Set optional notes.
   */
  set notes(value: string | undefined) {
    this._data.notes = value;
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Get tags for organization.
   */
  get tags(): string[] {
    return this._data.tags || [];
  }

  /**
   * Set tags for organization.
   */
  set tags(value: string[]) {
    this._data.tags = value;
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Get the folder containing this world's data.
   */
  get folder(): IFolder {
    return this._folder;
  }

  /**
   * Get the raw data object.
   */
  get data(): IManagedWorldData {
    return this._data;
  }

  /**
   * Get the list of backups (must call loadBackups first).
   */
  get backups(): WorldBackup[] {
    return this._backups;
  }

  /**
   * Private constructor - use static factory methods.
   */
  private constructor(data: IManagedWorldData, folder: IFolder) {
    this._data = data;
    this._folder = folder;
  }

  /**
   * Generate a random 8-character world ID.
   */
  static generateId(): string {
    let id = "";
    for (let i = 0; i < WORLD_ID_LENGTH; i++) {
      id += WORLD_ID_CHARS.charAt(Math.floor(Math.random() * WORLD_ID_CHARS.length));
    }
    return id;
  }

  /**
   * Validate a world ID format.
   */
  static isValidId(id: string): boolean {
    if (id.length !== WORLD_ID_LENGTH) {
      return false;
    }
    for (const char of id) {
      if (!WORLD_ID_CHARS.includes(char)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Create a new managed world.
   *
   * @param friendlyName User-visible name for the world
   * @param parentFolder The worlds container folder
   * @param configurationHash Optional initial configuration hash
   * @returns The newly created ManagedWorld
   */
  static async create(friendlyName: string, parentFolder: IFolder, configurationHash?: string): Promise<ManagedWorld> {
    const id = ManagedWorld.generateId();
    const now = new Date().toISOString();

    const data: IManagedWorldData = {
      id,
      friendlyName,
      initialConfigurationHash: configurationHash,
      createdAt: now,
      lastModified: now,
    };

    const worldFolder = parentFolder.ensureFolder(id);
    await worldFolder.ensureExists();

    const world = new ManagedWorld(data, worldFolder);
    await world.save();

    Log.message(`Created new managed world: ${friendlyName} (${id})`);

    return world;
  }

  /**
   * Load an existing managed world from a folder.
   *
   * @param folder The world folder (e.g., worlds/a3k9m2p1/)
   * @returns The loaded ManagedWorld, or undefined if invalid
   */
  static async load(folder: IFolder): Promise<ManagedWorld | undefined> {
    await folder.load(false);

    const worldFile = folder.files["world.json"];
    if (!worldFile) {
      Log.debug(`No world.json found in ${folder.fullPath}`);
      return undefined;
    }

    await worldFile.loadContent(false);
    const data = StorageUtilities.getJsonObject(worldFile) as IManagedWorldData | undefined;

    if (!data || !data.id) {
      Log.debug(`Invalid world.json in ${folder.fullPath}`);
      return undefined;
    }

    return new ManagedWorld(data, folder);
  }

  /**
   * Save the world metadata to world.json.
   */
  async save(): Promise<void> {
    const worldFile = this._folder.ensureFile("world.json");
    worldFile.setContent(JSON.stringify(this._data, null, 2));
    await worldFile.saveContent();
  }

  /**
   * Load all backups for this world.
   */
  async loadBackups(): Promise<WorldBackup[]> {
    if (this._backupsLoaded) {
      return this._backups;
    }

    // Clear existing folder references to ensure fresh objects when loading
    // This prevents stale in-memory folder objects from being reused
    for (const folderName in this._folder.folders) {
      delete this._folder.folders[folderName];
    }

    await this._folder.load(true);

    this._backups = [];

    for (const folderName in this._folder.folders) {
      if (folderName.startsWith("world") && folderName.length === 19) {
        const dateStr = folderName.substring(5);
        if (Utilities.isNumeric(dateStr)) {
          const backupFolder = this._folder.folders[folderName];
          if (backupFolder) {
            const backup = await WorldBackup.load(backupFolder, this._data.id);
            if (backup) {
              this._backups.push(backup);
            }
          }
        }
      }
    }

    // Sort by creation date, newest first
    this._backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    this._backupsLoaded = true;
    return this._backups;
  }

  /**
   * Get the latest backup for this world.
   */
  async getLatestBackup(): Promise<WorldBackup | undefined> {
    await this.loadBackups();
    return this._backups.length > 0 ? this._backups[0] : undefined;
  }

  /**
   * Get a specific backup by ID.
   */
  async getBackup(backupId: string): Promise<WorldBackup | undefined> {
    await this.loadBackups();
    return this._backups.find((b) => b.id === backupId);
  }

  /**
   * Get summary info for the manifest.
   */
  getSummary(): IWorldSummary {
    return {
      id: this._data.id,
      friendlyName: this._data.friendlyName,
      createdAt: this._data.createdAt,
      lastBackupAt: this._backups.length > 0 ? this._backups[0].createdAt.toISOString() : undefined,
      backupCount: this._backups.length,
      worldId: this._data.id,
      lastModified: this._backups.length > 0
        ? this._backups[0].createdAt.toISOString()
        : this._data.lastModified || this._data.createdAt,
    };
  }

  /**
   * Delete a backup.
   *
   * @param backupId The backup ID to delete
   * @returns True if deleted, false if not found
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    await this.loadBackups();

    const backupIndex = this._backups.findIndex((b) => b.id === backupId);
    if (backupIndex < 0) {
      return false;
    }

    const backup = this._backups[backupIndex];
    await backup.delete();

    this._backups.splice(backupIndex, 1);

    Log.message(`Deleted backup ${backupId} from world ${this._data.id}`);

    return true;
  }

  /**
   * Prune old backups, keeping only the specified count.
   * Before deleting, consolidates any remaining backups that depend on files
   * in the backups being deleted.
   *
   * @param keepCount Number of backups to keep
   * @returns Number of backups deleted
   */
  async pruneBackups(keepCount: number): Promise<number> {
    await this.loadBackups();

    if (this._backups.length <= keepCount) {
      return 0;
    }

    const toKeep = this._backups.slice(0, keepCount);
    const toDelete = this._backups.slice(keepCount);

    // Build a set of backup paths that will be deleted
    const deletingPaths = new Set<string>();
    for (const backup of toDelete) {
      // Format: /worldId/backupId/
      deletingPaths.add(`/${this._data.id}/${backup.id}/`);
    }

    // Consolidate any backups being kept that depend on backups being deleted
    for (const backup of toKeep) {
      const dependencies = backup.getDependencies();
      for (const dep of dependencies) {
        if (deletingPaths.has(dep)) {
          // This backup depends on a backup being deleted - consolidate it
          await backup.consolidate(this._folder.parentFolder!);
          break; // Only need to consolidate once per backup
        }
      }
    }

    let deleted = 0;
    for (const backup of toDelete) {
      try {
        await backup.delete();
        deleted++;
      } catch (e) {
        Log.error(`Failed to delete backup ${backup.id}: ${e}`);
      }
    }

    // Invalidate cache to ensure next access reloads from disk with fresh folder objects
    this.invalidateBackupCache();

    Log.message(`Pruned ${deleted} old backups from world ${this._data.id}`);

    return deleted;
  }

  /**
   * Delete this world and all its backups.
   */
  async delete(): Promise<boolean> {
    try {
      if (this._folder instanceof NodeFolder) {
        await this._folder.deleteThisFolder();
      }
      Log.message(`Deleted managed world ${this._data.id}`);
      return true;
    } catch (e) {
      Log.error(`Failed to delete world ${this._data.id}: ${e}`);
      return false;
    }
  }

  /**
   * Register a new backup folder (called by WorldBackupManager).
   * Note: This invalidates the backup cache so the next loadBackups() reloads from disk
   * to ensure the in-memory folder structure is synchronized.
   */
  registerBackup(backup: WorldBackup): void {
    // Invalidate cache to ensure next load reads from disk with proper file structure
    this.invalidateBackupCache();
    this._data.lastModified = new Date().toISOString();
  }

  /**
   * Invalidate the backup cache to force reload.
   */
  invalidateBackupCache(): void {
    this._backupsLoaded = false;
    this._backups = [];
  }
}
