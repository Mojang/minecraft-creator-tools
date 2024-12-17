// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "./IFolder";
import IStorage from "./IStorage";
import IStorageObject from "./IStorageObject";
import { EncodingType } from "./StorageUtilities";

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

  isBinary: boolean;
  isString: boolean;

  parentFolder: IFolder;

  type: string;

  dispose(): void;
  unload(): void;

  getHash(): Promise<string | undefined>;
  getRelativePathFor(file: IFile): string | undefined;
  deleteThisFile(skipRemoveFromParent?: boolean): Promise<boolean>;
  moveTo(newStorageRelativePath: string): Promise<boolean>;
  exists(): Promise<boolean>;
  getRootRelativePath(): string | undefined;
  getFolderRelativePath(toFolder: IFolder): string | undefined;
  loadContent(force?: boolean, forceEncoding?: EncodingType): Promise<Date>;
  setContent(content: string | Uint8Array): void;
  saveContent(force?: boolean): Promise<Date>;
}
