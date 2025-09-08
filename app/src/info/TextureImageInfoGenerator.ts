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
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import TextureDefinition from "../minecraft/TextureDefinition";
import ProjectUtilities, { ProjectMetaCategory } from "../app/ProjectUtilities";
import ProjectItemVariant from "../app/ProjectItemVariant";
import Utilities from "../core/Utilities";

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
  invalidTieringConfiguration = 409,
  invalidTieringForVibrantVisuals = 410,
  totalTextureMemoryExceedsBudgetBase = 420,
  texturePackDoesntOverrideVanillaGameTexture = 460,
  texturePackDoesntOverrideMostTextures = 461,
}

export const TexturePerformanceTierCount = 6;

const TextureTiersBase = 200;

const TextureOverrideThresholdPercent = 0.7; // if you override at least 70% of vanilla game textures, we assume you're trying to create a "texture pack" and should warn when you're not "covering" a vanilla texture.
const TextureOverrideThresholdErrorPercent = 0.95; // if you override at least 95% of vanilla game textures, we assume you're trying to create a "texture pack" and should error if you don't have 95% coverage.

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
  2 /*texture pack*/: { 0: 350, 1: 350, 2: 500, 3: 650, 4: 1250, 5: 1650 }, // added 50mb as a "discount" assuming texture packs override vanilla textures, and therefore save the 50mb of vanilla texture overhead
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

    info.vanillaGameTextureCoverage = infoSet.getAverageFeatureValue(
      this.id,
      TextureImageInfoGeneratorTest.textureImages,
      "Vanilla Game Texture Coverage",
      "Percent"
    );

    info.vanillaGameTextureCount = infoSet.getAverageFeatureValue(
      this.id,
      TextureImageInfoGeneratorTest.textureImages,
      "Vanilla Game Texture Coverage",
      "Override Count"
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

  static isGameTexturePath(path: string) {
    path = path.toLowerCase();

    return (
      path.startsWith("/resource_pack/textures/") &&
      (path.endsWith(".png") || path.endsWith(".tga") || path.indexOf(".") < 0) &&
      path.indexOf("_mers.") < 0 &&
      path.indexOf("_mer.") < 0 &&
      path.indexOf("_normal.") < 0 &&
      path.indexOf("_mipmap.") < 0 &&
      (path.indexOf("/textures/blocks") >= 0 ||
        path.indexOf("/textures/entity") >= 0 ||
        path.indexOf("/textures/items") >= 0)
    );
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

    const vanillaPathList = await Database.getVanillaPathList();

    const nonVanillaTextureMemoryByTier: { [path: string]: number }[] = [];
    const totalTextureMemoryByTier: { [path: string]: number }[] = [];
    const itemAtlasTextureMemoryByTier: { [path: string]: number }[] = [];
    const blockAtlasTextureMemoryByTier: { [path: string]: number }[] = [];
    const textureTierImagePi: ProjectInfoItem[] = [];
    const hasSupportForTier: boolean[] = [];
    const tierTotalMemorySizes: number[] = [];
    let isExplicitlyTargetingTiers = false;

    const vanillaTexturePathNonMers: { [path: string]: boolean } = {};
    let vanillaTexturePathNonMersCount = 0;

    if (vanillaPathList) {
      for (const path of vanillaPathList) {
        if (TextureImageInfoGenerator.isGameTexturePath(path)) {
          vanillaTexturePathNonMersCount++;
          let extensionlessPath = path;
          let period = path.lastIndexOf(".");

          if (period >= 0) {
            extensionlessPath = path.substring(0, period);
          }

          vanillaTexturePathNonMers[extensionlessPath] = false;
        }
      }
    }

    for (let i = 0; i < TexturePerformanceTierCount; i++) {
      hasSupportForTier[i] = false;
      nonVanillaTextureMemoryByTier.push({});
      totalTextureMemoryByTier.push({});

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

    for (const projectVariant in project.variants) {
      const variant = project.variants[projectVariant];

      if (!variant.isDefault && variant.effectiveUnifiedTier !== undefined) {
        hasSupportForTier[variant.effectiveUnifiedTier] = true;
        isExplicitlyTargetingTiers = true;
      }
    }

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (
        projectItem.itemType === ProjectItemType.texture &&
        projectItem.projectPath &&
        !projectItem.projectPath.endsWith(".hdr") // ignore HDR files
      ) {
        if (!projectItem.isContentLoaded) {
          await projectItem.loadContent();
        }

        const variantList = projectItem.getVariantList();

        // we assume that the default (base) variant, with a label of "", must go
        // first.
        variantList.sort((a: ProjectItemVariant, b: ProjectItemVariant) => {
          return a.label.localeCompare(b.label);
        });

        for (const variant of variantList) {
          const variantFile = variant.file;

          if (variantFile) {
            let nonVanillaTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let totalTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let itemAtlasTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let blockAtlasTextureMemoryByTierToUpdate: { [path: string]: number }[] = [];
            let textureTierItem: ProjectInfoItem | undefined = undefined;

            if (variant.projectVariant) {
              if (variant.projectVariant.isDefault) {
                // if this is the default, set texture sizes by path for all tiers
                nonVanillaTextureMemoryByTierToUpdate = nonVanillaTextureMemoryByTier;
                totalTextureMemoryByTierToUpdate = totalTextureMemoryByTier;
                itemAtlasTextureMemoryByTierToUpdate = itemAtlasTextureMemoryByTier;
                blockAtlasTextureMemoryByTierToUpdate = blockAtlasTextureMemoryByTier;
              } else if (variant.projectVariant.effectiveUnifiedTier !== undefined) {
                // otherwise, set the texture sizes by path for the effective tier
                textureTierItem = textureTierImagePi[variant.projectVariant.effectiveUnifiedTier];
                nonVanillaTextureMemoryByTierToUpdate.push(
                  nonVanillaTextureMemoryByTier[variant.projectVariant.effectiveUnifiedTier]
                );
                totalTextureMemoryByTierToUpdate.push(
                  totalTextureMemoryByTier[variant.projectVariant.effectiveUnifiedTier]
                );
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

              const vanillaRpPath = "/resource_pack/" + pathInRp;

              if (vanillaTexturePathNonMers[vanillaRpPath] === false) {
                vanillaTexturePathNonMers[vanillaRpPath] = true;
              }

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

            if (variantFile.content && variantFile.content instanceof Uint8Array) {
              const textureDefinition = await TextureDefinition.ensureOnFile(variantFile);

              if (textureDefinition) {
                await textureDefinition.processContent();

                if (textureDefinition.errorProcessing) {
                  if (variantFile.type === "tga") {
                    items.push(
                      new ProjectInfoItem(
                        InfoItemType.internalProcessingError,
                        this.id,
                        TextureImageInfoGeneratorTest.tgaImageProcessingError,
                        `Error processing TGA image`,
                        projectItem,
                        textureDefinition.errorMessage
                      )
                    );
                  } else {
                    items.push(
                      new ProjectInfoItem(
                        InfoItemType.internalProcessingError,
                        this.id,
                        TextureImageInfoGeneratorTest.pngJpgImageProcessingNoResults,
                        `Error processing PNG/JPG/TIF/HEIC image`,
                        projectItem,
                        textureDefinition.errorMessage
                      )
                    );
                  }
                } else if (textureDefinition.width !== undefined && textureDefinition.height !== undefined) {
                  imageWidth = textureDefinition.width;
                  imageHeight = textureDefinition.height;

                  const textureMem = imageWidth * imageHeight * 4;

                  if (variantFile.type === "tga") {
                    textureImagePi.spectrumIntFeature("TGA Width", imageWidth);
                    textureImagePi.spectrumIntFeature("TGA Height", imageHeight);
                    textureImagePi.spectrumIntFeature("TGA Texels", imageWidth * imageHeight);
                    textureImagePi.spectrumIntFeature("TGA Texture Memory", textureMem);
                  } else {
                    textureImagePi.spectrumIntFeature("PNGJPG Width", imageWidth);
                    textureImagePi.spectrumIntFeature("PNGJPG Height", imageHeight);
                    textureImagePi.spectrumIntFeature("PNGJPG Texels", imageWidth * imageHeight);
                    textureImagePi.spectrumIntFeature("PNGJPG Texture Memory", textureMem);
                  }
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

              if (pathInRp) {
                for (const totalTextureMemoryByTier of totalTextureMemoryByTierToUpdate) {
                  totalTextureMemoryByTier[pathInRp] = textureMem;
                }
              }

              if (!isVanilla) {
                textureImagePi.spectrumIntFeature("Non-Vanilla Texels", imageWidth * imageHeight);
                textureImagePi.spectrumIntFeature("Non-Vanilla Texture Memory", textureMem);

                if (pathInRp) {
                  for (const nonVanillaTextureMemoryByTier of nonVanillaTextureMemoryByTierToUpdate) {
                    nonVanillaTextureMemoryByTier[pathInRp] = textureMem;
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

    let maxTotalTextureMemory = 0;
    let maxNonVanillaTextureMemory = 0;
    let maxBlockAtlasTextureMemory = 0;
    let maxItemAtlasTextureMemory = 0;

    const category = await ProjectUtilities.getMetaCategory(project);

    for (let curTier = 0; curTier < TexturePerformanceTierCount; curTier++) {
      let tierNonVanillaTextureMemory = 0;
      let tierTotalTextureMemory = 0;
      let tierTotalBlockAtlasTextureMemory = 0;
      let tierTotalItemAtlasTextureMemory = 0;

      for (const texturePath in nonVanillaTextureMemoryByTier[curTier]) {
        tierNonVanillaTextureMemory += nonVanillaTextureMemoryByTier[curTier][texturePath];
      }

      for (const texturePath in totalTextureMemoryByTier[curTier]) {
        tierTotalTextureMemory += totalTextureMemoryByTier[curTier][texturePath];
      }

      for (const texturePath in blockAtlasTextureMemoryByTier[curTier]) {
        tierTotalBlockAtlasTextureMemory += blockAtlasTextureMemoryByTier[curTier][texturePath];
      }

      for (const texturePath in itemAtlasTextureMemoryByTier[curTier]) {
        tierTotalItemAtlasTextureMemory += itemAtlasTextureMemoryByTier[curTier][texturePath];
      }

      if (curTier > 0 && !hasSupportForTier[curTier]) {
        textureTierImagePi[curTier].spectrumIntFeature("Non-Vanilla Texture Memory Tier", maxNonVanillaTextureMemory);
        textureTierImagePi[curTier].spectrumIntFeature("Total Texture Memory Tier", maxTotalTextureMemory);
      } else {
        maxItemAtlasTextureMemory = Math.max(maxItemAtlasTextureMemory, tierTotalItemAtlasTextureMemory);
        maxBlockAtlasTextureMemory = Math.max(maxBlockAtlasTextureMemory, tierTotalBlockAtlasTextureMemory);
        maxNonVanillaTextureMemory = Math.max(maxNonVanillaTextureMemory, tierNonVanillaTextureMemory);
        maxTotalTextureMemory = Math.max(maxTotalTextureMemory, tierTotalTextureMemory);
        textureTierImagePi[curTier].spectrumIntFeature("Non-Vanilla Texture Memory Tier", tierNonVanillaTextureMemory);
        textureTierImagePi[curTier].spectrumIntFeature("Total Texture Memory Tier", tierTotalTextureMemory);
      }

      // Expand atlases to power of 2
      tierTotalBlockAtlasTextureMemory = Math.pow(2, Math.ceil(Math.log2(tierTotalBlockAtlasTextureMemory)));
      tierTotalItemAtlasTextureMemory = Math.pow(2, Math.ceil(Math.log2(tierTotalItemAtlasTextureMemory)));

      textureTierImagePi[curTier].spectrumIntFeature(
        "Block Atlas Texture Memory Tier",
        tierTotalBlockAtlasTextureMemory
      );
      textureTierImagePi[curTier].spectrumIntFeature("Item Atlas Texture Memory Tier", tierTotalItemAtlasTextureMemory);

      // 4K limit for warn, 8K as hard limit
      const totalAtlasTextureMemoryBudgetWarn = 4096 * 4096 * 4;
      const totalAtlasTextureMemoryBudgetError = totalAtlasTextureMemoryBudgetWarn * 4;

      if (tierTotalBlockAtlasTextureMemory > totalAtlasTextureMemoryBudgetError) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            TextureImageInfoGeneratorTest.totalAtlasTextureMemoryExceedsBudgetError,
            `Texture memory of block atlas exceeds hard limit of ${Utilities.addCommasToNumber(
              totalAtlasTextureMemoryBudgetError
            )} bytes. Total memory used`,
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
            `Texture memory of block atlas exceeds budget of ${Utilities.addCommasToNumber(
              totalAtlasTextureMemoryBudgetWarn
            )} bytes. Total memory used`,
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
            `Texture memory of item atlas exceeds hard limit of ${Utilities.addCommasToNumber(
              totalAtlasTextureMemoryBudgetError
            )} bytes. Total memory used`,
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
            `Texture memory of item atlas exceeds budget of ${Utilities.addCommasToNumber(
              totalAtlasTextureMemoryBudgetWarn
            )} bytes. Total memory used`,
            undefined,
            tierTotalItemAtlasTextureMemory
          )
        );
      }

      tierNonVanillaTextureMemory += tierTotalBlockAtlasTextureMemory + tierTotalItemAtlasTextureMemory;
      tierTotalTextureMemory += tierTotalBlockAtlasTextureMemory + tierTotalItemAtlasTextureMemory;

      let curMemoryUsedInTier = tierTotalTextureMemory;

      if (curMemoryUsedInTier <= 0) {
        curMemoryUsedInTier = maxTotalTextureMemory;
      }

      if (curTier > 0 && !hasSupportForTier[curTier]) {
        curMemoryUsedInTier = maxTotalTextureMemory;
      }

      tierTotalMemorySizes[curTier] = curMemoryUsedInTier;

      // check for non linear tier scaling (e.g., tier 2 occupies more memory than tier 3)
      if (hasSupportForTier[curTier]) {
        for (let prevTier = 0; prevTier < curTier; prevTier++) {
          if (tierTotalMemorySizes[prevTier] && tierTotalMemorySizes[prevTier] > curMemoryUsedInTier) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                TextureImageInfoGeneratorTest.invalidTieringConfiguration,
                `Lower tier ${prevTier} has a higher memory requirement (${Utilities.addCommasToNumber(
                  tierTotalMemorySizes[prevTier]
                )}) than tier ${curTier}`,
                undefined,
                curMemoryUsedInTier
              )
            );
          }
        }
      }

      const tierTotalTextureMemoryBudget = 1024 * 1024 * TextureMemoryLimitsByTier[category][curTier];

      if (curMemoryUsedInTier > tierTotalTextureMemoryBudget) {
        let errorOrWarningType = InfoItemType.warning;
        let warningMessage = `Total texture memory exceeds budget of ${Utilities.addCommasToNumber(
          tierTotalTextureMemoryBudget
        )} bytes for items of type ${ProjectUtilities.getMetaCategoryDescription(category)} at tier ${curTier}.`;

        for (const pvLabel in project.variants) {
          const pv = project.variants[pvLabel];

          if (pv && pv.effectiveUnifiedTier === curTier && errorOrWarningType === InfoItemType.warning) {
            errorOrWarningType = InfoItemType.error;
            warningMessage += " Because this project specifically targets this tier, it is an error.";
          }
        }

        warningMessage += " Total texture memory used";

        items.push(
          new ProjectInfoItem(
            errorOrWarningType,
            this.id,
            TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudgetBase + curTier,
            warningMessage,
            undefined,
            curMemoryUsedInTier
          )
        );

        // vibrant visuals content must support tier 2 memory limits.
        if (curTier === 2) {
          const isVibrantVisualsCompatible = await ProjectUtilities.isVibrantVisualsCompatible(project);

          if (isVibrantVisualsCompatible) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                TextureImageInfoGeneratorTest.invalidTieringForVibrantVisuals,
                `Project is marked to support vibrant visuals, but does not support texture limits at tiers ${curTier}. Texture memory`,
                undefined,
                curMemoryUsedInTier
              )
            );
          }
        }
      }
    }

    // if add-on content is not managing its texture memory across tiers and is exceeding a base limit, throw an error
    if (
      !isExplicitlyTargetingTiers &&
      category === ProjectMetaCategory.addOn &&
      maxTotalTextureMemory > TextureMemoryLimitsByTier[category][0] * 1024 * 1024
    ) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudget,
          `Total texture memory exceeds base budget of ${Utilities.addCommasToNumber(
            TextureMemoryLimitsByTier[category][0] * 1024 * 1024
          )} bytes and is not using subpacks to target specific tiers. Total memory used`,
          undefined,
          maxTotalTextureMemory
        )
      );
    }

    const totalTextureMemoryBudget = 1024 * 1024 * TextureMemoryLimitsByTier[category][5];
    // if content exceeds absolute limits, throw an error
    if (maxTotalTextureMemory > totalTextureMemoryBudget) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          TextureImageInfoGeneratorTest.totalTextureMemoryExceedsBudget,
          `Total texture memory exceeds absolute budget of ${Utilities.addCommasToNumber(
            totalTextureMemoryBudget
          )} bytes. Total memory used`,
          undefined,
          maxTotalTextureMemory
        )
      );
    }

    if (vanillaTexturePathNonMersCount > 0) {
      let vanillaOverrideTextureCount = 0;

      for (const path in vanillaTexturePathNonMers) {
        if (vanillaTexturePathNonMers[path] === true) {
          vanillaOverrideTextureCount++;
        }
      }

      textureImagePi.setFeature("Vanilla Game Texture Coverage", "Override Count", vanillaOverrideTextureCount);
      textureImagePi.setFeature(
        "Vanilla Game Texture Coverage",
        "Vanilla Texture Count",
        vanillaTexturePathNonMersCount
      );
      textureImagePi.setFeature(
        "Vanilla Game Texture Coverage",
        "Percent",
        vanillaOverrideTextureCount / vanillaTexturePathNonMersCount
      );

      const actualOverridePercent = vanillaOverrideTextureCount / vanillaTexturePathNonMersCount;

      if (actualOverridePercent >= TextureOverrideThresholdPercent) {
        if (actualOverridePercent < TextureOverrideThresholdErrorPercent) {
          const nonRpItemCount =
            project.getItemsByType(ProjectItemType.behaviorPackManifestJson).length +
            project.getItemsByType(ProjectItemType.worldFolder).length;

          if (nonRpItemCount === 0) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                TextureImageInfoGeneratorTest.texturePackDoesntOverrideMostTextures,
                `Content seems like a texture pack (overrides >70% of a textures), but does not override the vast majority of textures. This pack should override at least 95% of vanilla textures.`,
                undefined,
                actualOverridePercent
              )
            );
          }
        }

        for (const path in vanillaTexturePathNonMers) {
          if (vanillaTexturePathNonMers[path] === false) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.warning,
                this.id,
                TextureImageInfoGeneratorTest.texturePackDoesntOverrideVanillaGameTexture,
                `Content seems like a texture pack, but does not override vanilla texture`,
                undefined,
                path
              )
            );
          }
        }
      }
    }

    return items;
  }
}
