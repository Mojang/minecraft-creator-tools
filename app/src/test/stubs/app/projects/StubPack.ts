// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Pack from "../../../../minecraft/Pack";
import ProjectItem from "../../../../app/ProjectItem";
import { PackType } from "../../../../minecraft/Pack";
import IFile from "../../../../storage/IFile";

export interface StubPackOptions {
  items?: ProjectItem[];
  packType?: PackType;
  /** Pack name — used in error messages (e.g. CheckPackIconsGenerator, CheckProjectIntegrityGenerator). */
  name?: string;
  /**
   * Override for pack.getFiles() — used by CheckPackIconsGenerator.
   * Return the files you want the generator to see (predicate already applied).
   */
  getFiles?: (predicate?: (file: IFile) => boolean) => Promise<IFile[]>;
}

/**
 * Creates a minimal Pack stub for unit testing generators that iterate project.packs.
 */
export function createStubPack(options: StubPackOptions = {}): Pack {
  return {
    packType: options.packType ?? PackType.resource,
    name: options.name ?? "test-pack",
    getPackItems: () => options.items ?? [],
    getFiles: options.getFiles ?? (async () => []),
  } as unknown as Pack;
}
