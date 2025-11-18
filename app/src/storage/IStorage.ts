// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
