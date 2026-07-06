// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Pack from "../../../../minecraft/Pack";
import ProjectItem from "../../../../app/ProjectItem";
import { PackType } from "../../../../minecraft/Pack";
import IFile from "../../../../storage/IFile";

export interface StubPackOptions {
  items?: ProjectItem[];
  packType?: PackType;
  /** Project path for the pack root item. */
  projectPath?: string;
  /** Pack name — used in error messages (e.g. CheckPackIconsGenerator, CheckProjectIntegrityGenerator). */
  name?: string;
  /**
   * Return value for pack.hasVibrantVisualsContent() — used by CheckManifestGenerator's per-pack
   * VV/PBR scoping. Defaults to false.
   */
  hasVibrantVisualsContent?: boolean;
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
    projectItem: { projectPath: options.projectPath ?? "" } as unknown as ProjectItem,
    getPackItems: () => options.items ?? [],
    hasVibrantVisualsContent: () => options.hasVibrantVisualsContent ?? false,
    getFiles: options.getFiles ?? (async () => []),
  } as unknown as Pack;
}
