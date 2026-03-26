// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: WorldBackup - Backup Entity
 * ========================================================
 *
 * WorldBackup represents a single point-in-time snapshot of a Minecraft world.
 * Each backup is stored in a timestamped folder with its metadata and files.
 *
 * ## Storage Structure
 *
 * ```
 * worlds/{worldId}/world20260101120000/
 *   ├─ backup.json                 (IWorldBackupMetadata)
 *   ├─ level.dat
 *   ├─ levelname.txt
 *   ├─ world_behavior_packs.json
 *   ├─ world_resource_packs.json
 *   ├─ db/
 *   │   ├─ CURRENT
 *   │   ├─ MANIFEST-*
 *   │   └─ *.ldb (only modified files, others are deduplicated)
 *   ├─ behavior_packs/             (optional)
 *   └─ resource_packs/             (optional)
 * ```
 *
 * ## File Deduplication
 *
 * Files are deduplicated using MD5 hashes:
 * - Each file's hash is computed during backup
 * - If an identical file exists in a previous backup, we store a reference
 * - The `sourcePath` in the file listing points to the existing copy
 * - This dramatically reduces storage for LevelDB's immutable .ldb files
 *
 * ## Operations
 *
 * - **Restore**: Copy files back to a target folder, following source paths
 * - **Export**: Create a .mcworld zip file from the backup
 * - **Delete**: Remove the backup folder and its contents
 *
 * ## Related Files
 *
 * - IWorldBackupData.ts: Data interfaces
 * - ManagedWorld.ts: Parent world class
 * - WorldBackupManager.ts: Central management service
 * - NodeFolder.ts: File operations
 */

import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import {
  IWorldBackupMetadata,
  WorldBackupType,
  IRestoreOptions,
  IRestoreResult,
  IExportMcWorldOptions,
  IExportResult,
} from "./IWorldBackupData";
import { IFilePathAndSize } from "./NodeFolder";
import NodeFolder from "./NodeFolder";
import NodeStorage from "./NodeStorage";
import ZipStorage from "../storage/ZipStorage";
import * as fs from "fs";

export default class WorldBackup {
  private _metadata: IWorldBackupMetadata;
  private _folder: IFolder;

  /**
   * Get the backup ID (folder name, e.g., "world20260101120000").
   */
  get id(): string {
    return this._metadata.id;
  }

  /**
   * Get the parent world ID.
   */
  get worldId(): string {
    return this._metadata.worldId;
  }

  /**
   * Get the creation timestamp.
   */
  get createdAt(): Date {
    return new Date(this._metadata.createdAt);
  }

  /**
   * Get the creation timestamp as a number (milliseconds since epoch).
   */
  get timestamp(): number {
    return new Date(this._metadata.createdAt).getTime();
  }

  /**
   * Get the backup type.
   */
  get backupType(): WorldBackupType {
    return this._metadata.backupType;
  }

  /**
   * Alias for backupType.
   */
  get type(): WorldBackupType {
    return this._metadata.backupType;
  }

  /**
   * Get description (alias for notes).
   */
  get description(): string | undefined {
    return this._metadata.notes;
  }

  /**
   * Get total bytes (alias for sizeBytes).
   */
  get totalBytes(): number {
    return this._metadata.sizeBytes;
  }

  /**
   * Get the configuration hash at backup time.
   */
  get configurationHash(): string | undefined {
    return this._metadata.configurationHash;
  }

  /**
   * Get the server version at backup time.
   */
  get serverVersion(): string | undefined {
    return this._metadata.serverVersion;
  }

  /**
   * Get the total size in bytes.
   */
  get sizeBytes(): number {
    return this._metadata.sizeBytes;
  }

  /**
   * Get the file count.
   */
  get fileCount(): number {
    return this._metadata.fileCount;
  }

  /**
   * Get the deduplicated file count.
   */
  get deduplicatedFileCount(): number {
    return this._metadata.deduplicatedFileCount;
  }

  /**
   * Get the world name at backup time.
   */
  get worldName(): string | undefined {
    return this._metadata.worldName;
  }

  /**
   * Get optional notes.
   */
  get notes(): string | undefined {
    return this._metadata.notes;
  }

