// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import Database from "../minecraft/Database";
import StorageUtilities from "../storage/StorageUtilities";
import ContentIndex from "../core/ContentIndex";
import { Exifr } from "exifr";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

export enum TextureImageInfoGeneratorTest {
  textureImages = 1,
  imageProcessingError = 401,
}

export default class TextureImageInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTUREIMAGE";
  title = "Texture Image Validation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(TextureImageInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedNumberValue(this.id, 1);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const textureImagePi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      TextureImageInfoGeneratorTest.textureImages,
      "Texture Images"
    );

    items.push(textureImagePi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.texture) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          let pathInRp = projectItem.getPackRelativePath();
          let isVanilla = false;

          // Log.assertDefined(pathInRp, "TIIGGP");

          if (pathInRp) {
            pathInRp = StorageUtilities.getBaseFromName(StorageUtilities.ensureNotStartsWithDelimiter(pathInRp));
            if (await Database.matchesVanillaPath(pathInRp)) {
              textureImagePi.incrementFeature("Vanilla Override Texture");
              isVanilla = true;
            } else {
              textureImagePi.incrementFeature("Custom Texture");
            }
          } else {
            textureImagePi.incrementFeature("Custom Texture");
          }

          if (projectItem.file.type !== "tga") {
            await projectItem.file.loadContent();

            if (projectItem.file.content && projectItem.file.content instanceof Uint8Array) {
              const exifr = new Exifr({});

              try {
                await exifr.read(projectItem.file.content);

                const results = await exifr.parse();

                if (results.ImageWidth && results.ImageHeight) {
                  textureImagePi.spectrumIntFeature("ImageWidth", results.ImageWidth);
                  textureImagePi.spectrumIntFeature("ImageHeight", results.ImageHeight);
                  textureImagePi.spectrumIntFeature("ImageSize", results.ImageWidth * results.ImageHeight);

                  if (!isVanilla) {
                    textureImagePi.spectrumIntFeature("NonVanillaImageSize", results.ImageWidth * results.ImageHeight);
                  }
                }
              } catch (e: any) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    TextureImageInfoGeneratorTest.imageProcessingError,
                    `Error processing image`,
                    projectItem,
                    e.toString()
                  )
                );
              }
            }

            projectItem.file.unload();
          }
        }
      }
    }

    return items;
  }
}
