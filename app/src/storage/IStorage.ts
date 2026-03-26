// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * IStorage.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This file defines the core storage abstraction interface used throughout MCTools.
 * IStorage represents a virtual file system that can be backed by:
 * - Local file system (NodeStorage)
 * - HTTP/HTTPS endpoints (HttpStorage)
 * - ZIP files (ZipStorage)
 * - Browser local storage (BrowserStorage)
 * - VS Code file system (VsFsStorage)
 * - Virtual/composite folders (VirtualFolderStorage)
 *
 * EVENTS (used for real-time synchronization):
 * --------------------------------------------
 * - onFileAdded: Fired when a new file is detected
 * - onFileRemoved: Fired when a file is deleted
 * - onFileContentsUpdated: Fired when file content changes
 * - onFolderMoved: Fired when a folder is renamed/moved
 * - onFolderAdded: Fired when a new folder is created (added for watcher support)
 * - onFolderRemoved: Fired when a folder is deleted (added for watcher support)
 *
 * These events enable the real-time sync pipeline:
 *   NodeStorage -> HttpServer (WebSocket) -> HttpStorage -> MCWorld -> WorldView
 *
 * RELATED FILES:
 * --------------
 * - IStorageWatcher.ts: Watcher interface extensions
 * - StorageBase.ts: Base implementation with event dispatchers
 * - NodeStorage.ts: File system watcher implementation
 * - HttpStorage.ts: WebSocket notification receiver
 */

import IFolder from "./IFolder";
import IFile, { FileUpdateType } from "./IFile";
import { IEvent } from "ste-events";
import IVersionContent from "./IVersionContent";

export enum StorageErrorStatus {
  none = 0,
  unprocessable = 1,
  notPresent = 2,
}

export interface IFolderMove {
  previousStoragePath?: string;
  newStoragePath: string;
  folder: IFolder;
}

export interface IFileUpdateEvent {
  file: IFile;
  updateType: FileUpdateType;
  sourceId?: string;
  priorVersion?: IVersionContent;
}

export default interface IStorage {
  rootFolder: IFolder;
  storagePath: string | undefined;

  containerFile?: IFile;

  getUsesPollingBasedUpdating(): boolean;

  readonly folderDelimiter: string;

  priorVersions: IVersionContent[];
  currentVersionId?: string;

  onFileAdded: IEvent<IStorage, IFile>;
  onFileRemoved: IEvent<IStorage, string>;
  onFileContentsUpdated: IEvent<IStorage, IFileUpdateEvent>;
  onFolderMoved: IEvent<IStorage, IFolderMove>;
  /** Event fired when a folder is added (for watcher support) */
  onFolderAdded: IEvent<IStorage, IFolder>;
  /** Event fired when a folder is removed (for watcher support) */
  onFolderRemoved: IEvent<IStorage, string>;

  errorStatus?: StorageErrorStatus;
  errorMessage?: string;

  channelId?: string;

  isContentUpdated: boolean;
  readOnly: boolean;

  available?: boolean;
  getAvailable(): Promise<boolean>;

  resetContentUpdated(): void;

  incrementalScanForChanges(): Promise<void>;

  scanForChanges(): Promise<void>;

  addVersion(versionContent: IVersionContent, updateType: FileUpdateType): void;
  trimAfterVersion(versionId: string): void;
  setToVersion(versionId: string): void;

  notifyFileContentsUpdated(fileEvent: IFileUpdateEvent): void;

  joinPath(pathA: string, pathB: string): string;
  ensureFolderFromStorageRelativePath(path: string): Promise<IFolder>;
}
