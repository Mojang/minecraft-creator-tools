// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum PackSizeInfoGeneratorTest {
  overallSize = 101,
  fileCount = 102,
  folderCount = 103,
  contentSize = 104,
  contentFileCount = 105,
  contentFolderCount = 106,
  exceedsRecommendedAddonSize = 401,
  exceedsRecommendedPackageSize = 402,

  zipFileCouldNotBeProcessed = 410,
}

export interface IPackSizeInfoGeneratorResults {
  size: number;
  fileCounts: number;
  folderCounts: number;
  contentSize: number;
  contentFileCounts: number;
  contentFolderCounts: number;
}

export default class PackSizeInfoGenerator implements IProjectInfoGenerator {
  id = "PACKSIZE";
  title = "Pack Size Information";
  canAlwaysProcess = true;

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.overallSize = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.overallSize);
    info.fileCounts = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.fileCount);
    info.folderCounts = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.folderCount);
    info.contentSize = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.contentSize);
    info.contentFileCounts = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.contentFileCount);
    info.contentFolderCounts = infoSet.getFirstNumberDataValue(this.id, PackSizeInfoGeneratorTest.contentFolderCount);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const genItems: ProjectInfoItem[] = [];
    const results: IPackSizeInfoGeneratorResults = {
      size: 0,
      fileCounts: 0,
      folderCounts: 0,
      contentSize: 0,
      contentFileCounts: 0,
      contentFolderCounts: 0,
    };

    await this.processFolder(project, await project.ensureProjectFolder(), genItems, contentIndex, results, 0, false);

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.overallSize,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.overallSize),
        undefined,
        results.size
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.fileCount,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.fileCount),
        undefined,
        results.fileCounts
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.folderCount,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.folderCount),
        undefined,
        results.folderCounts
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.contentSize,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.contentSize),
        undefined,
        results.contentSize
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.contentFileCount,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.contentFileCount),
        undefined,
        results.contentFileCounts
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        PackSizeInfoGeneratorTest.contentFolderCount,
        ProjectInfoUtilities.getTitleFromEnum(PackSizeInfoGeneratorTest, PackSizeInfoGeneratorTest.contentFolderCount),
        undefined,
        results.contentFolderCounts
      )
    );

    if (this.performAddOnValidations && results.contentSize > 25000000) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          PackSizeInfoGeneratorTest.exceedsRecommendedAddonSize,
          ProjectInfoUtilities.getTitleFromEnum(
            PackSizeInfoGeneratorTest,
            PackSizeInfoGeneratorTest.exceedsRecommendedAddonSize
          ),
          undefined,
          results.contentSize
        )
      );
    } else if (!this.performAddOnValidations && results.contentSize > 250000000) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          PackSizeInfoGeneratorTest.exceedsRecommendedPackageSize,
          ProjectInfoUtilities.getTitleFromEnum(
            PackSizeInfoGeneratorTest,
            PackSizeInfoGeneratorTest.exceedsRecommendedPackageSize
          ),
          undefined,
          results.contentSize
        )
      );
    }

    return genItems;
  }

  async processFolder(
    project: Project,
    folder: IFolder,
    genItems: ProjectInfoItem[],
    genContentIndex: ContentIndex,
    results: IPackSizeInfoGeneratorResults,
    depth: number,
    isInContent: boolean
  ) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    if (!isInContent && folder.files["manifest.json"]) {
      isInContent = true;
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        results.fileCounts++;

        if (StorageUtilities.isContainerFile(file.fullPath)) {
          let storageFolder = undefined;

          storageFolder = await StorageUtilities.getFileStorageFolder(file);

          if (storageFolder && typeof storageFolder !== "string") {
            await this.processFolder(
              project,
              storageFolder,
              genItems,
              genContentIndex,
              results,
              depth + 1,
              isInContent
            );
          } else if (typeof storageFolder === "string") {
            genItems.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                PackSizeInfoGeneratorTest.zipFileCouldNotBeProcessed,
                ProjectInfoUtilities.getTitleFromEnum(
                  PackSizeInfoGeneratorTest,
                  PackSizeInfoGeneratorTest.exceedsRecommendedPackageSize
                ),
                undefined,
                file.errorStateMessage
              )
            );
          }
        } else {
          if (isInContent) {
            results.contentFileCounts++;

            results.contentSize += file.coreContentLength;
          }

          results.size += file.coreContentLength;
        }
      }
    }

    if ((isInContent && depth < 15) || (!isInContent && depth < 8)) {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus && childFolder.name) {
          results.folderCounts++;

          if (isInContent) {
            results.contentFolderCounts++;
          }

          await this.processFolder(project, childFolder, genItems, genContentIndex, results, depth + 1, isInContent);
        }
      }
    }
  }
}
