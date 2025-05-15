import Project from "../../app/Project";
import IFile from "../../storage/IFile";
import StorageUtilities from "../../storage/StorageUtilities";
import { InfoItemType } from "../IInfoItemData";
import IProjectFileInfoGenerator from "../IProjectFileInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import ProjectInfoUtilities from "../ProjectInfoUtilities";

enum CheckNoBOMGeneratorTest {
  NoByteOrderMarkAllowedInJsonFile = 101,
}

/**********
 * Generator that generates error results if Byte Order Marks are found within .json files
 *
 *********/
export default class CheckNoBOMGenerator implements IProjectFileInfoGenerator {
  id: string = "NOBOM";
  title: string = "No Byte Order Mark allowed in json file.";
  canAlwaysProcess = true;

  private severity = InfoItemType.error;

  generate(_project: Project, projectFile: IFile): Promise<ProjectInfoItem[]> {
    const results: ProjectInfoItem[] = [];

    if (StorageUtilities.isJsonFile(projectFile) && this.hasByteOrderMark(projectFile)) {
      results.push(this.getNewBOMResult(projectFile));
    }

    return Promise.resolve(results);
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckNoBOMGeneratorTest, topicId),
    };
  }

  summarize(): void {}

  private hasByteOrderMark(file: IFile) {
    const bytes = StorageUtilities.getContentsAsBinary(file);
    const hasBOM = StorageUtilities.hasUTF8ByteOrderMark(bytes);

    return hasBOM;
  }

  private getNewBOMResult(file: IFile) {
    return new ProjectInfoItem(
      this.severity,
      this.id,
      CheckNoBOMGeneratorTest.NoByteOrderMarkAllowedInJsonFile,
      `Byte Order Marks found in file: ${file.name}`
    );
  }
}
