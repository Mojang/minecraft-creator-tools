// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * IStorageWatcher.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This file defines the interfaces for file system watching and notification propagation.
 * It is a key component in the real-time synchronization architecture:
 *
 * DATA FLOW:
 * ----------
 * 1. NodeStorage/NodeFolder/NodeFile: Uses Node.js fs.watch() to detect local file changes
 *    - Implements IWatchableStorage/IWatchableFolder to provide watcher lifecycle management
 *    - Fires events via StorageBase/FolderBase when changes detected
 *
 * 2. HttpServer: Listens to storage events and broadcasts via WebSocket
 *    - Traps onFileAdded, onFileRemoved, onFileContentsUpdated, onFolderAdded events from NodeStorage
 *    - Converts to IServerNotification format and broadcasts to subscribed clients
 *
 * 3. HttpStorage (client): Receives WebSocket notifications and converts to storage events
 *    - Connects to /ws/notifications WebSocket endpoint
 *    - Receives IServerNotification messages
 *    - Fires onFileAdded, onFileRemoved, onFileContentsUpdated events
 *
 * 4. MCWorld: Subscribes to storage events and updates world state
 *    - Listens to file/folder change events
 *    - Reloads chunks, LevelDB data, or entity data as needed
 *    - Fires onChunkUpdated, onWorldDataChanged events
 *
 * 5. WorldView (UX): Subscribes to MCWorld events and updates UI
 *    - Listens to onChunkUpdated, onWorldDataChanged
 *    - Triggers React re-render or Leaflet map updates
 *
 * RELATED FILES:
 * --------------
 * - IStorage.ts: Base storage interface with existing events
 * - IServerNotification.ts: WebSocket notification message format
 * - NodeStorage.ts, NodeFolder.ts, NodeFile.ts: Server-side file system with watchers
 * - HttpStorage.ts, HttpFolder.ts, HttpFile.ts: Client-side HTTP storage with WS notifications
 * - MCWorld.ts: World data management with change events
 * - WorldView.tsx: React component for world visualization
 *
 * WATCHER LIFECYCLE:
 * ------------------
 * - startWatching(): Begin monitoring for changes, returns watcher ID
 * - stopWatching(id): Stop a specific watcher by ID
 * - stopAllWatching(): Stop all watchers on this storage/folder
 * - isWatching: Property to check if any watchers are active
 */

import { IEvent } from "ste-events";

/**
 * Event data for storage change notifications.
 */
export interface IStorageChangeEvent {
  /** Type of change that occurred */
  changeType: StorageChangeType;
  /** Path relative to storage root */
  path: string;
  /** Whether this is a file (true) or folder (false) */
  isFile: boolean;
  /** Timestamp of the change */
  timestamp: Date;
  /** Optional: Source that caused the change (e.g., "external", "internal", watcher ID) */
  source?: string;
}

/**
 * Types of changes that can be detected.
 */
export type StorageChangeType = "added" | "modified" | "removed" | "renamed";

/**
 * Interface for storage implementations that support file system watching.
 * Extends IStorage with watcher lifecycle methods and additional events.
 */
export interface IWatchableStorage {
  /** Start watching the storage for changes */
  startWatching(): string;

  /** Stop a specific watcher by ID */
  stopWatching(watcherId: string): void;

  /** Stop all watchers on this storage */
  stopAllWatching(): void;

  /** Check if any watchers are currently active */
  readonly isWatching: boolean;

  /** Event fired when any file or folder changes (aggregate event) */
  readonly onStorageChange: IEvent<IWatchableStorage, IStorageChangeEvent>;
}

/**
 * Interface for folder implementations that support watching.
 */
export interface IWatchableFolder {
  /** Start watching this folder (and optionally subfolders) for changes */
  startWatching(recursive?: boolean): string;

  /** Stop watching this folder */
  stopWatching(watcherId: string): void;

  /** Stop all watchers on this folder */
  stopAllWatching(): void;

  /** Check if this folder is being watched */
  readonly isWatching: boolean;

  /** Event fired when this folder's contents change */
  readonly onFolderChange: IEvent<IWatchableFolder, IStorageChangeEvent>;
}

/**
 * Interface for receiving WebSocket notifications and converting to storage events.
 * Used by HttpStorage to bridge WebSocket messages to storage events.
 */
export interface INotificationReceiver {
  /** Connect to the WebSocket notification endpoint */
  connect(url: string, authToken?: string): Promise<void>;

  /** Disconnect from the WebSocket endpoint */
  disconnect(): void;

  /** Subscribe to specific event types */
  subscribe(eventNames: string[], slot?: number): Promise<void>;

  /** Unsubscribe from event types */
  unsubscribe(eventNames: string[]): Promise<void>;

  /** Check if connected to the notification server */
  readonly isConnected: boolean;
}
