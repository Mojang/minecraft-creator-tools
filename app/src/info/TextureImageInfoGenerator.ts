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
import ProjectUtilities from "../app/ProjectUtilities";
import ProjectItemVariant from "../app/ProjectItemVariant";

export enum TextureImageInfoGeneratorTest {
  textureImages = 101,
  textureImagesTier0 = 200,
  textureImagesTier1 = 201,
  textureImagesTier2 = 202,
  textureImagesTier3 = 203,
  textureImagesTier4 = 204,
  textureImagesTier5 = 205,
  pngJpgImageProcessingError = 401,
  individualTextureMemoryExceedsBudget = 402,
  totalTextureMemoryExceedsBudget = 403,
  tgaImageProcessingError = 404,
  individualAtlasTextureMemoryExceedsBudget = 405,
  totalAtlasTextureMemoryExceedsBudgetWarn = 406,
  totalAtlasTextureMemoryExceedsBudgetError = 407,
  pngJpgImageProcessingNoResults = 408,
  totalTextureMemoryExceedsBudgetBase = 420,
}

export const TexturePerformanceTierCount = 6;

const TextureTiersBase = 200;

/*
export enum ProjectMetaCategory {
  mix = 0,
  worldTemplate = 1,
  texturePack = 2,
  addOn = 3,
  skinPack = 4,
  persona = 5,
}*/

