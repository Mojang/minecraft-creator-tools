// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IConversionSettings from "./IConversionSettings";
import IStorage from "../storage/IStorage";

/**
 * Decoded image data with RGBA pixels
 */
export interface IDecodedImageData {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export enum Platform {
  windows,
  macOS,
  linux,
  unsupported,
}

export default interface ILocalUtilities {
  readonly platform: Platform;

  readonly userDataPath: string;

  readonly localAppDataPath: string;

  readonly roamingAppDataPath: string;

  readonly localReleaseServerLogPath: string;

  readonly localPreviewServerLogPath: string;

  readonly minecraftPath: string;

  readonly minecraftPreviewPath: string;

  readonly minecraftUwpPath: string;

  readonly minecraftPreviewUwpPath: string;

  generateCryptoRandomNumber(toVal: number): number;

  generateUuid(): string;

  validateFolderPath(path: string): void;

  countChar(source: string, find: string): number;

  ensureStartsWithSlash(pathSegment: string): string;

  ensureEndsWithSlash(pathSegment: string): string;

  ensureStartsWithBackSlash(pathSegment: string): string;

  ensureEndsWithBackSlash(pathSegment: string): string;

  readJsonFile(path: string): Promise<object | null>;

  createStorage(path: string): IStorage | null;

  processConversion(settings: IConversionSettings): Promise<boolean>;

  /**
   * Decode PNG image data using Node.js-specific implementation (pngjs).
   * Returns undefined if decoding fails.
   */
  decodePng(data: Uint8Array): IDecodedImageData | undefined;

  /**
   * Encode RGBA pixel data to PNG format using Node.js-specific implementation (pngjs).
   * Returns undefined if encoding fails.
   */
  encodeToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined;
}
