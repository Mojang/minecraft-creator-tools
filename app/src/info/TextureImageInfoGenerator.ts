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
import { decodeTga } from "@lunapaint/tga-codec";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import TextureDefinition from "../minecraft/TextureDefinition";

export enum TextureImageInfoGeneratorTest {
  textureImages = 1,
  pngJpgImageProcessingError = 401,
  individualTextureMemoryExceedsBudget = 402,
  totalTextureMemoryExceedsBudget = 403,
  tgaImageProcessingError = 404,
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

          let imageWidth = -1;
          let imageHeight = -1;

          if (projectItem.file.type !== "tga") {
            await projectItem.file.loadContent();

            if (projectItem.file.content && projectItem.file.content instanceof Uint8Array) {
              const exifr = new Exifr({});

              try {
                await exifr.read(projectItem.file.content);

                const results = await exifr.parse();

                if (results.ImageWidth && results.ImageHeight) {
                  imageWidth = results.ImageWidth;
                  imageHeight = results.ImageHeight;

                  const pngJpgTextureMem = Math.pow(2, Math.ceil(Math.log2(imageWidth * imageHeight * 4)));

                  textureImagePi.spectrumIntFeature("PNGJPG Width", imageWidth);
                  textureImagePi.spectrumIntFeature("PNGJPG Height", imageHeight);
                  textureImagePi.spectrumIntFeature("PNGJPG Texels", imageWidth * imageHeight);
                  textureImagePi.spectrumIntFeature("PNGJPG Texture Memory", pngJpgTextureMem);
                }
              } catch (e: any) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    TextureImageInfoGeneratorTest.pngJpgImageProcessingError,
                    `Error processing PNG/JPG/TIF/HEIC image`,
                    projectItem,
                    e.toString()
                  )
                );
              }
            }

            projectItem.file.unload();
          } else {
            await projectItem.file.loadContent();

            if (projectItem.file.content && projectItem.file.content instanceof Uint8Array) {
              try {
                const tga = await decodeTga(projectItem.file.content);

                imageWidth = tga.image.width;
                imageHeight = tga.image.height;

                const tgaTextureMem = Math.pow(2, Math.ceil(Math.log2(imageWidth * imageHeight * 4)));

                textureImagePi.spectrumIntFeature("TGA Width", imageWidth);
                textureImagePi.spectrumIntFeature("TGA Height", imageHeight);
                textureImagePi.spectrumIntFeature("TGA Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("TGA Texture Memory", tgaTextureMem);
              } catch (e: any) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.error,
                    this.id,
                    TextureImageInfoGeneratorTest.tgaImageProcessingError,
                    `Error processing TGA image`,
                    projectItem,
                    e.toString()
                  )
                );
              }
            }
          }

          if (imageWidth >= 0 && imageHeight >= 0) {
            const textureMem = Math.pow(2, Math.ceil(Math.log2(imageWidth * imageHeight * 4)));

            textureImagePi.spectrumIntFeature("Width", imageWidth);
            textureImagePi.spectrumIntFeature("Height", imageHeight);
            textureImagePi.spectrumIntFeature("Texels", imageWidth * imageHeight);
            textureImagePi.spectrumIntFeature("Texture Memory", textureMem);

            if (!isVanilla) {
              textureImagePi.spectrumIntFeature("Non-Vanilla Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Non-Vanilla Texture Memory", textureMem);
            }

            let relations = 0;
            if (ProjectItemUtilities.isUIRelated(projectItem)) {
              textureImagePi.spectrumIntFeature("UI Width", imageWidth);
              textureImagePi.spectrumIntFeature("UI Height", imageHeight);
              textureImagePi.spectrumIntFeature("UI Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("UI Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("UI Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("UI Non-Vanilla Texture Memory", textureMem);
              }

              relations++;
            }

            if (ProjectItemUtilities.isBlockRelated(projectItem)) {
              textureImagePi.spectrumIntFeature("Block Width", imageWidth);
              textureImagePi.spectrumIntFeature("Block Height", imageHeight);
              textureImagePi.spectrumIntFeature("Block Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Block Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Block Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Block Non-Vanilla Texture Memory", textureMem);
              }

              relations++;
            }

            if (ProjectItemUtilities.isEntityRelated(projectItem)) {
              textureImagePi.spectrumIntFeature("Entity Width", imageWidth);
              textureImagePi.spectrumIntFeature("Entity Height", imageHeight);
              textureImagePi.spectrumIntFeature("Entity Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Entity Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Entity Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Entity Non-Vanilla Texture Memory", textureMem);
              }

              relations++;
            }

            if (ProjectItemUtilities.isItemRelated(projectItem)) {
              textureImagePi.spectrumIntFeature("Item Width", imageWidth);
              textureImagePi.spectrumIntFeature("Item Height", imageHeight);
              textureImagePi.spectrumIntFeature("Item Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Item Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Item Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Item Non-Vanilla Texture Memory", textureMem);
              }

              relations++;
            }

            if (ProjectItemUtilities.isParticleRelated(projectItem)) {
              textureImagePi.spectrumIntFeature("Particle Width", imageWidth);
              textureImagePi.spectrumIntFeature("Particle Height", imageHeight);
              textureImagePi.spectrumIntFeature("Particle Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Particle Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Particle Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Particle Non-Vanilla Texture Memory", textureMem);
              }

              relations++;
            }

            if (relations === 0 && projectItem.projectPath) {
              const texturePath = TextureDefinition.getTexturePath(projectItem.projectPath);

              if (texturePath) {
                const isVanillaEx = await Database.matchesVanillaPath(texturePath);

                if (isVanillaEx) {
                  textureImagePi.spectrumIntFeature("Vanilla Override Width", imageWidth);
                  textureImagePi.spectrumIntFeature("Vanilla Override Height", imageHeight);
                  textureImagePi.spectrumIntFeature("Vanilla Override Texels", imageWidth * imageHeight);
                  textureImagePi.spectrumIntFeature("Vanilla Override Texture Memory", textureMem);
                } else {
                  textureImagePi.spectrumIntFeature("Non-tied Width", imageWidth);
                  textureImagePi.spectrumIntFeature("Non-tied Height", imageHeight);
                  textureImagePi.spectrumIntFeature("Non-tied Texels", imageWidth * imageHeight);
                  textureImagePi.spectrumIntFeature("Non-tied Texture Memory", textureMem);

                  if (!isVanilla) {
                    textureImagePi.spectrumIntFeature("Non-tied Non-Vanilla Texels", imageWidth * imageHeight);
                    textureImagePi.spectrumIntFeature("Non-tied Non-Vanilla Texture Memory", textureMem);
                  }
                }
              }
            } else if (relations > 1) {
              textureImagePi.spectrumIntFeature("Multi-tied Width", imageWidth);
              textureImagePi.spectrumIntFeature("Multi-tied Height", imageHeight);
              textureImagePi.spectrumIntFeature("Multi-tied Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Multi-tied Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Multi-tied Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Multi-tied Non-Vanilla Texture Memory", textureMem);
              }
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
