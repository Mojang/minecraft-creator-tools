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

const TopicTestIdBase = 200;

export enum ItemCountsInfoGeneratorTest {
  behaviorPackManifest = 102,
  resourcePackManifest = 103,
}

export default class ItemCountsInfoGenerator implements IProjectInfoGenerator {
  id = "ITEMS";
  title = "Minimum Definition of a Pack";

  getTopicData(topicId: number) {
    if (topicId > TopicTestIdBase && topicId < TopicTestIdBase + MaxItemTypes) {
      return {
        title: ProjectItemUtilities.getDescriptionForType(topicId - TopicTestIdBase) + " count",
      };
    }
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.behaviorPackManifestCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.behaviorPackManifestJson
    );
    info.unknownJsonCount = infoSet.getFirstNumberDataValue(this.id, TopicTestIdBase + ProjectItemType.unknownJson);
    info.entityTypeManifestCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.entityTypeBehavior
    );
    info.itemTypeManifestCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.itemTypeBehavior
    );
    info.blockTypeManifestCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.blockTypeBehavior
    );
    info.resourcePackManifestCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.resourcePackManifestJson
    );

    info.worldCount =
      infoSet.getFirstNumberDataValue(this.id, TopicTestIdBase + ProjectItemType.MCWorld) +
      infoSet.getFirstNumberDataValue(this.id, TopicTestIdBase + ProjectItemType.worldFolder);

    info.entityTypeResourceCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.entityTypeResource
    );

    info.behaviorPackAnimationCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.animationBehaviorJson
    );

    info.behaviorPackAnimationControllerCount = infoSet.getFirstNumberDataValue(
      this.id,
      TopicTestIdBase + ProjectItemType.animationControllerBehaviorJson
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
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            ItemCountsInfoGeneratorTest.behaviorPackManifest,
            "Behavior pack manifest found",
            pi
          )
        );
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            ItemCountsInfoGeneratorTest.resourcePackManifest,
            "Resource pack manifest found",
            pi
          )
        );
      }
    }

    for (let i = 0; i < MaxItemTypes; i++) {
      if (typeCounts[i] > 0) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            TopicTestIdBase + i,
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
