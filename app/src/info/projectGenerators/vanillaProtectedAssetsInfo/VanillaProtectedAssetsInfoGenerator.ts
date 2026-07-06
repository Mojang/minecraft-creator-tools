// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import Pack, { PackType } from "../../../minecraft/Pack";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import ProjectInfoSet from "../../ProjectInfoSet";
import { resultFromTest } from "../../tests/TestDefinition";
import {
  ProtectedVanillaAssetEntries,
  ProtectedVanillaAssetEntry,
  VanillaProtectedAssetsInfoGeneratorTest,
  VanillaProtectedAssetsTests,
} from "./VanillaProtectedAssetsInfoGeneratorData";

type ProtectedVanillaAssetMatch = {
  entry: ProtectedVanillaAssetEntry;
  item: ProjectItem;
};

/**
 * Reports when creator content overrides specific vanilla assets that are protected
 * by downstream validation services.
 */
export default class VanillaProtectedAssetsInfoGenerator implements IProjectInfoGenerator {
  id = "VANPRO";
  title = "Vanilla Protected Assets";
  canAlwaysProcess = true;

  constructor(private protectedEntries: readonly ProtectedVanillaAssetEntry[] = ProtectedVanillaAssetEntries) {}

  summarize(info: any, infoSet: ProjectInfoSet) {
    const vanillaProtectedAssetOverrides = infoSet.getCount(
      this.id,
      VanillaProtectedAssetsInfoGeneratorTest.protectedVanillaAssetOverride
    );

    if (vanillaProtectedAssetOverrides > 0) {
      info.vanillaProtectedAssetOverrides = vanillaProtectedAssetOverrides;
    }
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const processedItems = new Set<ProjectItem>();
    const matches: ProtectedVanillaAssetMatch[] = [];

    for (const pack of project.packs) {
      for (const item of pack.getPackItems()) {
        processedItems.add(item);

        const match = this.getMatchForPackItem(item, pack);
        if (match) {
          matches.push(match);
        }
      }
    }

    for (const item of project.getItemsCopy()) {
      if (processedItems.has(item)) {
        continue;
      }

      const match = this.getMatchFromBehaviorPackPathHeuristic(item);
      if (match) {
        matches.push(match);
      }
    }

    return matches.map((match) =>
      resultFromTest(VanillaProtectedAssetsTests.protectedVanillaAssetOverride, {
        id: this.id,
        item: match.item,
        data: match.entry.displayPath,
        message: `Protected vanilla asset [${match.entry.displayPath}] should not be overridden by creator content.`,
      })
    );
  }

  private getMatchForPackItem(item: ProjectItem, pack: Pack): ProtectedVanillaAssetMatch | undefined {
    const itemPath = item.projectPath;
    if (!itemPath) {
      return undefined;
    }

    const relativePath = this.getPackRelativePath(itemPath, pack);
    const entry = this.getMatchingEntry(pack.packType, relativePath);

    return entry ? { entry, item } : undefined;
  }

  private getPackRelativePath(itemPath: string, pack: Pack): string {
    const normalizedItemPath = this.normalizePath(itemPath);
    const packRootPath = pack.projectItem?.projectPath;

    if (!packRootPath) {
      return normalizedItemPath;
    }

    const normalizedPackRootPath = this.ensureTrailingSlash(this.normalizePath(packRootPath));
    if (normalizedItemPath.startsWith(normalizedPackRootPath)) {
      return normalizedItemPath.substring(normalizedPackRootPath.length);
    }

    return normalizedItemPath;
  }

  private getMatchFromBehaviorPackPathHeuristic(item: ProjectItem): ProtectedVanillaAssetMatch | undefined {
    const itemPath = item.projectPath;
    if (!itemPath) {
      return undefined;
    }

    const relativePath = this.tryGetBehaviorPackRelativePath(this.normalizePath(itemPath));
    if (!relativePath) {
      return undefined;
    }

    const entry = this.getMatchingEntry(PackType.behavior, relativePath);
    return entry ? { entry, item } : undefined;
  }

  private tryGetBehaviorPackRelativePath(normalizedPath: string): string | undefined {
    const relativePathAfterContainer = this.tryGetRelativePathAfterPackContainer(normalizedPath, "behavior_packs/");
    if (relativePathAfterContainer) {
      return relativePathAfterContainer;
    }

    const relativePathAfterSingularContainer = this.tryGetRelativePathAfterPackContainer(
      normalizedPath,
      "behavior_pack/"
    );
    if (relativePathAfterSingularContainer) {
      return relativePathAfterSingularContainer;
    }

    if (normalizedPath.startsWith("bp/")) {
      return normalizedPath.substring("bp/".length);
    }

    const bpAlias = "/bp/";
    const bpAliasIndex = normalizedPath.indexOf(bpAlias);
    if (bpAliasIndex >= 0) {
      return normalizedPath.substring(bpAliasIndex + bpAlias.length);
    }

    return undefined;
  }

  private tryGetRelativePathAfterPackContainer(normalizedPath: string, containerName: string): string | undefined {
    const containerIndex = normalizedPath.indexOf(containerName);
    if (containerIndex < 0) {
      return undefined;
    }

    const pathAfterContainer = normalizedPath.substring(containerIndex + containerName.length);
    const packFolderBoundary = pathAfterContainer.indexOf("/");

    if (packFolderBoundary < 0 || packFolderBoundary === pathAfterContainer.length - 1) {
      return undefined;
    }

    return pathAfterContainer.substring(packFolderBoundary + 1);
  }

  private getMatchingEntry(packType: PackType, relativePath: string): ProtectedVanillaAssetEntry | undefined {
    return this.protectedEntries.find(
      (entry) => entry.packType === packType && relativePath.startsWith(this.normalizeProtectedPath(entry.protectedPath))
    );
  }

  private normalizeProtectedPath(path: string): string {
    return this.ensureTrailingSlash(this.normalizePath(path));
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/gi, "/").replace(/^\/+/, "").toLowerCase();
  }

  private ensureTrailingSlash(path: string): string {
    return path.endsWith("/") ? path : path + "/";
  }
}
