import { ProjectItemType } from "../../app/IProjectItemData";
import Project from "../../app/Project";
import Pack from "../../minecraft/Pack";
import { isWorldIcon, parseImageData } from "../../storage/ImageUtilites";
import { InfoItemType } from "../IInfoItemData";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import ProjectInfoUtilities from "../ProjectInfoUtilities";

const DefaultEduImageWidth = 480;
const DefaultEduImageHeight = 270;
const DefaultBedrockImageWidth = 800;
const DefaultBedrockImageHeight = 450;

enum CheckWorldIconsGeneratorTest {
  NoIconFound = 101,
  MultipleIconsFound = 102,
  IconNotValidImage = 103,
  IconNotValidSize = 104,
}

/*
 * Generator for validating World Icons
 *
 * Will ensure:
 *  * exactly 1 icon per pack
 *  * icon is a valid .jpeg
 *  * icon is the correct size
 */
export default class CheckWorldIconsGenerator implements IProjectInfoGenerator {
  id: string = "CWI";
  title: string = "Check World Icon Generator";
  canAlwaysProcess = true;

  private severity = InfoItemType.error;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    if (!shouldHaveWorldIcon(project)) {
      return [];
    }

    const results: ProjectInfoItem[] = [];

    for (const pack of project.packs) {
      const result = await this.getResultForPack(pack);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private async getResultForPack(pack: Pack) {
    const files = await pack.getFiles(isWorldIcon);

    if (files.length === 0) {
      return this.createResult(CheckWorldIconsGeneratorTest.NoIconFound, `No World Icon found for ${pack.name}.`);
    } else if (files.length > 1) {
      const message = `Too many World Icons found for ${pack.name}. ${files.length} icons found, expected: 1`;
      return this.createResult(CheckWorldIconsGeneratorTest.MultipleIconsFound, message);
    }

    const file = files[0];
    const image = await parseImageData(file);

    if (!image) {
      const message = `Image (${file.name}) is not valid.`;
      return this.createResult(CheckWorldIconsGeneratorTest.IconNotValidImage, message);
    }

    const isEDUOffer = await pack.isEDUOffer();
    const isSizeCorrect = isEDUOffer ? isSizeCorrectForEDU : isSizeCorrectForBedrock;

    if (!isSizeCorrect({ width: image.ImageWidth, height: image.ImageHeight })) {
      return this.createResult(CheckWorldIconsGeneratorTest.IconNotValidSize, `Image (${file.name}) is not valid.`);
    }

    return null;
  }

  private createResult(test: CheckWorldIconsGeneratorTest, message: string) {
    return new ProjectInfoItem(this.severity, this.id, test, message);
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckWorldIconsGeneratorTest, topicId),
    };
  }

  summarize(): void {}
}

function isSizeCorrectForBedrock(size: { width: number; height: number }) {
  return size.width === DefaultBedrockImageWidth && size.height === DefaultBedrockImageHeight;
}

function isSizeCorrectForEDU(size: { width: number; height: number }) {
  const isEDUSize = size.width === DefaultEduImageWidth && size.height === DefaultEduImageHeight;
  return isEDUSize || isSizeCorrectForBedrock(size);
}

function shouldHaveWorldIcon(project: Project) {
  return !!project.items.find((item) => item.itemType === ProjectItemType.worldTemplateManifestJson);
}
