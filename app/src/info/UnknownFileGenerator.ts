import ProjectInfoItem from "./ProjectInfoItem";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectInfoSet from "./ProjectInfoSet";
import Project from "../app/Project";

export default class UnknownFileGenerator implements IProjectFileInfoGenerator {
  id = "UNKFILE";
  title = "Unknown files";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (!StorageUtilities.isUsableFile(file.storageRelativePath)) {
      const ext = StorageUtilities.getTypeFromName(file.name);

      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          2,
          `Unknown type ${ext} file ${file.storageRelativePath} found`,
          project.getItemByExtendedOrStoragePath(file.extendedPath),
          file.extendedPath
        )
      );
    }

    return items;
  }
}
