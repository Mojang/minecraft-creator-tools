// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../../ProjectInfoItem";
import Project from "../../../app/Project";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import { InfoItemType } from "../../IInfoItemData";
import ProjectInfoSet from "../../ProjectInfoSet";
import ContentIndex from "../../../core/ContentIndex";
import IFolder from "../../../storage/IFolder";
import StorageUtilities from "../../../storage/StorageUtilities";
import ProjectInfoUtilities from "../../ProjectInfoUtilities";
import {
  IPackFileCountInfoGeneratorResults,
  MaxFolderTraversalDepth,
  PackFileCountInfoGeneratorTest,
  RecommendedMaxFileCount,
} from "./PackFileCountInfoData";

export { PackFileCountInfoGeneratorTest };
export type { IPackFileCountInfoGeneratorResults };

/**
 * Counts the total number of files in a pack/project and warns when the
 * count exceeds the marketplace-recommended maximum. Walks the project
 * folder recursively, descending into container files (.zip/.mcpack/.mcaddon/etc.)
 * the same way PackSizeInfoGenerator does.
 */
export default class PackFileCountInfoGenerator implements IProjectInfoGenerator {
  id = "PACKFILECOUNT";
  title = "Pack File Count";
  canAlwaysProcess = true;

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.fileCount = infoSet.getFirstNumberDataValue(this.id, PackFileCountInfoGeneratorTest.fileCount);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const genItems: ProjectInfoItem[] = [];
    const results: IPackFileCountInfoGeneratorResults = { fileCount: 0, skippedFolderCount: 0 };

    await this.processFolder(await project.ensureProjectFolder(), results, 0);

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackFileCountInfoGeneratorTest.fileCount,
        ProjectInfoUtilities.getTitleFromEnum(PackFileCountInfoGeneratorTest, PackFileCountInfoGeneratorTest.fileCount),
        undefined,
        results.fileCount
      )
    );

    if (results.fileCount > RecommendedMaxFileCount) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.warning,
          this.id,
          PackFileCountInfoGeneratorTest.exceedsRecommendedFileCount,
          `Pack contains ${results.fileCount} files. Marketplace best practices recommend keeping packs under ${RecommendedMaxFileCount} files.`,
          undefined,
          results.fileCount
        )
      );
    }

    // If we stopped descending because of the depth cap, the file count is a lower
    // bound. Surface this instead of silently undercounting.
    if (results.skippedFolderCount > 0) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.warning,
          this.id,
          PackFileCountInfoGeneratorTest.maxTraversalDepthExceeded,
          `Folder nesting exceeded the maximum traversal depth of ${MaxFolderTraversalDepth}; ${results.skippedFolderCount} subfolder(s) were not counted, so the reported file count of ${results.fileCount} is a lower bound. Reduce folder nesting depth.`,
          undefined,
          results.skippedFolderCount
        )
      );
    }

    return genItems;
  }

  async processFolder(folder: IFolder, results: IPackFileCountInfoGeneratorResults, depth: number) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        // Count every file entry (including container files), consistent with PackSizeInfoGenerator.
        results.fileCount++;

        if (StorageUtilities.isContainerFile(file.fullPath)) {
          if (!file.isContentLoaded) {
            await file.loadContent();
          }

          const storageFolder = await StorageUtilities.getFileStorageFolder(file);

          // Honor the same depth cap for container traversal as folder traversal.
          if (storageFolder && typeof storageFolder !== "string" && depth < MaxFolderTraversalDepth) {
            await this.processFolder(storageFolder, results, depth + 1);
          }
        }
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder && !childFolder.errorStatus && childFolder.name) {
        if (depth < MaxFolderTraversalDepth) {
          await this.processFolder(childFolder, results, depth + 1);
        } else {
          // Don't descend further, but record the skip so generate() can warn
          // rather than silently undercounting the files beneath it.
          results.skippedFolderCount++;
        }
      }
    }
  }
}
