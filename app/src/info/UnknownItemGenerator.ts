import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum UnknownItemGeneratorTest {
  unknownItemTypeFound,
}

export default class UnknownFileGenerator implements IProjectInfoItemGenerator {
  id = "UNKJSON";
  title = "Unknown JSON";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(UnknownItemGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.itemType === ProjectItemType.json) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          UnknownItemGeneratorTest.unknownItemTypeFound,
          "Unknown JSON file found",
          projectItem
        )
      );
    }

    return items;
  }
}
