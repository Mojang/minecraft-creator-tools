// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import ILevelDbFileInfo from "./ILevelDbFileInfo";

/**
 * Represents metadata about a single LDB file's index without loading full data.
 * Used for lazy-loading to determine which files might contain a requested key.
 */
export interface ILevelDbFileIndex {
  /** The file info including level and index */
  fileInfo: ILevelDbFileInfo;

  /** Smallest key in this file (from manifest) */
  smallestKey?: string;

  /** Largest key in this file (from manifest) */
  largestKey?: string;

  /** Whether this file has been fully loaded */
  isLoaded: boolean;

  /** Priority for loading (higher level files have lower priority) */
  priority: number;
}

/**
 * Represents metadata about a LOG file for lazy loading.
 * LOG files contain the most recent writes and take priority.
 */
export interface ILevelDbLogIndex {
  /** The log file */
  file: IFile;

  /** File name/index for sorting */
  name: string;

  /** Whether this file has been loaded */
  isLoaded: boolean;
}

/**
 * Represents a key location for on-demand loading.
 * Tracks where a key can be found without loading its data.
 */
export interface IKeyLocation {
  /** The file containing this key (LDB or LOG) */
  file: IFile;

  /** Whether this is from a LOG file (higher priority) */
  isLogFile: boolean;

  /** The file level (for LDB files, lower = newer) */
  fileLevel: number;

  /** The file index */
  fileIndex: number;
}

/**
 * LevelDbIndex manages metadata about LevelDB files to enable lazy loading.
 *
 * Instead of loading all files upfront, this class:
 * 1. Parses the MANIFEST to understand file metadata
 * 2. Tracks key ranges per file for efficient lookup
 * 3. Enables on-demand loading of specific files when keys are requested
 *
 * This dramatically reduces initial memory usage for large worlds.
 */
export default class LevelDbIndex {
  /** Indexed LDB files with metadata */
  ldbFileIndexes: ILevelDbFileIndex[] = [];

  /** Indexed LOG files with metadata */
  logFileIndexes: ILevelDbLogIndex[] = [];

  /** Map of file index to file info for quick lookup */
  filesByIndex: Map<number, ILevelDbFileIndex> = new Map();

  /** Deleted file numbers from manifest */
  deletedFileNumbers: Set<number> = new Set();

  /** Total number of files in the index */
  get totalFiles(): number {
    return this.ldbFileIndexes.length + this.logFileIndexes.length;
  }

  /** Number of files that have been loaded */
  get loadedFileCount(): number {
    let count = 0;
    for (const idx of this.ldbFileIndexes) {
      if (idx.isLoaded) count++;
    }
    for (const idx of this.logFileIndexes) {
      if (idx.isLoaded) count++;
    }
    return count;
  }

