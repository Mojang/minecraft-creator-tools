import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectItem from "../app/ProjectItem";
import { MaxItemTypes } from "../app/IProjectItemData";

export default class ItemCountsInfoGenerator implements IProjectInfoGenerator {
  id = "ITEMS";
  title = "Minimum Definition of a Pack";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
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

    if (!foundBehaviorPackManifest) {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 0, "A behavior pack manifest wasn't found.")
      );
    } else {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 1, "A behavior pack manifest was found.")
      );
    }

    for (let i = 0; i < MaxItemTypes; i++) {
      if (typeCounts[i] > 0) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.info,
            this.id,
            100 + i,
            ProjectItem.getDescriptionForType(i) + " item count",
            undefined,
            typeCounts[i]
          )
        );
      }
    }

    return items;
  }
}
