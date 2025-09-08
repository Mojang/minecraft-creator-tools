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
  removeUnusedBlockResourceIdentifiers = 1051,
}

export enum BlocksCatalogInfo {
  unusedBlockCatalogResource = 100,
  foundBlockCatalogResource = 101,
  vanillaOverrideBlockCatalogResource = 102,
  blockResourceIdentifier = 53,
}

export default class BlocksCatalogManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "BLOCKSCAT";
  title = "Blocks Catalog";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    switch (topicId) {
      case BlocksCatalogInfo.unusedBlockCatalogResource:
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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(pi.primaryFile);

          results.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              BlocksCatalogInfo.foundBlockCatalogResource,
              `Blocks catalog resource found`,
              pi
            )
          );

          if (blocksCatalog) {
            const dependencies = await blocksCatalog.getDependenciesList(project);

            for (const id of dependencies.unused) {
              results.push(
                new ProjectInfoItem(
                  InfoItemType.warning,
                  this.id,
                  BlocksCatalogInfo.unusedBlockCatalogResource,
                  `Blocks catalog resource is not used`,
                  pi,
                  id
                )
              );
            }

            for (const id of dependencies.vanillaOverride) {
              results.push(
                new ProjectInfoItem(
                  InfoItemType.recommendation,
                  this.id,
                  BlocksCatalogInfo.vanillaOverrideBlockCatalogResource,
                  `Overrides vanilla resource, which is not recommended`,
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
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const blocksCatalog = await BlocksCatalogDefinition.ensureOnFile(pi.primaryFile);
          let wasUpdated = false;
          if (blocksCatalog) {
            switch (updateId) {
              case BlocksCatalogUpdate.removeUnusedBlockResourceIdentifiers:
                const dependencies = await blocksCatalog.getDependenciesList(project);

                for (const id of dependencies.unused) {
                  blocksCatalog.removeId(id);

                  wasUpdated = true;
                  results.push(
                    new ProjectUpdateResult(
                      UpdateResultType.updatedFile,
                      this.id,
                      BlocksCatalogUpdate.removeUnusedBlockResourceIdentifiers,
                      "Removed ununused blocks catalog resource",
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
    return [BlocksCatalogUpdate.removeUnusedBlockResourceIdentifiers];
  }
}
