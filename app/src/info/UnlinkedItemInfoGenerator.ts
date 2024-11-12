// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";

import ProjectInfoSet from "./ProjectInfoSet";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ContentIndex from "../core/ContentIndex";
import ProjectItemUtilities from "../app/ProjectItemUtilities";

export default class UnlinkedItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "UNLINK";
  title = "Unlinked item info generator";

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
          items.push(
            new ProjectInfoItem(
              InfoItemType.recommendation,
              this.id,
              205,
              `Link to vanilla ` +
                ProjectItemUtilities.getDescriptionForType(rel.itemType) +
                ` item; avoid if possible`,
              projectItem,
              rel.path
            )
          );
        } else {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              204,
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
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            191,
            ProjectItemUtilities.getDescriptionForType(projectItem.itemType) +
              ` does not have any items in this pack that are using this.`,
            projectItem
          )
        );
      }
    }

    return items;
  }
}
