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
  individualTextureMemoryExceedsBudget = 402,
  totalTextureMemoryExceedsBudget = 403,
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

    let totalTextureMemory = 0;
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
                  const textureMem = Math.pow(2, Math.ceil(Math.log2(results.ImageWidth * results.ImageHeight * 4)));

                  textureImagePi.spectrumIntFeature("Image Width", results.ImageWidth);
                  textureImagePi.spectrumIntFeature("Image Height", results.ImageHeight);
                  textureImagePi.spectrumIntFeature("Image Texels", results.ImageWidth * results.ImageHeight);
                  textureImagePi.spectrumIntFeature("Texture Memory", textureMem);

                  if (!isVanilla) {
                    textureImagePi.spectrumIntFeature(
                      "Non-Vanilla Image Texels",
                      results.ImageWidth * results.ImageHeight
                    );
                    textureImagePi.spectrumIntFeature("Non-Vanilla Texture Memory", textureMem);
                  }

                  totalTextureMemory += textureMem;

                  // Empirical threshold for loose textures set below 2048*2048 per texture
                  let individualMemoryBudget = 16000000;

                  if (projectItem.parentItems) {
                    for (const itemRelationship of projectItem.parentItems) {
                      if (
                        itemRelationship.parentItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson ||
                        itemRelationship.parentItem.itemType === ProjectItemType.itemTextureJson
                      ) {
                        // Empirical threshold for atlas textures set below 256*256 per texture
                        individualMemoryBudget = 200000;
                        break;
                      }
                    }
                  }

                  if (textureMem > individualMemoryBudget) {
                    items.push(
                      new ProjectInfoItem(
                        InfoItemType.warning,
                        this.id,
                        TextureImageInfoGeneratorTest.individualTextureMemoryExceedsBudget,
                        `Individual texture memory exceeds budget of ${individualMemoryBudget} bytes. Memory used`,
                        projectItem,
                        textureMem
                      )
                    );
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

    const totalTextureMemoryBudget = 100000000;
    if (totalTextureMemory > totalTextureMemoryBudget) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudget,
          `Total texture memory exceeds budget of ${totalTextureMemoryBudget} bytes. Total memory used`,
          undefined,
          totalTextureMemory
        )
      );
    }

    return items;
  }
}
