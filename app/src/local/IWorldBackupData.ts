// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: World Backup Data Interfaces
 * =========================================================
 *
 * This file defines the core data structures for the world backup system.
 *
 * ## Storage Structure
 *
 * ```
 * Documents/mctools/worlds/
 *   ├─ manifest.json                     (IWorldBackupManifest - global index)
 *   └─ {worldId}/                        (8-char random ID, e.g., "a3k9m2p1")
 *       ├─ world.json                    (IManagedWorldData - world metadata)
 *       ├─ world20260101120000/          (timestamped backup folder)
 *       │   ├─ backup.json               (IWorldBackupMetadata)
 *       │   ├─ level.dat
 *       │   ├─ levelname.txt
 *       │   ├─ world_behavior_packs.json
 *       │   ├─ world_resource_packs.json
 *       │   ├─ db/
 *       │   │   └─ <modified .ldb files>
 *       │   ├─ behavior_packs/           (optional, with SHA deduplication)
 *       │   └─ resource_packs/           (optional, with SHA deduplication)
 *       └─ world20260101130000/          (later backup)
 * ```
 *
 * ## File Deduplication
 *
 * LevelDB files (.ldb) and pack files use SHA-based deduplication:
 * - Each file is hashed (MD5)
 * - If the same file exists in a previous backup, we store a reference instead
 * - The `sourcePath` field in IFilePathAndSize points to the existing copy
 *
 * ## Key Concepts
 *
 * - **ManagedWorld**: A world with a unique ID and friendly name
 * - **WorldBackup**: A point-in-time snapshot of a world
 * - **WorldBackupManager**: Central service for backup operations
 *
 * ## Related Files
 *
 * - ManagedWorld.ts: World entity class
 * - WorldBackup.ts: Backup entity class
 * - WorldBackupManager.ts: Central backup management service
 * - NodeFolder.ts: File operations with deduplication
 */

import { IFilePathAndSize } from "./NodeFolder";

/**
 * Global manifest tracking all managed worlds.
 * Stored at: worlds/manifest.json
 */
export interface IWorldBackupManifest {
  /** Schema version for forward compatibility */
  version: number;
  /** Last time the manifest was updated */
  lastModified: string;
  /** Map of world ID to summary info */
  worlds: { [worldId: string]: IWorldSummary };
}

/**
 * Summary info for a world in the global manifest.
 * Kept lightweight for quick enumeration.
 */
export interface IWorldSummary {
  /** Unique 8-character ID */
  id: string;
  /** User-visible name */
  friendlyName: string;
  /** When the world was first created/registered */
  createdAt: string;
  /** When the last backup was taken */
  lastBackupAt?: string;
  /** Number of backups available */
  backupCount: number;
  /** World ID for UI consumption (same as id) */
  worldId?: string;
  /** Last modified date for UI consumption */
  lastModified?: string;
}

/**
 * Full metadata for a managed world.
 * Stored at: worlds/{worldId}/world.json
 */
export interface IManagedWorldData {
  /** Unique 8-character ID (lowercase letters + numbers) */
  id: string;
  /** User-visible name */
  friendlyName: string;
  /** Optional description */
  description?: string;
  /** Hash of the initial world configuration/settings */
  initialConfigurationHash?: string;
  /** When this world was first created/registered */
  createdAt: string;
  /** When the world metadata was last modified */
  lastModified: string;
  /** Optional notes about this world */
  notes?: string;
  /** Tags for organization */
  tags?: string[];
}

/**
 * Metadata for a single backup.
 * Stored at: worlds/{worldId}/world{timestamp}/backup.json
 */
export interface IWorldBackupMetadata {
  /** Backup ID (same as folder name, e.g., "world20260101120000") */
  id: string;
  /** Parent world ID */
  worldId: string;
  /** When this backup was created */
  createdAt: string;
  /** Type of backup */
  backupType: WorldBackupType;
  /** Hash of world configuration at backup time */
  configurationHash?: string;
  /** Minecraft server version used */
  serverVersion?: string;
  /** Total size in bytes (sum of all unique files) */
  sizeBytes: number;
  /** Number of files in this backup */
  fileCount: number;
  /** Number of files deduplicated (referenced from older backups) */
  deduplicatedFileCount: number;
  /** World name from levelname.txt at backup time */
  worldName?: string;
  /** Optional notes about this backup */
  notes?: string;
  /** File listing with deduplication info */
  files: IFilePathAndSize[];
}

/**
 * Type of backup operation.
 */
export enum WorldBackupType {
  /** Full backup of all world files */
  full = "full",
  /** Incremental backup using save query results */
  incremental = "incremental",
  /** Backup taken before reprovisioning/destructive operation */
  preReprovision = "preReprovision",
  /** Manual backup requested by user */
  manual = "manual",
  /** Runtime backup while server is running */
  runtime = "runtime",
  /** Backup taken on server shutdown */
  shutdown = "shutdown",
}

/**
 * Options for creating a backup.
 */
export interface IBackupOptions {
  /** Type of backup to create */
  type?: WorldBackupType;
  /** Alternative: backupType (alias for type) */
  backupType?: WorldBackupType;
  /** Optional description/notes to attach to the backup */
  description?: string;
  /** Optional notes to attach to the backup */
  notes?: string;
  /** Incremental file list from save query (for incremental backups) */
  incrementalFileList?: IFilePathAndSize[];
  /** Inclusion list from save query (alias for incrementalFileList) */
  inclusionList?: IFilePathAndSize[];
  /** Configuration hash to record */
  configurationHash?: string;
  /** Server version to record */
  serverVersion?: string;
  /** Include behavior_packs folder */
  includeBehaviorPacks?: boolean;
  /** Include resource_packs folder */
  includeResourcePacks?: boolean;
}

/**
 * Options for restoring a backup.
 */
export interface IRestoreOptions {
  /** Target path to restore to */
  targetPath: string;
  /** Whether to clear the target folder first */
  clearTarget?: boolean;
}

/**
 * Options for exporting as .mcworld.
 */
export interface IExportMcWorldOptions {
  /** Output file path for the .mcworld file */
  outputPath: string;
  /** Optional custom world name (overrides levelname.txt) */
  worldName?: string;
}

/**
 * Result of a backup operation.
 */
export interface IBackupResult {
  success: boolean;
  backupId?: string;
  backupPath?: string;
  error?: string;
  /** Statistics about the backup */
  stats?: {
    totalFiles: number;
    newFiles: number;
    deduplicatedFiles: number;
    totalBytes: number;
    savedBytes: number;
  };
}

/**
 * Result of a restore operation.
 */
export interface IRestoreResult {
  success: boolean;
  restoredPath?: string;
  error?: string;
  /** Statistics about the restore */
  stats?: {
    totalFiles: number;
    restoredBytes: number;
  };
}

/**
 * Result of an export operation.
 */
export interface IExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  sizeBytes?: number;
}

/**
 * Current manifest version.
 */
export const MANIFEST_VERSION = 1;

/**
 * Characters allowed in world IDs.
 */
export const WORLD_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Length of world IDs.
 */
export const WORLD_ID_LENGTH = 8;
