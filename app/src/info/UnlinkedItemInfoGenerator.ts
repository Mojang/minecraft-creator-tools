// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";

import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { InfoItemType } from "./IInfoItemData";
import Database from "../minecraft/Database";
import { ProjectItemType } from "../app/IProjectItemData";

export enum UnlinkedItemInfoGeneratorTest {
  unlinkedItemIsNotUsed = 191,
  itemNotFoundInPack = 204,
  avoidLinksToVanillaItems = 205,
}

export default class UnlinkedItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "UNLINK";
  title = "Unlinked item info generator";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.unfulfilledRelationships) {
      for (const rel of projectItem.unfulfilledRelationships) {
        if (rel.isVanillaDependent) {
          // UNLINK205
          items.push(
            new ProjectInfoItem(
              InfoItemType.recommendation,
              this.id,
              UnlinkedItemInfoGeneratorTest.avoidLinksToVanillaItems,
              `Link to vanilla ` +
                ProjectItemUtilities.getDescriptionForType(rel.itemType) +
                ` item; avoid if possible`,
              projectItem,
              rel.path
            )
          );
        } else {
          // UNLINK204
          items.push(
            new ProjectInfoItem(
              InfoItemType.warning,
              this.id,
              UnlinkedItemInfoGeneratorTest.itemNotFoundInPack,
              `Link to ` +
                ProjectItemUtilities.getDescriptionForType(rel.itemType).toLowerCase() +
                ` is not found in this pack`,
              projectItem,
              rel.path
            )
          );
        }
      }
    }

    if (projectItem.itemType === ProjectItemType.texture || projectItem.itemType === ProjectItemType.audio) {
      if (projectItem.parentItemCount <= 0 && projectItem.childItemCount <= 0) {
        const path = projectItem.getPackRelativePath();

        if (path) {
          const isVanilla = await Database.matchesVanillaPath(path);

          if (!isVanilla) {
            // UNLINK191
            items.push(
              new ProjectInfoItem(
                InfoItemType.warning,
                this.id,
                UnlinkedItemInfoGeneratorTest.unlinkedItemIsNotUsed,
                ProjectItemUtilities.getDescriptionForType(projectItem.itemType) +
                  ` does not have any items in this pack that are using this.`,
                projectItem
              )
            );
          }
        }
      }
    }

    return items;
  }
}
