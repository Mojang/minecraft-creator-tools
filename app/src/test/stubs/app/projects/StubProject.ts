// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../../../../app/Project";
import ProjectItem from "../../../../app/ProjectItem";
import Pack from "../../../../minecraft/Pack";
import IFile from "../../../../storage/IFile";
import IFolder from "../../../../storage/IFolder";
import { ProjectItemType } from "../../../../app/IProjectItemData";
import { createStubFolder } from "../io/StubFolder";

export interface StubProjectOptions {
  /** Files reported as unknown/orphaned by the project (used by CheckProjectIntegrityGenerator). */
  unknownFiles?: IFile[];
  /** Controls project.isMinecraftCreator (used by geometry and skin pack generators). */
  isMinecraftCreator?: boolean;
  /** Stub for getDefaultBehaviorPackFolder — return null to skip folder-level checks. */
  getDefaultBehaviorPackFolder?: () => Promise<IFolder | null>;
  /** Stub for getDefaultResourcePackFolder — return null to skip folder-level checks. */
  getDefaultResourcePackFolder?: () => Promise<IFolder | null>;
  /** project.projectFolder — used by JsonFileTagsInfoGenerator. */
  projectFolder?: IFolder;
  /** Stub for ensureProjectFolder() — used by PackSizeInfoGenerator. */
  ensureProjectFolder?: () => Promise<IFolder>;
}

/**
 * Creates a minimal Project stub for unit testing.
 * Pass items to populate the project for generators that call getItemsCopy() or getItemsByType().
 * Pass packs for generators that iterate project.packs.
 * Expand options as generators under test require additional Project behaviour.
 */
export function createStubProject(
  items: ProjectItem[] = [],
  packs: Pack[] = [],
  options: StubProjectOptions = {}
): Project {
  return {
    items,
    packs,
    getItemsCopy: () => items,
    getItemsByType: (itemType: ProjectItemType) => items.filter((item) => item.itemType === itemType),
    unknownFiles: options.unknownFiles ?? [],
    isMinecraftCreator: options.isMinecraftCreator ?? false,
    getItemByExtendedOrProjectPath: () => undefined,
    getDefaultBehaviorPackFolder: options.getDefaultBehaviorPackFolder ?? (async () => null),
    getDefaultResourcePackFolder: options.getDefaultResourcePackFolder ?? (async () => null),
    projectFolder: options.projectFolder ?? undefined,
    ensureProjectFolder: options.ensureProjectFolder ?? (async () => createStubFolder()),
    variants: {},
  } as unknown as Project;
}
