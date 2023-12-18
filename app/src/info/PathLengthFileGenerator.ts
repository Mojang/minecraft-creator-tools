import ProjectInfoItem from "./ProjectInfoItem";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFile from "../storage/IFile";
import ProjectInfoSet from "./ProjectInfoSet";
import Project from "../app/Project";

export default class PathLengthFileGenerator implements IProjectFileInfoGenerator {
  id = "PATHLENGTH";
  title = "Path Length";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const path = file.storageRelativePath;

    const fSlashSegments = path.split("/");
    const bSlashSegments = path.split("\\");

    if (fSlashSegments.length > 9 || bSlashSegments.length > 9) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          2,
          `File path contains more than 9 directory segments, and may not run on all devices`,
          project.getItemByExtendedOrStoragePath(file.extendedPath),
          file.storageRelativePath
        )
      );
    }

    if (path.length > 79) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          3,
          `File path contains more than 79 characters, and may not run on all devices`,
          project.getItemByExtendedOrStoragePath(file.extendedPath),
          file.storageRelativePath
        )
      );
    }

    return items;
  }
}