  /**
   * Set optional notes.
   */
  set notes(value: string | undefined) {
    this._metadata.notes = value;
  }

  /**
   * Get the file listing.
   */
  get files(): IFilePathAndSize[] {
    return this._metadata.files;
  }

  /**
   * Get the folder containing this backup.
   */
  get folder(): IFolder {
    return this._folder;
  }

  /**
   * Get the raw metadata object.
   */
  get metadata(): IWorldBackupMetadata {
    return this._metadata;
  }

  /**
   * Private constructor - use static factory methods.
   */
  private constructor(metadata: IWorldBackupMetadata, folder: IFolder) {
    this._metadata = metadata;
    this._folder = folder;
  }

  /**
   * Generate a backup ID from a timestamp.
   */
  static generateId(date?: Date): string {
    return "world" + Utilities.getDateStr(date || new Date());
  }

  /**
   * Create a new backup with the given metadata.
   *
   * @param metadata The backup metadata
   * @param parentFolder The world folder containing backups
   * @returns The newly created WorldBackup
   */
  static async create(metadata: IWorldBackupMetadata, parentFolder: IFolder): Promise<WorldBackup> {
    const backupFolder = parentFolder.ensureFolder(metadata.id);
    await backupFolder.ensureExists();

    const backup = new WorldBackup(metadata, backupFolder);
    await backup.save();

    return backup;
  }

  /**
   * Load an existing backup from a folder.
   *
   * @param folder The backup folder (e.g., worlds/a3k9m2p1/world20260101120000/)
   * @param worldId The parent world ID
   * @returns The loaded WorldBackup, or undefined if invalid
   */
  static async load(folder: IFolder, worldId: string): Promise<WorldBackup | undefined> {
    // Force reload from disk to ensure we have the actual files
    await folder.load(true);

    const backupFile = folder.files["backup.json"];
    if (!backupFile) {
      // Try legacy files.json format
      const filesFile = folder.files["files.json"];
      if (filesFile) {
        return WorldBackup.loadFromLegacyFormat(folder, worldId, filesFile);
      }
      Log.debug(`No backup.json found in ${folder.fullPath}`);
      return undefined;
    }

    await backupFile.loadContent(false);
    const metadata = StorageUtilities.getJsonObject(backupFile) as IWorldBackupMetadata | undefined;

    if (!metadata || !metadata.id) {
      Log.debug(`Invalid backup.json in ${folder.fullPath}`);
      return undefined;
    }

    return new WorldBackup(metadata, folder);
  }

  /**
   * Load from legacy files.json format (backwards compatibility).
   */
  private static async loadFromLegacyFormat(
    folder: IFolder,
    worldId: string,
    filesFile: IFile
  ): Promise<WorldBackup | undefined> {
    await filesFile.loadContent(false);
    const legacy = StorageUtilities.getJsonObject(filesFile) as { path: string; files: IFilePathAndSize[] } | undefined;

    if (!legacy || !legacy.files) {
      return undefined;
    }

    // Extract date from folder name
    const folderName = folder.name;
    let createdAt = new Date().toISOString();
    if (folderName.startsWith("world") && folderName.length === 19) {
      const dateStr = folderName.substring(5);
      if (Utilities.isNumeric(dateStr)) {
        createdAt = Utilities.getDateFromStr(dateStr).toISOString();
      }
    }

    // Calculate stats
    let sizeBytes = 0;
    let deduplicatedCount = 0;
    for (const file of legacy.files) {
      if (file.sourcePath) {
        deduplicatedCount++;
      } else if (file.size) {
        sizeBytes += file.size;
      }
    }

    const metadata: IWorldBackupMetadata = {
      id: folderName,
      worldId: worldId,
      createdAt: createdAt,
      backupType: WorldBackupType.full,
      sizeBytes: sizeBytes,
      fileCount: legacy.files.length,
      deduplicatedFileCount: deduplicatedCount,
      files: legacy.files,
    };

    return new WorldBackup(metadata, folder);
  }

  /**
   * Save the backup metadata to backup.json.
   */
  async save(): Promise<void> {
    const backupFile = this._folder.ensureFile("backup.json");
    backupFile.setContent(JSON.stringify(this._metadata, null, 2));
    await backupFile.saveContent();
  }

