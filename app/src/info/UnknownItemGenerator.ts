import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";

export enum UnknownItemGeneratorTest {
  unknownItemTypeFound = 101,
}

/**
 * Detects JSON files with unknown or unrecognized structure.
 *
 * @see {@link ../../public/data/forms/mctoolsval/unkjson.form.json} for topic definitions
 */
export default class UnknownItemGenerator implements IProjectInfoItemGenerator {
  id = "UNKJSON";
  title = "Unknown JSON";
  canAlwaysProcess = true;

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (projectItem.itemType === ProjectItemType.unknownJson) {
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
