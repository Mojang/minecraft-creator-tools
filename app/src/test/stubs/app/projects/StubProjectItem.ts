// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectItem from "../../../../app/ProjectItem";
import { ProjectItemType, ProjectItemStorageType } from "../../../../app/IProjectItemData";
import Project from "../../../../app/Project";
import IFile from "../../../../storage/IFile";
import IFolder from "../../../../storage/IFolder";
import IProjectItemUnfulfilledRelationship from "../../../../app/IProjectItemUnfulfilledRelationship";
import { createStubProject } from "./StubProject";
import Pack from "../../../../minecraft/Pack";

export interface StubProjectItemOptions {
  /** JSON returned by getContentAsJson() — for project-level generators that call it directly. */
  json?: object | null;
  itemType?: ProjectItemType;
  project?: Project;
  /**
   * File returned by loadFileContent() and exposed as primaryFile.
   * When omitted, loadFileContent() returns undefined (simulating a read failure).
   */
  file?: IFile;
  /** item.name — used by generators that match on file names (e.g. "blocks.json"). */
  name?: string;
  /** item.projectPath — used by generators that inspect the path (e.g. forbidden file checks). */
  projectPath?: string;
  /**
   * Whether the item reports itself as already loaded.
   * Defaults to true so generators skip the loadContent() call.
   */
  isContentLoaded?: boolean;
  /** Override item.getFolder() — used by generators that check the parent folder name. */
  getFolder?: () => IFolder | { name: string } | null;
  /**
   * Override item.getPack() — used by CheckSkinPackJsonGenerator.
   * Return the pack this item belongs to (or null to simulate a missing pack).
   */
  getPack?: () => Promise<Pack | null>; /** Override item.getCommunitySchemaPath() — used by CommunitySchemaItemInfoGenerator. */
  getCommunitySchemaPath?: () =>
    | string
    | null
    | undefined; /** Override item.getFormPath() — used by FormSchemaItemInfoGenerator. */
  getFormPath?: () => string | undefined;
  /** Override item.getOfficialSchemaPath() — used by JsonSchemaItemInfoGenerator. */
  getOfficialSchemaPath?: () => string | undefined;
  /** Override item.storageType — used by LineSizeInfoGenerator. Defaults to singleFile. */
  storageType?: ProjectItemStorageType;
  /** Override item.getJsonObject() — used by PackInfoGenerator and PackMetaDataInfoGenerator. */
  getJsonObject?: () => Promise<object | undefined>;
  /** Unfulfilled item relationships — used by UnlinkedItemInfoGenerator. */
  unfulfilledRelationships?: IProjectItemUnfulfilledRelationship[];
  /** String content returned by getStringContent() — used by WorldDataInfoGenerator for MCFunction items. */
  stringContent?: string;
  /** Override item.ensureStorage() — used by generators that call it before accessing primaryFile. Defaults to a no-op. */
  ensureStorage?: () => Promise<void>;
}

/**
 * Creates a minimal ProjectItem stub for unit testing generators.
 * Populates the properties generators typically access:
 * getContentAsJson(), itemType, project, loadFileContent(), primaryFile,
 * name, projectPath, isContentLoaded, loadContent(), and getFolder().
 */
export function createStubProjectItem(options: StubProjectItemOptions = {}): ProjectItem {
  return {
    itemType: options.itemType ?? ProjectItemType.resourcePackManifestJson,
    project: options.project ?? createStubProject(),
    name: options.name ?? "",
    projectPath: options.projectPath,
    isContentLoaded: options.isContentLoaded ?? true,
    getContentAsJson: async () => options.json ?? null,
    loadContent: async () => true,
    loadFileContent: async () => options.file,
    primaryFile: options.file ?? null,
    getFolder: options.getFolder ?? (() => null),
    getPack: options.getPack ?? (async () => null),
    getCommunitySchemaPath: options.getCommunitySchemaPath ?? (() => null),
    getFormPath: options.getFormPath ?? (() => undefined),
    getOfficialSchemaPath: options.getOfficialSchemaPath ?? (() => undefined),
    storageType: options.storageType ?? ProjectItemStorageType.singleFile,
    getJsonObject: options.getJsonObject ?? (async () => options.json ?? undefined),
    unfulfilledRelationships: options.unfulfilledRelationships,
    getStringContent: async () => options.stringContent,
    ensureStorage: options.ensureStorage ?? (async () => {}),
  } as unknown as ProjectItem;
}
