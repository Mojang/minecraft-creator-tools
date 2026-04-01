// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * NodeStorage.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * NodeStorage is the local file system implementation of IStorage for Node.js environments.
 * It provides real-time file system watching using Node.js fs.watch() API.
 *
 * FILE SYSTEM WATCHING:
 * ---------------------
 * - startWatching(): Begins recursive watching of the storage root folder
 * - stopWatching(): Stops a specific watcher by ID
 * - stopAllWatching(): Stops all watchers on this storage
 *
 * When file changes are detected:
 * 1. fs.watch() callback fires with filename and event type
 * 2. NodeStorage determines if it's a file or folder change
 * 3. Appropriate notify*() method is called on StorageBase
 * 4. Events propagate to listeners (HttpServer, etc.)
 *
 * DEBOUNCING:
 * -----------
 * File system events can fire multiple times for a single logical change.
 * We debounce events by path, waiting 100ms after the last event before
 * processing to coalesce rapid-fire events.
 *
 * PIPELINE INTEGRATION:
 * ---------------------
 * NodeStorage (this) -> HttpServer (traps events) -> WebSocket -> HttpStorage -> MCWorld -> WorldView
 *
 * RELATED FILES:
 * --------------
 * - IStorageWatcher.ts: Watcher interface definition
 * - NodeFolder.ts: Folder implementation (also supports watching)
 * - NodeFile.ts: File implementation
 * - HttpServer.ts: Traps events and broadcasts via WebSocket
 */

import NodeFolder from "./NodeFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import * as path from "path";
import * as fs from "fs";
import NodeFile from "./NodeFile";
import ZipStorage from "../storage/ZipStorage";
import IFolder from "../storage/IFolder";
import Log from "../core/Log";
import { IWatchableStorage, IStorageChangeEvent } from "../storage/IStorageWatcher";
import { EventDispatcher } from "ste-events";

/** Default debounce delay for file system events in milliseconds */
const WATCHER_DEBOUNCE_MS = 100;

export default class NodeStorage extends StorageBase implements IStorage, IWatchableStorage {
  rootPath: string;
  name: string;

  rootFolder: NodeFolder;

  static platformFolderDelimiter = path.sep;

  /** Active file system watchers, keyed by watcher ID */
  private _watchers: Map<string, fs.FSWatcher[]> = new Map();

  /** Debounce timers for coalescing rapid file system events */
  private _debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Counter for generating unique watcher IDs */
  private _watcherIdCounter = 0;

  /** Event dispatcher for storage change events */
  #onStorageChange = new EventDispatcher<NodeStorage, IStorageChangeEvent>();

  get folderDelimiter() {
    return path.sep;
  }

  get isWatching(): boolean {
    return this._watchers.size > 0;
  }

  public get onStorageChange() {
    return this.#onStorageChange.asEvent();
  }