  /**
   * Initialize the index from manifest metadata.
   * This does NOT load any file contents - just organizes metadata.
   */
  initFromManifest(
    ldbFiles: IFile[],
    logFiles: IFile[],
    newFileLevel?: number[],
    newFileNumber?: number[],
    newFileSmallest?: string[],
    newFileLargest?: string[],
    deletedFileNumber?: number[]
  ): void {
    // Track deleted files
    this.deletedFileNumbers.clear();
    if (deletedFileNumber) {
      for (const num of deletedFileNumber) {
        this.deletedFileNumbers.add(num);
      }
    }

    // Index LDB files
    this.ldbFileIndexes = [];
    this.filesByIndex.clear();

    for (const file of ldbFiles) {
      try {
        const index = parseInt(file.name);

        // Skip deleted files
        if (this.deletedFileNumbers.has(index)) {
          continue;
        }

        // Find level and key range from manifest
        let level = 0;
        let smallest: string | undefined;
        let largest: string | undefined;

        if (newFileLevel && newFileNumber) {
          for (let j = 0; j < newFileNumber.length; j++) {
            if (newFileNumber[j] === index) {
              level = newFileLevel[j];
              if (newFileSmallest) smallest = newFileSmallest[j];
              if (newFileLargest) largest = newFileLargest[j];
              break;
            }
          }
        }

        const fileIndex: ILevelDbFileIndex = {
          fileInfo: {
            index: index,
            file: file,
            isDeleted: false,
            level: level,
          },
          smallestKey: smallest,
          largestKey: largest,
          isLoaded: false,
          // Higher level = lower priority (older data, less likely to be superceded)
          priority: 1000 - level,
        };

        this.ldbFileIndexes.push(fileIndex);
        this.filesByIndex.set(index, fileIndex);
      } catch (e) {
        // Skip files that don't have numeric names
      }
    }

    // Sort LDB files by level (descending) then index (ascending)
    // This ensures we process files in the correct order for supercession
    this.ldbFileIndexes.sort((a, b) => {
      if (a.fileInfo.level === b.fileInfo.level) {
        return a.fileInfo.index - b.fileInfo.index;
      }
      return b.fileInfo.level - a.fileInfo.level;
    });

    // Index LOG files
    this.logFileIndexes = [];
    for (const file of logFiles) {
      this.logFileIndexes.push({
        file: file,
        name: file.name,
        isLoaded: false,
      });
    }

    // Sort LOG files by name (ascending) - later files supercede earlier
    this.logFileIndexes.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find files that might contain a specific key based on key range metadata.
   * Returns files in priority order (LOG files first, then LDB by level).
   *
   * Note: This is a heuristic - if key ranges aren't available from manifest,
   * all files are considered potential matches.
   */
  findPotentialFilesForKey(key: string): Array<ILevelDbFileIndex | ILevelDbLogIndex> {
    const result: Array<ILevelDbFileIndex | ILevelDbLogIndex> = [];

    // LOG files always have priority (most recent writes)
    // We need to check all LOG files since they don't have key range metadata
    for (const logIdx of this.logFileIndexes) {
      result.push(logIdx);
    }

    // Filter LDB files by key range if available
    for (const ldbIdx of this.ldbFileIndexes) {
      const hasRange = ldbIdx.smallestKey !== undefined && ldbIdx.largestKey !== undefined;

      if (hasRange) {
        // Check if key falls within the file's key range
        if (key >= ldbIdx.smallestKey! && key <= ldbIdx.largestKey!) {
          result.push(ldbIdx);
        }
      } else {
        // No range metadata - must check this file
        result.push(ldbIdx);
      }
    }

    return result;
  }

  /**
   * Get files that should be loaded for initial chunk enumeration.
   * This returns a subset of files that contain chunk metadata keys
   * (keys that are 9-14 bytes, which identify chunk coordinates).
   *
   * Returns files in the order they should be processed for correct supercession.
   */
  getFilesForChunkEnumeration(): Array<ILevelDbFileIndex | ILevelDbLogIndex> {
    // For initial enumeration, we need all files in the correct order
    // LDB files first (sorted by level desc, index asc), then LOG files
    const result: Array<ILevelDbFileIndex | ILevelDbLogIndex> = [];

    for (const ldbIdx of this.ldbFileIndexes) {
      result.push(ldbIdx);
    }

    for (const logIdx of this.logFileIndexes) {
      result.push(logIdx);
    }

    return result;
  }

  /**
   * Mark a file as loaded.
   */
  markFileLoaded(file: IFile): void {
    for (const ldbIdx of this.ldbFileIndexes) {
      if (ldbIdx.fileInfo.file === file) {
        ldbIdx.isLoaded = true;
        return;
      }
    }

    for (const logIdx of this.logFileIndexes) {
      if (logIdx.file === file) {
        logIdx.isLoaded = true;
        return;
      }
    }
  }

  /**
   * Check if all files have been loaded.
   */
  isFullyLoaded(): boolean {
    for (const ldbIdx of this.ldbFileIndexes) {
      if (!ldbIdx.isLoaded) return false;
    }
    for (const logIdx of this.logFileIndexes) {
      if (!logIdx.isLoaded) return false;
    }
    return true;
  }

  /**
   * Get unloaded files in priority order for background loading.
   */
  getUnloadedFiles(): Array<ILevelDbFileIndex | ILevelDbLogIndex> {
    const result: Array<ILevelDbFileIndex | ILevelDbLogIndex> = [];

    // LDB files in priority order
    for (const ldbIdx of this.ldbFileIndexes) {
      if (!ldbIdx.isLoaded) {
        result.push(ldbIdx);
      }
    }

    // LOG files (highest priority for supercession)
    for (const logIdx of this.logFileIndexes) {
      if (!logIdx.isLoaded) {
        result.push(logIdx);
      }
    }

    return result;
  }
}