  /**
   * Recursively force load a folder and all its subfolders.
   * This ensures in-memory folder structure matches disk after backup creation.
   */
  private static async recursiveForceLoad(folder: IFolder): Promise<void> {
    await folder.load(true);

    for (const folderName in folder.folders) {
      const subFolder = folder.folders[folderName];
      if (subFolder) {
        await WorldBackup.recursiveForceLoad(subFolder);
      }
    }
  }

  /**
   * Restore this backup to a target folder.
   *
   * @param options Restore options
   * @param worldContainerFolder The root worlds folder for resolving source paths
   * @returns Restore result
   */
  async restore(options: IRestoreOptions, worldContainerFolder: IFolder): Promise<IRestoreResult> {
    try {
      const targetPath = options.targetPath;

      // Optionally clear the target folder
      if (options.clearTarget && fs.existsSync(targetPath)) {
        const targetStorage = new NodeStorage(targetPath, "");
        await targetStorage.rootFolder.deleteAllFolderContents();
      }

      // Ensure target exists
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      // Recursively load backup folder contents to ensure all subfolders are loaded from disk
      await WorldBackup.recursiveForceLoad(this._folder);

      const targetStorage = new NodeStorage(targetPath, "");

      // Copy files based on metadata
      let totalBytes = 0;
      let restoredFiles = 0;

      for (const fileInfo of this._metadata.files) {
        if (fileInfo.path) {
          let sourceFile: IFile | undefined;

          if (fileInfo.sourcePath) {
            // File is deduplicated - get it from the source path (relative to worldContainerFolder)
            sourceFile = await worldContainerFolder.getFileFromRelativePath(
              StorageUtilities.ensureStartsWithDelimiter(fileInfo.sourcePath)
            );
          } else {
            // File is stored in this backup folder
            sourceFile = await this._folder.getFileFromRelativePath(
              StorageUtilities.ensureStartsWithDelimiter(fileInfo.path)
            );
          }

          if (sourceFile) {
            if (!sourceFile.isContentLoaded) {
              await sourceFile.loadContent();
            }

            if (sourceFile.content !== null) {
              const targetFile = await targetStorage.rootFolder.ensureFileFromRelativePath(
                StorageUtilities.ensureStartsWithDelimiter(fileInfo.path)
              );

              if (targetFile) {
                targetFile.setContent(sourceFile.content);
                restoredFiles++;
                if (fileInfo.size) {
                  totalBytes += fileInfo.size;
                }
              }
            }
          } else {
            Log.debug(`Could not find backup file '${fileInfo.path}' for restore`);
          }
        }
      }

      await targetStorage.rootFolder.saveAll();

      Log.message(`Restored backup ${this._metadata.id} to ${targetPath}: ${restoredFiles} files`);

      return {
        success: true,
        restoredPath: targetPath,
        stats: {
          totalFiles: restoredFiles,
          restoredBytes: totalBytes,
        },
      };
    } catch (e: any) {
      Log.error(`Failed to restore backup ${this._metadata.id}: ${e.message}`);
      return {
        success: false,
        error: e.message,
      };
    }
  }

  /**
   * Export this backup as a .mcworld file.
   *
   * @param options Export options
   * @param worldContainerFolder The root worlds folder for resolving source paths
   * @returns Export result
   */
  async exportMcWorld(options: IExportMcWorldOptions, worldContainerFolder: IFolder): Promise<IExportResult> {
    try {
      // First restore to a temp folder
      const tempPath =
        NodeStorage.ensureEndsWithDelimiter(StorageUtilities.getFolderPath(options.outputPath)) +
        "mcworld_temp_" +
        Date.now();

      const restoreResult = await this.restore({ targetPath: tempPath }, worldContainerFolder);
      if (!restoreResult.success) {
        return {
          success: false,
          error: restoreResult.error,
        };
      }

      // Optionally update the world name
      if (options.worldName) {
        const levelNamePath = NodeStorage.ensureEndsWithDelimiter(tempPath) + "levelname.txt";
        fs.writeFileSync(levelNamePath, options.worldName, { encoding: "utf8" });
      }

      // Create the zip file
      const tempStorage = new NodeStorage(tempPath, "");
      await tempStorage.rootFolder.load(true);

      const zipStorage = new ZipStorage();
      await StorageUtilities.syncFolderTo(tempStorage.rootFolder, zipStorage.rootFolder, false, false, false);

      const zipBytes = await zipStorage.generateUint8ArrayAsync();

      // Write the .mcworld file
      fs.writeFileSync(options.outputPath, Buffer.from(zipBytes));

      // Clean up temp folder
      await tempStorage.rootFolder.deleteThisFolder();

      const sizeBytes = zipBytes.byteLength;

      Log.message(`Exported backup ${this._metadata.id} to ${options.outputPath} (${sizeBytes} bytes)`);

      return {
        success: true,
        outputPath: options.outputPath,
        sizeBytes: sizeBytes,
      };
    } catch (e: any) {
      Log.error(`Failed to export backup ${this._metadata.id}: ${e.message}`);
      return {
        success: false,
        error: e.message,
      };
    }
  }

