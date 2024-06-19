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

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return {
          title: "Overall Size",
        };
      case 2:
        return {
          title: "Overall File Count",
        };
      case 3:
        return {
          title: "Overall Folder Count",
        };
      case 4:
        return {
          title: "Content Size",
        };
      case 5:
        return {
          title: "Content File Count",
        };
      case 6:
        return {
          title: "Content Folder Count",
        };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.overallSize = infoSet.getFirstNumberValue(this.id, 1);
    info.fileCounts = infoSet.getFirstNumberValue(this.id, 2);
    info.folderCounts = infoSet.getFirstNumberValue(this.id, 3);
    info.contentSize = infoSet.getFirstNumberValue(this.id, 4);
    info.contentFileCounts = infoSet.getFirstNumberValue(this.id, 5);
    info.contentFolderCounts = infoSet.getFirstNumberValue(this.id, 6);
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
      new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Overall Size", undefined, results.size)
    );

    genItems.push(
      new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 2, "File Counts", undefined, results.fileCounts)
    );

    genItems.push(
      new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 3, "Folder Counts", undefined, results.folderCounts)
    );

    genItems.push(
      new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 4, "Content Size", undefined, results.contentSize)
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        5,
        "Content File Counts",
        undefined,
        results.contentFileCounts
      )
    );

    genItems.push(
      new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        6,
        "Content Folder Counts",
        undefined,
        results.contentFolderCounts
      )
    );

    if (this.performAddOnValidations && results.contentSize > 25000000) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          401,
          "Exceeds recommended addon size",
          undefined,
          results.contentSize
        )
      );
    } else if (!this.performAddOnValidations && results.contentSize > 250000000) {
      genItems.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          402,
          "Exceeds recommended package size",
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
    await folder.load();

    if (!isInContent && folder.files["manifest.json"]) {
      isInContent = true;
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        await file.loadContent();

        results.fileCounts++;

        if (StorageUtilities.isContainerFile(file.fullPath)) {
          const storageFolder = await StorageUtilities.getFileStorageFolder(file);

          if (storageFolder) {
            await this.processFolder(
              project,
              storageFolder,
              genItems,
              genContentIndex,
              results,
              depth + 1,
              isInContent
            );
          }
        } else {
          if (isInContent) {
            results.contentFileCounts++;

            if (file.content) {
              results.contentSize += file.content.length;
            }
          }

          if (file.content) {
            results.size += file.content.length;
          }
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