const TextureMemoryLimitsByTier: { [category: number]: { [tier: number]: number } } = {
  0 /*mix*/: { 0: 750, 1: 750, 2: 1000, 3: 1500, 4: 3000, 5: 4000 },
  1 /*world template*/: { 0: 750, 1: 750, 2: 1000, 3: 1500, 4: 3000, 5: 4000 },
  2 /*texture pack*/: { 0: 300, 1: 300, 2: 450, 3: 600, 4: 1200, 5: 1600 },
  3 /*add-on*/: { 0: 150, 1: 150, 2: 225, 3: 300, 4: 600, 5: 800 },
  4 /*skin pack*/: { 0: 150, 1: 150, 2: 225, 3: 300, 4: 600, 5: 800 },
  5 /*persona*/: { 0: 150, 1: 150, 2: 225, 3: 300, 4: 600, 5: 800 },
};

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
    info.textureCount = infoSet.getSummedFeatureValue(
      this.id,
      TextureImageInfoGeneratorTest.textureImages,
      "Texels",
      "Instance Count"
    );

    info.textureTexelSize = infoSet.getSummedFeatureValue(
      this.id,
      TextureImageInfoGeneratorTest.textureImages,
      "Non-Vanilla Texels",
      "Total"
    );

    let minimumSupportablePerformanceTier = 0;

    for (let i = 0; i < TexturePerformanceTierCount; i++) {
      const overBudgetTierErrors = infoSet.getCount(
        this.id,
        TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudgetBase + i
      );

      if (overBudgetTierErrors > 0) {
        minimumSupportablePerformanceTier = i + 1;
      }
    }

    info.minimumSupportablePerformanceTier = minimumSupportablePerformanceTier;
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

    const textureMemoryByTier: { [path: string]: number }[] = [];
    const itemAtlasTextureMemoryByTier: { [path: string]: number }[] = [];
    const blockAtlasTextureMemoryByTier: { [path: string]: number }[] = [];
    const textureTierImagePi: ProjectInfoItem[] = [];

    for (let i = 0; i < TexturePerformanceTierCount; i++) {
      textureMemoryByTier.push({});

      itemAtlasTextureMemoryByTier.push({});
      blockAtlasTextureMemoryByTier.push({});

      textureTierImagePi[i] = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        this.id,
        TextureTiersBase + i,
        "Texture Images Tier " + i
      );

      items.push(textureTierImagePi[i]);
    }

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.texture) {
        await projectItem.ensureFileStorage();

        const variantList = projectItem.getVariantList();

        variantList.sort((a: ProjectItemVariant, b: ProjectItemVariant) => {
          return a.label.localeCompare(b.label);
        });

        for (const variant of variantList) {
          const variantFile = variant.file;

          if (variantFile) {
            let textureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let itemAtlasTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let blockAtlasTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let textureTierItem: ProjectInfoItem | undefined = undefined;

            if (variant.projectVariant) {
              if (variant.projectVariant.isDefault) {
                textureMemoryByTierToUpdate = textureMemoryByTier;
                itemAtlasTextureMemoryByTierToUpdate = itemAtlasTextureMemoryByTier;
                blockAtlasTextureMemoryByTierToUpdate = blockAtlasTextureMemoryByTier;
              } else if (variant.projectVariant.effectiveUnifiedTier !== undefined) {
                textureTierItem = textureTierImagePi[variant.projectVariant.effectiveUnifiedTier];
                textureMemoryByTierToUpdate.push(textureMemoryByTier[variant.projectVariant.effectiveUnifiedTier]);
                itemAtlasTextureMemoryByTierToUpdate.push(
                  itemAtlasTextureMemoryByTier[variant.projectVariant.effectiveUnifiedTier]
                );
                blockAtlasTextureMemoryByTierToUpdate.push(
                  blockAtlasTextureMemoryByTier[variant.projectVariant.effectiveUnifiedTier]
                );
              }
            }

            let pathInRp = await projectItem.getPackRelativePath();
            let isVanilla = false;

            // Log.assertDefined(pathInRp, "TIIGGP");

            if (pathInRp) {
              pathInRp = StorageUtilities.getBaseFromName(StorageUtilities.ensureNotStartsWithDelimiter(pathInRp));
              if (await Database.matchesVanillaPath(pathInRp)) {
                textureImagePi.incrementFeature("Vanilla Override Texture");

                if (textureTierItem) {
                  textureTierItem.incrementFeature("Vanilla Override Texture");
                }

                isVanilla = true;
              } else {
                textureImagePi.incrementFeature("Custom Texture");

                if (textureTierItem) {
                  textureTierItem.incrementFeature("Custom Texture");
                }
              }
            } else {
              textureImagePi.incrementFeature("Custom Texture");
            }

            let imageWidth = -1;
            let imageHeight = -1;

            if (variantFile.type !== "tga") {
              await variantFile.loadContent();

              if (variantFile.content && variantFile.content instanceof Uint8Array) {
                const exifr = new Exifr({});

                try {
                  await exifr.read(variantFile.content);

                  const results = await exifr.parse();

                  if (!results) {
                    items.push(
                      new ProjectInfoItem(
                        InfoItemType.internalProcessingError,
                        this.id,
                        TextureImageInfoGeneratorTest.pngJpgImageProcessingNoResults,
                        `Error processing PNG/JPG/TIF/HEIC image - no results returned`,
                        projectItem
                      )
                    );
                  } else {
                    if (results.ImageWidth && results.ImageHeight) {
                      imageWidth = results.ImageWidth;
                      imageHeight = results.ImageHeight;

                      const pngJpgTextureMem = imageWidth * imageHeight * 4;

                      textureImagePi.spectrumIntFeature("PNGJPG Width", imageWidth);
                      textureImagePi.spectrumIntFeature("PNGJPG Height", imageHeight);
                      textureImagePi.spectrumIntFeature("PNGJPG Texels", imageWidth * imageHeight);
                      textureImagePi.spectrumIntFeature("PNGJPG Texture Memory", pngJpgTextureMem);
                    }
                  }
                } catch (e: any) {
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.internalProcessingError,
                      this.id,
                      TextureImageInfoGeneratorTest.pngJpgImageProcessingError,
                      `Error processing PNG/JPG/TIF/HEIC image`,
                      projectItem,
                      e.toString()
                    )
                  );
                }
              }

              variantFile.unload();
            } else {
              await variantFile.loadContent();

              if (variantFile.content && variantFile.content instanceof Uint8Array) {
                try {
                  const tga = await decodeTga(variantFile.content);

                  imageWidth = tga.image.width;
                  imageHeight = tga.image.height;

                  const tgaTextureMem = imageWidth * imageHeight * 4;

                  textureImagePi.spectrumIntFeature("TGA Width", imageWidth);
                  textureImagePi.spectrumIntFeature("TGA Height", imageHeight);
                  textureImagePi.spectrumIntFeature("TGA Texels", imageWidth * imageHeight);
                  textureImagePi.spectrumIntFeature("TGA Texture Memory", tgaTextureMem);
                } catch (e: any) {
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.internalProcessingError,
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
              const textureMem = imageWidth * imageHeight * 4;
              let isAtlasTexture = false;

              textureImagePi.spectrumIntFeature("Width", imageWidth);
              textureImagePi.spectrumIntFeature("Height", imageHeight);
              textureImagePi.spectrumIntFeature("Texels", imageWidth * imageHeight);
              textureImagePi.spectrumIntFeature("Texture Memory", textureMem);

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Non-Vanilla Texture Memory", textureMem);

                if (pathInRp) {
                  for (const textureMemoryByTier of textureMemoryByTierToUpdate) {
                    textureMemoryByTier[pathInRp] = textureMem;
                  }
                }
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

                  if (pathInRp) {
                    for (const blockAtlasMemoryByTier of blockAtlasTextureMemoryByTierToUpdate) {
                      blockAtlasMemoryByTier[pathInRp] = textureMem;
                    }
                  }
                }

                relations++;

                isAtlasTexture = true;
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

                  if (pathInRp) {
                    for (const itemAtlasMemoryByTier of itemAtlasTextureMemoryByTierToUpdate) {
                      itemAtlasMemoryByTier[pathInRp] = textureMem;
                    }
                  }
                }

                relations++;

                isAtlasTexture = true;
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

              let individualMemoryBudget = 2048 * 2048 * 4;

              if (isAtlasTexture) {
                individualMemoryBudget = 256 * 256 * 4;
                if (textureMem > individualMemoryBudget) {
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.warning,
                      this.id,
                      TextureImageInfoGeneratorTest.individualAtlasTextureMemoryExceedsBudget,
                      `Individual atlassed texture memory exceeds budget of ${individualMemoryBudget} bytes. Memory used`,
                      projectItem,
                      textureMem
                    )
                  );
                }
              } else {
                if (textureMem > individualMemoryBudget) {
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.warning,
                      this.id,
                      TextureImageInfoGeneratorTest.individualTextureMemoryExceedsBudget,
                      `Individual loose texture memory exceeds budget of ${individualMemoryBudget} bytes. Memory used`,
                      projectItem,
                      textureMem
                    )
                  );
                }
              }
            }
          }
        }
      }
    }

    let maxTextureMemory = 0;
    let maxBlockAtlasTextureMemory = 0;
    let maxItemAtlasTextureMemory = 0;

    const category = await ProjectUtilities.getMetaCategory(project);

    for (let i = 0; i < TexturePerformanceTierCount; i++) {
      let tierTotalTextureMemory = 0;
      let tierTotalBlockAtlasTextureMemory = 0;
      let tierTotalItemAtlasTextureMemory = 0;

      for (const texturePath in textureMemoryByTier[i]) {
        tierTotalTextureMemory += textureMemoryByTier[i][texturePath];
      }

      for (const texturePath in blockAtlasTextureMemoryByTier[i]) {
        tierTotalBlockAtlasTextureMemory += blockAtlasTextureMemoryByTier[i][texturePath];
      }

      for (const texturePath in itemAtlasTextureMemoryByTier[i]) {
        tierTotalItemAtlasTextureMemory += itemAtlasTextureMemoryByTier[i][texturePath];
      }

      maxItemAtlasTextureMemory = Math.max(maxItemAtlasTextureMemory, tierTotalItemAtlasTextureMemory);
      maxBlockAtlasTextureMemory = Math.max(maxBlockAtlasTextureMemory, tierTotalBlockAtlasTextureMemory);
      maxTextureMemory = Math.max(maxTextureMemory, tierTotalTextureMemory);

      textureTierImagePi[i].spectrumIntFeature("Non-Vanilla Texture Memory Tier", tierTotalTextureMemory);

      // Expand atlases to power of 2
      tierTotalBlockAtlasTextureMemory = Math.pow(2, Math.ceil(Math.log2(tierTotalBlockAtlasTextureMemory)));
      tierTotalItemAtlasTextureMemory = Math.pow(2, Math.ceil(Math.log2(tierTotalItemAtlasTextureMemory)));

      textureTierImagePi[i].spectrumIntFeature("Block Atlas Texture Memory Tier", tierTotalBlockAtlasTextureMemory);
      textureTierImagePi[i].spectrumIntFeature("Item Atlas Texture Memory Tier", tierTotalItemAtlasTextureMemory);

      // 4K limit for warn, 8K as hard limit
      const totalAtlasTextureMemoryBudgetWarn = 4096 * 4096 * 4;
      const totalAtlasTextureMemoryBudgetError = totalAtlasTextureMemoryBudgetWarn * 4;

      if (tierTotalBlockAtlasTextureMemory > totalAtlasTextureMemoryBudgetError) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            TextureImageInfoGeneratorTest.totalAtlasTextureMemoryExceedsBudgetError,
            `Texture memory of block atlas exceeds hard limit of ${totalAtlasTextureMemoryBudgetError} bytes. Total memory used`,
            undefined,
            tierTotalBlockAtlasTextureMemory
          )
        );
      } else if (tierTotalBlockAtlasTextureMemory > totalAtlasTextureMemoryBudgetWarn) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            TextureImageInfoGeneratorTest.totalAtlasTextureMemoryExceedsBudgetWarn,
            `Texture memory of block atlas exceeds budget of ${totalAtlasTextureMemoryBudgetWarn} bytes. Total memory used`,
            undefined,
            tierTotalBlockAtlasTextureMemory
          )
        );
      }

      if (tierTotalItemAtlasTextureMemory > totalAtlasTextureMemoryBudgetError) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            TextureImageInfoGeneratorTest.totalAtlasTextureMemoryExceedsBudgetError,
            `Texture memory of item atlas exceeds hard limit of ${totalAtlasTextureMemoryBudgetError} bytes. Total memory used`,
            undefined,
            tierTotalItemAtlasTextureMemory
          )
        );
      } else if (tierTotalItemAtlasTextureMemory > totalAtlasTextureMemoryBudgetWarn) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            TextureImageInfoGeneratorTest.totalAtlasTextureMemoryExceedsBudgetWarn,
            `Texture memory of item atlas exceeds budget of ${totalAtlasTextureMemoryBudgetWarn} bytes. Total memory used`,
            undefined,
            tierTotalItemAtlasTextureMemory
          )
        );
      }

      tierTotalTextureMemory += tierTotalBlockAtlasTextureMemory + tierTotalItemAtlasTextureMemory;

      let curMemoryUsedInTier = tierTotalTextureMemory;

      if (curMemoryUsedInTier <= 0) {
        curMemoryUsedInTier = maxTextureMemory;
      }

      const tierTotalTextureMemoryBudget = 1024 * 1024 * TextureMemoryLimitsByTier[category][i];

      if (curMemoryUsedInTier > tierTotalTextureMemoryBudget) {
        let errorOrWarningType = InfoItemType.warning;
        let warningMessage = `Total texture memory exceeds budget of ${tierTotalTextureMemoryBudget} bytes for items of type ${ProjectUtilities.getMetaCategoryDescription(
          category
        )} at tier ${i}.`;

        for (const pvLabel in project.variants) {
          const pv = project.variants[pvLabel];

          if (pv && pv.effectiveUnifiedTier === i) {
            errorOrWarningType = InfoItemType.error;
            warningMessage += "Because this project specifically targets this tier, it is an error.";
          }
        }

        warningMessage += " Total memory used";

        items.push(
          new ProjectInfoItem(
            errorOrWarningType,
            this.id,
            TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudgetBase + i,
            warningMessage,
            undefined,
            curMemoryUsedInTier
          )
        );
      }
    }
    const totalTextureMemoryBudget = 1024 * 1024 * 800;

    if (maxTextureMemory > totalTextureMemoryBudget) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudget,
          `Total texture memory exceeds budget of ${totalTextureMemoryBudget} bytes. Total memory used`,
          undefined,
          maxTextureMemory
        )
      );
    }

    return items;
  }
}
