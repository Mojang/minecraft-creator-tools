// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import { UpdateResultType } from "../updates/IUpdateResult";
import { IProjectInfoTopicData } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";

export enum BlocksCatalogUpdate {
  RemoveUnusedBlockResourceIdentifiers = 1051,
}

export enum BlocksCatalogInfo {
  UnusedBlockCatalogResource = 100,
  FoundBlockCatalogResource = 101,
  BlockResourceIdentifier = 53,
}

export default class BlocksCatalogManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "BLOCKSCAT";
  title = "Blocks Catalog";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    switch (topicId) {
      case BlocksCatalogInfo.UnusedBlockCatalogResource:
        return {
          title: "Block Resource Identifier",
        };
    }
    return {
      title: topicId.toString(),
    };
  }

  getUpdaterData(updaterId: number) {
    return {
      title: updaterId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const results: ProjectInfoItem[] = [];
    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.blocksCatalogResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(pi.file);

          results.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              BlocksCatalogInfo.FoundBlockCatalogResource,
              `Blocks catalog resource found.`,
              pi
            )
          );

          if (blocksCatalog) {
            const unusedIds = await blocksCatalog.getUnusedDependencies(project);

            for (const id of unusedIds) {
              blocksCatalog.removeId(id);

              results.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  BlocksCatalogInfo.UnusedBlockCatalogResource,
                  `Blocks catalog resource is not used.`,
                  pi,
                  id
                )
              );
            }
          }
        }
      }
    }

    return results;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];
    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.blocksCatalogResourceJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(pi.file);
          let wasUpdated = false;
          if (blocksCatalog) {
            switch (updateId) {
              case BlocksCatalogUpdate.RemoveUnusedBlockResourceIdentifiers:
                const unusedIds = await blocksCatalog.getUnusedDependencies(project);

                for (const id of unusedIds) {
                  blocksCatalog.removeId(id);

                  wasUpdated = true;
                  results.push(
                    new ProjectUpdateResult(
                      UpdateResultType.updatedFile,
                      this.id,
                      BlocksCatalogUpdate.RemoveUnusedBlockResourceIdentifiers,
                      "Removed ununused blocks catalog resource.",
                      pi,
                      id
                    )
                  );
                }
                break;
            }
          }

          if (wasUpdated) {
            blocksCatalog?.persist();
          }
        }
      }
    }

    return results;
  }

  getUpdateIds() {
    return [BlocksCatalogUpdate.RemoveUnusedBlockResourceIdentifiers];
  }
}
