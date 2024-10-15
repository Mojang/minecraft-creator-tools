// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import { MaxItemTypes } from "../app/IProjectItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ContentIndex from "../core/ContentIndex";

export default class ItemCountsInfoGenerator implements IProjectInfoGenerator {
  id = "ITEMS";
  title = "Minimum Definition of a Pack";

  getTopicData(topicId: number) {
    if (topicId > 100 && topicId < 100 + MaxItemTypes) {
      return {
        title: ProjectItemUtilities.getDescriptionForType(topicId - 100) + " count",
      };
    }
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.behaviorPackManifestCount = infoSet.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.behaviorPackManifestJson
    );
    info.unknownJsonCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.json);
    info.entityTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeBehavior);
    info.itemTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.itemTypeBehaviorJson);
    info.blockTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.blockTypeBehavior);
    info.resourcePackManifestCount = infoSet.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.resourcePackManifestJson
    );

    info.worldCount =
      infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.MCWorld) +
      infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.worldFolder);

    info.entityTypeResourceCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeResource);

    info.behaviorPackAnimationCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.animationBehaviorJson);

    info.behaviorPackAnimationControllerCount = infoSet.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.animationControllerBehaviorJson
    );
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const typeCounts: number[] = [];

    for (let i = 0; i < MaxItemTypes; i++) {
      typeCounts[i] = 0;
    }

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      typeCounts[pi.itemType]++;

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        items.push(new ProjectInfoItem(InfoItemType.info, this.id, 2, "Behavior pack manifest found", pi));
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        items.push(new ProjectInfoItem(InfoItemType.info, this.id, 3, "Resource pack manifest found", pi));
      }
    }

    for (let i = 0; i < MaxItemTypes; i++) {
      if (typeCounts[i] > 0) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            100 + i,
            ProjectItemUtilities.getDescriptionForType(i) + " item count",
            undefined,
            typeCounts[i]
          )
        );
      }
    }

    return items;
  }
}
