// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemStorageType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import { MaxItemTypes } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import ProjectInfoSet from "./ProjectInfoSet";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ContentIndex from "../core/ContentIndex";

const TopicTestIdBase = 100;

export default class LineSizeInfoGenerator implements IProjectInfoGenerator {
  id = "LINESIZE";
  title = "File Line/Size Information";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    if (topicId >= TopicTestIdBase) {
      return {
        title: ProjectItemUtilities.getDescriptionForType(topicId - TopicTestIdBase),
      };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const itemsByType: { [index: number]: ProjectInfoItem } = {};
    const lineSizeCounts: number[] = [];

    for (let i = 0; i < MaxItemTypes; i++) {
      lineSizeCounts[i] = 0;
    }

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];
      let projInfoItem = undefined;

      if (itemsByType[pi.itemType] !== undefined) {
        projInfoItem = itemsByType[pi.itemType];
      } else {
        const name =
          ProjectItemUtilities.getDescriptionForType(pi.itemType) +
          " file " +
          (ProjectItemUtilities.isBinaryType(pi.itemType) ? "size" : "lines");

        projInfoItem = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, TopicTestIdBase + pi.itemType, name);
        itemsByType[pi.itemType] = projInfoItem;
        items.push(projInfoItem);
      }

      if (pi.storageType === ProjectItemStorageType.singleFile) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        const file = pi.primaryFile;

        if (file) {
          if (!file.isContentLoaded) {
            await file.loadContent();
          }

          projInfoItem.spectrumIntFeature("size", file.coreContentLength);

          const content = file.content;
          if (content && typeof content === "string") {
            projInfoItem.spectrumIntFeature("lines", Utilities.countSignificantLines(content));
          }
        }
      }
    }

    return items;
  }
}
