import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";

export default class UnknownFileGenerator implements IProjectInfoItemGenerator {
  id = "UNKJSON";
  title = "Unknown JSON";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.itemType === ProjectItemType.json) {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 0, "Unknown JSON file found", projectItem)
      );
    }

    return items;
  }
}