  constructor(incomingPath: string, name: string) {
    super();

    if (NodeStorage.platformFolderDelimiter === "\\") {
      incomingPath = incomingPath.replace(/\//gi, NodeStorage.platformFolderDelimiter);
      incomingPath = incomingPath.replace(/\\\\/gi, "\\");
    } else if (NodeStorage.platformFolderDelimiter === "/") {
      incomingPath = incomingPath.replace(/\\/gi, NodeStorage.platformFolderDelimiter);
      incomingPath = incomingPath.replace(/\/\//gi, NodeStorage.platformFolderDelimiter);
    }

    this.rootPath = incomingPath;
    this.name = name;

    this.rootFolder = new NodeFolder(this, null, incomingPath, name);
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(NodeStorage.platformFolderDelimiter)) {
      fullPath += NodeStorage.platformFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static async createFromPath(path: string): Promise<NodeFile | NodeFolder> {
    const lastDot = path.lastIndexOf(".");
    let lastSlash = path.lastIndexOf("/");
    let lastBackslash = path.lastIndexOf("\\");

    if (lastBackslash > lastSlash) {
      lastSlash = lastBackslash;
    }

    if (lastDot > lastSlash) {
      const ns = new NodeStorage(path.substring(0, lastSlash), "");

      return (await ns.rootFolder.ensureFileFromRelativePath(path.substring(lastSlash))) as NodeFile;
    } else {
      const ns = new NodeStorage(path, "");

      return ns.rootFolder;
    }
  }

  static async createFromPathIncludingZip(path: string): Promise<IFolder | undefined> {
    const content = await NodeStorage.createFromPath(path);

    if (
      content instanceof NodeFile &&
      (path.endsWith(".mcpack") ||
        path.endsWith(".mcaddon") ||
        path.endsWith(".mcworld") ||
        path.endsWith(".zip") ||
        path.endsWith(".mcproject"))
    ) {
      const zs = await ZipStorage.loadFromFile(content);

      return zs?.rootFolder;
    }

    if (content instanceof NodeFolder) {
      return content;
    }

    return undefined;
  }

  static getParentFolderPath(parentPath: string) {
    const lastDelim = parentPath.lastIndexOf(this.platformFolderDelimiter);

    if (lastDelim < 0) {
      return parentPath;
    }

    return parentPath.substring(0, lastDelim);
  }

  public static ensureEndsWithDelimiter(pth: string) {
    if (!pth.endsWith(NodeStorage.platformFolderDelimiter)) {
      pth = pth + NodeStorage.platformFolderDelimiter;
    }

    return pth;
  }

  public static ensureStartsWithDelimiter(pth: string) {
    if (!pth.startsWith(NodeStorage.platformFolderDelimiter)) {
      pth = NodeStorage.platformFolderDelimiter + pth;
    }

    return pth;
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }

  /**
   * Start watching the storage for file system changes.
   * Uses Node.js fs.watch() with recursive option where supported.
   *
   * @returns A unique watcher ID that can be used to stop this watcher
   */
  startWatching(): string {
    const watcherId = `watcher-${++this._watcherIdCounter}`;
    const watchers: fs.FSWatcher[] = [];

    try {
      // Create a recursive watcher on the root path
      const watcher = fs.watch(this.rootPath, { recursive: true, persistent: false }, (eventType, filename) => {
        if (filename) {
          this._handleWatchEvent(watcherId, eventType, filename);
        }
      });

      watcher.on("error", (err) => {
        Log.debug(`Watcher error for ${this.rootPath}: ${err.message}`);
      });

      watchers.push(watcher);
      this._watchers.set(watcherId, watchers);

      Log.verbose(`Started watching ${this.rootPath} with ID ${watcherId}`);
    } catch (err: any) {
      Log.debug(`Failed to start watcher for ${this.rootPath}: ${err.message}`);
    }

    return watcherId;
  }

  /**
   * Stop a specific watcher by ID.
   */
  stopWatching(watcherId: string): void {
    const watchers = this._watchers.get(watcherId);
    if (watchers) {
      for (const watcher of watchers) {
        try {
          watcher.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      this._watchers.delete(watcherId);
      Log.verbose(`Stopped watcher ${watcherId} for ${this.rootPath}`);
    }
  }

  /**
   * Stop all watchers on this storage.
   */
  stopAllWatching(): void {
    for (const watchers of this._watchers.values()) {
      for (const watcher of watchers) {
        try {
          watcher.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
    this._watchers.clear();

    // Clear all debounce timers
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();

    Log.verbose(`Stopped all watchers for ${this.rootPath}`);
  }

  /**
   * Handle a file system watch event with debouncing.
   */
  private _handleWatchEvent(watcherId: string, eventType: string, filename: string): void {
    // Create a debounce key based on the filename
    const debounceKey = `${watcherId}:${filename}`;

    // Clear any existing debounce timer for this path
    const existingTimer = this._debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set a new debounce timer
    const timer = setTimeout(() => {
      this._debounceTimers.delete(debounceKey);
      this._processWatchEvent(eventType, filename);
    }, WATCHER_DEBOUNCE_MS);

    this._debounceTimers.set(debounceKey, timer);
  }

  /**
   * Process a debounced file system event.
   */
  private async _processWatchEvent(eventType: string, filename: string): Promise<void> {
    try {
      const fullPath = path.join(this.rootPath, filename);
      const relativePath = "/" + filename.replace(/\\/g, "/");

      // Check if the path exists
      const exists = fs.existsSync(fullPath);

      // Determine if it's a file or folder
      let isFile = true;
      let isDirectory = false;

      if (exists) {
        try {
          const stat = fs.statSync(fullPath);
          isFile = stat.isFile();
          isDirectory = stat.isDirectory();
        } catch (e) {
          // If we can't stat it, assume it was removed
          isFile = true;
        }
      }

      // Determine change type
      let changeType: "added" | "modified" | "removed";
      if (!exists) {
        changeType = "removed";
      } else if (eventType === "rename") {
        // "rename" can mean added or removed - we check existence above
        changeType = "added";
      } else {
        changeType = "modified";
      }

      // Create and dispatch the storage change event
      const changeEvent: IStorageChangeEvent = {
        changeType,
        path: relativePath,
        isFile,
        timestamp: new Date(),
        source: "fswatch",
      };

      this.#onStorageChange.dispatch(this, changeEvent);

      // Also dispatch the appropriate specific event
      if (isFile) {
        if (changeType === "removed") {
          this.notifyFileRemoved(relativePath);
        } else if (changeType === "added") {
          // Get or create the file and notify
          const file = await this.rootFolder.getFileFromRelativePath(relativePath);
          if (file) {
            this.notifyFileAdded(file);
          }
        } else {
          // Modified - reload and notify
          const file = await this.rootFolder.getFileFromRelativePath(relativePath);
          if (file) {
            await file.scanForChanges();
          }
        }
      } else if (isDirectory) {
        if (changeType === "removed") {
          // Folder removed - find and notify
          this.notifyFolderRemoved({ storageRelativePath: relativePath, name: path.basename(filename) } as any);
        } else if (changeType === "added") {
          // Folder added
          const folder = await this.rootFolder.getFolderFromRelativePath(relativePath);
          if (folder) {
            this.notifyFolderAdded(folder);
          }
        }
      }

      Log.verbose(`Storage change: ${changeType} ${isFile ? "file" : "folder"} ${relativePath}`);
    } catch (err: any) {
      Log.debug(`Error processing watch event for ${filename}: ${err.message}`);
    }
  }
}
