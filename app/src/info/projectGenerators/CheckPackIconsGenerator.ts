import Project from "../../app/Project";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import ProjectInfoItem from "../ProjectInfoItem";
import Pack, { PackType } from "../../minecraft/Pack";
import { InfoItemType } from "../IInfoItemData";
import { isPackIcon, parseImageMetadata } from "../../storage/ImageUtilites";

enum CheckPacksIconsGeneratorTest {
  NoIconFound = 101,
  MultipleIconsFound = 102,
  IconNotValidImage = 103,
  IconNotValidSize = 104,
}

const IconMaxWidth = 256;
const IconMinWidth = 2;

/***********
 * Generator for validating Pack Icons
 *
 * Will ensure:
 *  * exactly 1 icon per pack
 *  * icon is a valid .png
 *  * icon is square
 *  * icon is within size limits
 *
 * @see {@link ../../../public/data/forms/mctoolsval/cpackicon.form.json} for topic definitions
 */
export default class CheckPackIconsGenerator implements IProjectInfoGenerator {
  id: string = "CPACKICON";
  title: string = "Pack Icon";
  canAlwaysProcess = true;

  private severity = InfoItemType.error;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const results: ProjectInfoItem[] = [];

    if (project.isVanillaEditSession) {
      return results;
    }

    for (const pack of project.packs) {
      if (requiresPackIcon(pack)) {
        const result = await this.getResultForPack(pack);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  summarize(): void {}

  private async getResultForPack(pack: Pack): Promise<ProjectInfoItem | null> {
    const icons = await pack.getFiles(isPackIcon);

    if (icons.length === 0) {
      const message = `pack_icon image file not found for ${pack.name}. It must use the .png extension.`;
      return this.createResult(CheckPacksIconsGeneratorTest.NoIconFound, message);
    } else if (icons.length > 1) {
      const message = `Found multiple pack icon files for ${pack.name}, there should be only one.`;
      return this.createResult(CheckPacksIconsGeneratorTest.MultipleIconsFound, message);
    }

    const file = icons[0];
    const image = await parseImageMetadata(file);

    if (!image?.ImageWidth || !image?.ImageHeight) {
      const message = `Pack Image (${file.name}) is not valid`;
      return this.createResult(CheckPacksIconsGeneratorTest.IconNotValidImage, message);
    }

    if (this.isValidSize(image.ImageWidth, image.ImageHeight)) {
      const message = `pack_icon must be square with size 2, 4, 8, 16, 32, 64, 128, or 256. Found [${image.ImageWidth} x ${image.ImageHeight}] on ${file.name}`;
      return this.createResult(CheckPacksIconsGeneratorTest.IconNotValidSize, message);
    }

    return null;
  }

  private createResult(test: CheckPacksIconsGeneratorTest, message: string) {
    return new ProjectInfoItem(this.severity, this.id, test, message);
  }

  private isValidSize(width: number, height: number) {
    return width !== height || width < IconMinWidth || width > IconMaxWidth || (width & (width - 1)) !== 0;
  }
}
function requiresPackIcon(pack: Pack): pack is Pack {
  return pack.packType !== PackType.skin && pack.packType !== PackType.design;
}
