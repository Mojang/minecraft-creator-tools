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
    info.entityTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeBehaviorJson);
    info.itemTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.itemTypeBehaviorJson);
    info.blockTypeManifestCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.blockTypeBehaviorJson);
    info.resourcePackManifestCount = infoSet.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.resourcePackManifestJson
    );

    info.worldCount =
      infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.MCWorld) +
      infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.worldFolder);

    info.entityTypeResourceCount = infoSet.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeResourceJson);

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

    let foundBehaviorPackManifest = false;

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      typeCounts[pi.itemType]++;

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        items.push(new ProjectInfoItem(InfoItemType.info, this.id, 2, "Behavior pack manifest found", pi));

        foundBehaviorPackManifest = true;
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        items.push(new ProjectInfoItem(InfoItemType.info, this.id, 3, "Resource pack manifest found", pi));

        foundBehaviorPackManifest = true;
      }
    }

    /*
    if (!foundBehaviorPackManifest) {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 0, "A behavior pack manifest wasn't found.")
      );
    } else {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 1, "A behavior pack manifest was found.")
      );
    }*/

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
