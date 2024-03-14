// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IStorage from "../storage/IStorage";

export default interface ILocalUtilities {
  readonly userDataPath: string;

  readonly localAppDataPath: string;

  readonly localServerLogPath: string;

  readonly minecraftPath: string;

  readonly minecraftPreviewPath: string;

  generateCryptoRandomNumber(toVal: number): number;

  validateFolderPath(path: string): void;

  countChar(source: string, find: string): number;

  ensureStartsWithSlash(pathSegment: string): string;

  ensureEndsWithSlash(pathSegment: string): string;

  ensureStartsWithBackSlash(pathSegment: string): string;

  ensureEndsWithBackSlash(pathSegment: string): string;

  readJsonFile(path: string): Promise<object | null>;
  createStorage(path: string): Promise<IStorage | null>;
}
