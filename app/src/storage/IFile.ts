// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IStorage from "./IStorage";
import IStorageObject from "./IStorageObject";
import IVersionContent from "./IVersionContent";
import { EncodingType } from "./StorageUtilities";
import { IEvent } from "ste-events";

export enum FileUpdateType {
  regularEdit = 0,
  versionlessEdit = 1,
  externalChange = 2,
  versionRestoration = 3, // we're shifting to a different version (backwards or forwards); do not modify the prior version list
  versionRestorationRetainCurrent = 4, // we're restoring to a prior version, but add the current content to the prior version list
}

export default interface IFile extends IStorageObject {
  modified: Date | null;
  modifiedAtLoad: Date | null;
  latestModified: Date | null;
  content: string | Uint8Array | null;
  lastLoadedOrSaved: Date | null;
  isContentLoaded: boolean;
  needsSave: boolean;
  fileContainerStorage: IStorage | null;
  extendedPath: string;
  readonly coreContentLength: number;
  readonly type: string;
  onFileContentUpdated: IEvent<IFile, IFile>;
  priorVersions: IVersionContent[];
  isInErrorState?: boolean;
  errorStateMessage?: string;

  isBinary: boolean;
  isString: boolean;
  canIgnore: boolean;

  parentFolder: IFolder;

  dispose(): void;
  unload(): void;

  scanForChanges(): Promise<void>;

  getHash(): Promise<string | undefined>;
  getRelativePathFor(file: IFile): string | undefined;
  deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean>;
  moveTo(newStorageRelativePath: string): Promise<boolean>;
  exists(): Promise<boolean>;
  getRootRelativePath(): string | undefined;
  getFolderRelativePath(toFolder: IFolder): string | undefined;
  loadContent(force?: boolean, forceEncoding?: EncodingType): Promise<Date>;
  setObjectContentIfSemanticallyDifferent(
    value: object | null | undefined,
    updateType?: FileUpdateType,
    sourceId?: string
  ): boolean;
  setContentIfSemanticallyDifferent(
    content: string | Uint8Array,
    updateType?: FileUpdateType,
    sourceId?: string
  ): boolean;
  setContent(content: string | Uint8Array, updateType?: FileUpdateType, sourceId?: string): boolean;
  saveContent(force?: boolean): Promise<Date>;
}
