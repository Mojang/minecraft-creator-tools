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

export default class LineSizeInfoGenerator implements IProjectInfoGenerator {
  id = "LINESIZE";
  title = "File Line/Size Information";

  getTopicData(topicId: number) {
    if (topicId >= 100) {
      return {
        title: ProjectItemUtilities.getDescriptionForType(topicId - 100),
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

        projInfoItem = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 100 + pi.itemType, name, pi);
        itemsByType[pi.itemType] = projInfoItem;
        items.push(projInfoItem);
      }

      if (pi.storageType === ProjectItemStorageType.singleFile) {
        let file = await pi.ensureFileStorage();

        if (file) {
          await file.loadContent();

          projInfoItem.spectrumIntFeature("Size", file.coreContentLength);

          const content = file.content;
          if (content && typeof content === "string") {
            projInfoItem.spectrumIntFeature("Lines", Utilities.countSignificantLines(content));
          }
        }
      }
    }

    return items;
  }
}
