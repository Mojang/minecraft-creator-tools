import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemStorageType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import { MaxItemTypes } from "../app/IProjectItemData";
import Utilities from "../core/Utilities";
import ProjectItem from "../app/ProjectItem";
import ProjectInfoSet from "./ProjectInfoSet";

export default class LineSizeInfoGenerator implements IProjectInfoGenerator {
  id = "LINESIZE";
  title = "Line/Size Information";

  getTopicData(topicId: number) {
    if (topicId >= 100) {
      return {
        title: ProjectItem.getDescriptionForType(topicId - 100),
      };
    }

    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const itemsByType: { [index: number]: ProjectInfoItem } = {};
    const lineSizeCounts: number[] = [];

    for (let i = 0; i < MaxItemTypes; i++) {
      lineSizeCounts[i] = 0;
    }

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];
      let projInfoItem = undefined;

      if (itemsByType[pi.itemType] !== undefined) {
        projInfoItem = itemsByType[pi.itemType];
      } else {
        projInfoItem = new ProjectInfoItem(
          InfoItemType.featureAggregate,
          this.id,
          100 + pi.itemType,
          "Linesize Complexity",
          pi
        );
        itemsByType[pi.itemType] = projInfoItem;
        items.push(projInfoItem);
      }

      if (pi.storageType === ProjectItemStorageType.singleFile) {
        let file = await pi.ensureFileStorage();

        if (file) {
          await file.loadContent();

          const content = file.content;

          if (content && content instanceof Uint8Array) {
            projInfoItem.spectrumIntFeature("content-size", content.length);
          } else if (content && typeof content === "string") {
            projInfoItem.spectrumIntFeature("content-size", Utilities.countSignificantLines(content));
          }
        }
      }
    }

    return items;
  }
}