  /**
   * Check if this backup has files that are deduplicated (reference another backup).
   */
  hasDeduplicatedFiles(): boolean {
    return this._metadata.files.some((f) => f.sourcePath !== undefined);
  }

  /**
   * Get all sourcePath values that this backup depends on.
   * Returns backup folder paths (e.g., "/worldId/backupId/") that contain files this backup references.
   */
  getDependencies(): Set<string> {
    const deps = new Set<string>();
    for (const file of this._metadata.files) {
      if (file.sourcePath) {
        // Extract the backup folder path from the sourcePath
        // sourcePath format: /worldId/backupId/path/to/file.ext
        const parts = file.sourcePath.split("/").filter((p) => p.length > 0);
        if (parts.length >= 2) {
          deps.add(`/${parts[0]}/${parts[1]}/`);
        }
      }
    }
    return deps;
  }

  /**
   * Consolidate this backup by copying deduplicated files locally.
   * This is needed before deleting a backup that other backups depend on.
   *
   * @param worldContainerFolder The root worlds folder for resolving source paths
   * @returns true if consolidation was successful
   */
  async consolidate(worldContainerFolder: IFolder): Promise<boolean> {
    if (!this.hasDeduplicatedFiles()) {
      return true; // Nothing to consolidate
    }

    try {
      await WorldBackup.recursiveForceLoad(this._folder);

      let consolidated = 0;
      for (const fileInfo of this._metadata.files) {
        if (fileInfo.sourcePath && fileInfo.path) {
          // Get the source file from the referenced backup
          const sourceFile = await worldContainerFolder.getFileFromRelativePath(
            StorageUtilities.ensureStartsWithDelimiter(fileInfo.sourcePath)
          );

          if (sourceFile) {
            if (!sourceFile.isContentLoaded) {
              await sourceFile.loadContent();
            }

            if (sourceFile.content !== null) {
              // Create local copy
              const targetFile = await this._folder.ensureFileFromRelativePath(
                StorageUtilities.ensureStartsWithDelimiter(fileInfo.path)
              );

              if (targetFile) {
                targetFile.setContent(sourceFile.content);
                await targetFile.saveContent();

                // Remove the sourcePath reference
                delete fileInfo.sourcePath;
                consolidated++;
              }
            }
          } else {
            Log.debug(`Could not find source file '${fileInfo.sourcePath}' for consolidation`);
          }
        }
      }

      // Update metadata counts
      this._metadata.deduplicatedFileCount = 0;

      // Save updated metadata
      await this.save();

      Log.message(`Consolidated ${consolidated} deduplicated files in backup ${this._metadata.id}`);
      return true;
    } catch (e: any) {
      Log.error(`Failed to consolidate backup ${this._metadata.id}: ${e.message}`);
      return false;
    }
  }

  /**
   * Delete this backup.
   */
  async delete(): Promise<boolean> {
    try {
      if (this._folder instanceof NodeFolder) {
        await this._folder.deleteThisFolder();
      }
      Log.message(`Deleted backup ${this._metadata.id}`);
      return true;
    } catch (e) {
      Log.error(`Failed to delete backup ${this._metadata.id}: ${e}`);
      return false;
    }
  }
}
