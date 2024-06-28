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
import TextureInfoGenerator from "./TextureInfoGenerator";
import { Exifr } from "exifr";

export default class TextureImageInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTUREIMAGE";
  title = "Texture Image Validation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Texture Images" };

      case 401:
        return { title: "Image Processing Error" };

      default:
        return { title: topicId.toString() };
    }
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedNumberValue(this.id, 1);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const textureImagePi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Texture Images");
    items.push(textureImagePi);

    const rpFolder = await Database.loadDefaultResourcePack();

    for (const projectItem of project.items) {
      if (projectItem.itemType === ProjectItemType.texture) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          let pathInRp = projectItem.getPackRelativePath();
          let isVanilla = false;

          // Log.assertDefined(pathInRp, "TIIGGP");

          if (pathInRp) {
            pathInRp = StorageUtilities.getBaseFromName(StorageUtilities.ensureNotStartsWithDelimiter(pathInRp));
            if (await TextureInfoGenerator.matchesVanillaPath(pathInRp, rpFolder)) {
              textureImagePi.incrementFeature("Vanilla Override Texture");
              isVanilla = true;
            } else {
              textureImagePi.incrementFeature("Custom Texture");
            }
          } else {
            textureImagePi.incrementFeature("Custom Texture");
          }

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
                  401,
                  `Error processing image`,
                  projectItem,
                  e.toString()
                )
              );
            }
          }
        }
      }
    }

    return items;
  }
}
