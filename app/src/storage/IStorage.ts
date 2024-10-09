// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IFile from "./IFile";
import { IEvent } from "ste-events";

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

export default interface IStorage {
  rootFolder: IFolder;
  storagePath: string | undefined;

  readonly folderDelimiter: string;

  onFileAdded: IEvent<IStorage, IFile>;
  onFileRemoved: IEvent<IStorage, string>;
  onFileContentsUpdated: IEvent<IStorage, IFile>;
  onFolderMoved: IEvent<IStorage, IFolderMove>;

  errorStatus?: StorageErrorStatus;
  errorMessage?: string;

  channelId?: string;

  isContentUpdated: boolean;
  readOnly: boolean;

  resetContentUpdated(): void;

  notifyFileContentsUpdated(file: IFile): void;

  joinPath(pathA: string, pathB: string): string;
  ensureFolderFromStorageRelativePath(path: string): Promise<IFolder>;
}
