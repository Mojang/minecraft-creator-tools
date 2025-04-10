// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import BlocksCatalogDefinition from "../minecraft/BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "../minecraft/TerrainTextureCatalogDefinition";
import ParticleEffectResourceDefinition from "../minecraft/ParticleEffectResourceDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import FlipbookTextureCatalogDefinition from "../minecraft/FlipbookTextureCatalogDefinition";
import Database from "../minecraft/Database";
import JsonUIResourceDefinition from "../minecraft/JsonUIResourceDefinition";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import TextureDefinition from "../minecraft/TextureDefinition";

export enum TextureInfoGeneratorTest {
  textures = 1,
}

export default class TextureInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTURE";
  title = "Texture Validation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(TextureInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedNumberValue("TEXTURE", TextureInfoGeneratorTest.textures);
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const textureHandles: string[] = [];
    const allTexturePaths: string[] = [];
    const blockTextureRefs: string[] = [];
    const blockTexturePaths: string[] = [];
    const entityTexturePaths: string[] = [];
    const entityVanillaTexturePaths: string[] = [];
    const attachableTextureRefs: string[] = [];
    const particleTextureRefs: string[] = [];
    const particleTexturePaths: string[] = [];
    const particleVanillaTexturePaths: string[] = [];
    const jsonUITextureRefs: string[] = [];
    const jsonUITexturePaths: string[] = [];
    const jsonUIVanillaTexturePaths: string[] = [];

    const terrainTextureRefs: string[] = [];
    const terrainTexturePaths: string[] = [];
    const flipbookTextureRefs: string[] = [];
    const flipbookTexturePaths: string[] = [];
    const itemTexturePaths: string[] = [];
    const itemTextureVanillaPaths: string[] = [];
    const entitySpawnEggTextures: string[] = [];
    const textureCountPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Textures");
    items.push(textureCountPi);

    const itemsCopy = project.getItemsCopy();

    for (const projectItem of itemsCopy) {
      if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const blockCat = await BlocksCatalogDefinition.ensureOnFile(projectItem.availableFile);

          if (blockCat && blockCat.blocksCatalog) {
            for (const resourceId in blockCat.blocksCatalog) {
              const resource = blockCat.blocksCatalog[resourceId];

              if (resource && resource.textures) {
                textureCountPi.incrementFeature("Block Resource Count");
                if (!blockTextureRefs.includes(resourceId)) {
                  blockTextureRefs.push(resourceId);
                }

                if (typeof resource.textures === "string") {
                  if (!allTexturePaths.includes(resource.textures)) {
                    allTexturePaths.push(resource.textures);
                  }

                  if (!blockTexturePaths.includes(resource.textures)) {
                    blockTexturePaths.push(resource.textures);
                  }
                } else {
                  for (const texturePathKey in resource.textures) {
                    const textureVal = (resource.textures as any)[texturePathKey];

                    if (!allTexturePaths.includes(textureVal)) {
                      allTexturePaths.push(textureVal);
                    }

                    if (!blockTexturePaths.includes(textureVal)) {
                      blockTexturePaths.push(textureVal);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.particleJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const particleEffect = await ParticleEffectResourceDefinition.ensureOnFile(projectItem.availableFile);

          const desc = particleEffect?.data?.particle_effect?.description;

          if (desc) {
            if (desc.identifier && desc.basic_render_parameters?.texture) {
              const texturePath = desc.basic_render_parameters.texture;
              const matchesVanillaPath = await Database.matchesVanillaPath(desc.basic_render_parameters.texture);

              if (!matchesVanillaPath) {
                if (!textureHandles.includes(texturePath)) {
                  textureHandles.push(texturePath);
                }

                if (!particleTextureRefs.includes(desc.identifier)) {
                  particleTextureRefs.push(desc.identifier);
                }

                if (!allTexturePaths.includes(texturePath)) {
                  allTexturePaths.push(texturePath);
                }

                if (!particleTexturePaths.includes(texturePath)) {
                  particleTexturePaths.push(texturePath);
                }
              } else if (!particleVanillaTexturePaths.includes(texturePath)) {
                particleVanillaTexturePaths.push(texturePath);
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.uiJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const jsonUI = await JsonUIResourceDefinition.ensureOnFile(projectItem.availableFile);

          if (jsonUI) {
            jsonUITextureRefs.push(...jsonUI.getControlRefs());

            const texturePaths = jsonUI.getTexturePaths();

            for (const texturePath of texturePaths) {
              const matchesVanillaPath = await Database.matchesVanillaPath(texturePath);

              if (!matchesVanillaPath) {
                if (!textureHandles.includes(texturePath)) {
                  textureHandles.push(texturePath);
                }

                if (!allTexturePaths.includes(texturePath)) {
                  allTexturePaths.push(texturePath);
                }

                if (!jsonUITexturePaths.includes(texturePath)) {
                  jsonUITexturePaths.push(texturePath);
                }
              } else if (!jsonUIVanillaTexturePaths.includes(texturePath)) {
                jsonUIVanillaTexturePaths.push(texturePath);
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const terrainTextureCat = await TerrainTextureCatalogDefinition.ensureOnFile(projectItem.availableFile);

          if (terrainTextureCat && terrainTextureCat.data && terrainTextureCat.data.texture_data) {
            for (const terrainTextureId in terrainTextureCat.data.texture_data) {
              const terrainTexture = terrainTextureCat.data.texture_data[terrainTextureId];

              if (terrainTexture && terrainTexture.textures) {
                textureCountPi.incrementFeature("Terrain Texture Resource Count");

                if (!terrainTextureRefs.includes(terrainTextureId)) {
                  terrainTextureRefs.push(terrainTextureId);
                }

                if (typeof terrainTexture.textures === "string") {
                  if (!terrainTexturePaths.includes(terrainTexture.textures)) {
                    terrainTexturePaths.push(terrainTexture.textures);
                  }
                } /*else if (terrainTexture.textures) {
                  for (let str of terrainTexture.textures) {
                    if (!terrainTexturePaths.includes(str)) {
                      terrainTexturePaths.push(str);
                    }
                  }
                }*/
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.flipbookTexturesJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const flipbookTexturesCat = await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.availableFile);

          if (flipbookTexturesCat && flipbookTexturesCat && flipbookTexturesCat.data) {
            const pathId = projectItem.availableFile.storageRelativePath + "_flipbooktextures";

            if (!allTexturePaths.includes(pathId)) {
              allTexturePaths.push(pathId);
            }

            for (const flipbookTexture of flipbookTexturesCat.data) {
              if (flipbookTexture && flipbookTexture.flipbook_texture) {
                textureCountPi.incrementFeature("Flipbook Texture Resource Count");

                // every flipbook texture is reserved as a handle; the current "page" in the "flipbook" is atlas'ed in one texture per world.
                if (!textureHandles.includes(flipbookTexture.flipbook_texture)) {
                  textureHandles.push(flipbookTexture.flipbook_texture);
                }

                if (!flipbookTextureRefs.includes(flipbookTexture.atlas_tile)) {
                  flipbookTextureRefs.push(flipbookTexture.atlas_tile);
                }

                if (!flipbookTexturePaths.includes(flipbookTexture.flipbook_texture)) {
                  flipbookTexturePaths.push(flipbookTexture.flipbook_texture);
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.itemTextureJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const itemTextureCat = await ItemTextureCatalogDefinition.ensureOnFile(projectItem.availableFile);

          if (itemTextureCat && itemTextureCat.data && itemTextureCat.data.texture_data) {
            for (const itemTextureId in itemTextureCat.data.texture_data) {
              const itemTexture = itemTextureCat.data.texture_data[itemTextureId];

              if (itemTexture && itemTexture.textures) {
                textureCountPi.incrementFeature("Item Texture Resource Count");

                if (itemTexture.textures) {
                  if (typeof itemTexture.textures === "string") {
                    const matchesVanillaPath = await Database.matchesVanillaPath(itemTexture.textures);

                    if (!matchesVanillaPath && !itemTexturePaths.includes(itemTexture.textures)) {
                      itemTexturePaths.push(itemTexture.textures);
                    } else if (matchesVanillaPath && !itemTextureVanillaPaths.includes(itemTexture.textures)) {
                      itemTextureVanillaPaths.push(itemTexture.textures);
                    }
                  } else if (itemTexture.textures.constructor === Array) {
                    for (let str of itemTexture.textures) {
                      const matchesVanillaPath = await Database.matchesVanillaPath(str);

                      if (!matchesVanillaPath && !itemTexturePaths.includes(str)) {
                        itemTexturePaths.push(str);
                      } else if (matchesVanillaPath && !itemTextureVanillaPaths.includes(str)) {
                        itemTextureVanillaPaths.push(str);
                      }
                    }
                  } else if ((itemTexture.textures as any).path) {
                    const texturePath = (itemTexture.textures as any).path;
                    const matchesVanillaPath = await Database.matchesVanillaPath(texturePath);

                    if (!matchesVanillaPath && !itemTexturePaths.includes(texturePath)) {
                      itemTexturePaths.push(texturePath);
                    } else if (matchesVanillaPath && !itemTextureVanillaPaths.includes(texturePath)) {
                      itemTextureVanillaPaths.push(texturePath);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.entityTypeResource) {
        textureCountPi.incrementFeature("Entity Resource Count");
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const entityTypeResourceDef = await EntityTypeResourceDefinition.ensureOnFile(projectItem.availableFile);

          if (entityTypeResourceDef?.data) {
            const desc = entityTypeResourceDef.data;
            const textures = desc.textures;

            if (textures) {
              let textureCount = 0;

              for (const texture in textures) {
                const texturePath = textures[texture];

                if (texturePath) {
                  const matchesVanillaPath = await Database.matchesVanillaPath(texturePath);

                  if (!matchesVanillaPath) {
                    if (!textureHandles.includes(texturePath)) {
                      textureHandles.push(texturePath);
                    }

                    if (!entityTexturePaths.includes(texturePath)) {
                      entityTexturePaths.push(texturePath);
                    }

                    const tex = textures[texture];

                    if (tex && !allTexturePaths.includes(tex)) {
                      allTexturePaths.push(tex);
                    }
                  } else if (!entityVanillaTexturePaths.includes(texturePath)) {
                    entityVanillaTexturePaths.push(texturePath);
                  }
                }
                textureCount++;
              }

              textureCountPi.incrementFeature("Texture References", "Count", textureCount);
              textureCountPi.incrementFeature("Entity References", "Count", textureCount);
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.attachableResourceJson) {
        textureCountPi.incrementFeature("Attachable Resource Count");

        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          const attachableResourceDef = await AttachableResourceDefinition.ensureOnFile(projectItem.availableFile);

          if (attachableResourceDef?.data) {
            const desc = attachableResourceDef.data;
            const textures = desc.textures;

            if (textures) {
              let textureCount = 0;

              for (const texture in textures) {
                const texturePath = textures[texture];

                if (texturePath) {
                  if (!textureHandles.includes(texturePath)) {
                    textureHandles.push(texturePath);
                  }

                  if (!attachableTextureRefs.includes(texturePath)) {
                    attachableTextureRefs.push(texturePath);
                  }

                  if (!allTexturePaths.includes(texturePath)) {
                    allTexturePaths.push(texturePath);
                  }

                  textureCount++;
                }
              }

              textureCountPi.incrementFeature("Texture References", "Count", textureCount);
              textureCountPi.incrementFeature("Attachable References", "Count", textureCount);
            }
          }
        }
      }

      if (projectItem.itemType === ProjectItemType.texture || projectItem.itemType === ProjectItemType.uiTexture) {
        await projectItem.ensureFileStorage();

        if (projectItem.availableFile) {
          textureCountPi.incrementFeature("File Count");

          const textureResourceDef = await TextureDefinition.ensureOnFile(projectItem.availableFile);

          if (textureResourceDef && textureResourceDef.data) {
            const texturePath = textureResourceDef.getReferencePath();

            if (texturePath && projectItem.projectPath) {
              contentIndex.insert(texturePath, projectItem.projectPath, AnnotationCategory.textureFile);
            }
          }
        }
      }
    }

    if (textureHandles.length > 0) {
      textureCountPi.incrementFeature("Unique Texture Handles (estimated)", "Count", textureHandles.length);
    }
    if (allTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Texture Paths", "Count", allTexturePaths.length);
    }

    if (particleTextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique Particle Texture References", "Count", particleTextureRefs.length);
    }
    if (particleVanillaTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Particle Texture Paths", "Count", particleTexturePaths.length);
    }

    if (particleVanillaTexturePaths.length > 0) {
      textureCountPi.incrementFeature(
        "Unique Particle Texture Vanilla Paths",
        "Count",
        particleVanillaTexturePaths.length
      );
    }

    if (jsonUITextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique JSON UI Texture References", "Count", jsonUITextureRefs.length);
    }

    if (jsonUITexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique JSON UI Texture Paths", "Count", jsonUITexturePaths.length);
    }
    if (jsonUIVanillaTexturePaths.length > 0) {
      textureCountPi.incrementFeature(
        "Unique JSON UI Texture Vanilla Paths",
        "Count",
        jsonUIVanillaTexturePaths.length
      );
    }

    if (entityTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Entity Texture Paths", "Count", entityTexturePaths.length);
    }

    if (entityVanillaTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Entity Texture Vanilla Paths", "Count", entityVanillaTexturePaths.length);
    }

    if (attachableTextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique Attachable Texture References", "Count", attachableTextureRefs.length);
    }

    if (terrainTextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique Terrain Texture References", "Count", terrainTextureRefs.length);
    }

    if (terrainTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Terrain Texture Paths", "Count", terrainTexturePaths.length);
    }

    if (itemTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Item Texture Paths", "Count", itemTexturePaths.length);
    }

    if (flipbookTextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique Flipbook Texture References", "Count", flipbookTextureRefs.length);
    }

    if (flipbookTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Flipbook Texture Paths", "Count", flipbookTexturePaths.length);
    }

    if (blockTextureRefs.length > 0) {
      textureCountPi.incrementFeature("Unique Block Texture References", "Count", blockTextureRefs.length);
    }

    if (blockTexturePaths.length > 0) {
      textureCountPi.incrementFeature("Unique Block Texture Paths", "Count", blockTexturePaths.length);
    }

    if (entitySpawnEggTextures.length > 0) {
      textureCountPi.incrementFeature(
        "Unique Entity Spawn Egg Texture References",
        "Count",
        entitySpawnEggTextures.length
      );
    }

    if (this.performAddOnValidations && textureHandles.length > 800) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          100,
          "Uses more than 800 texture handles, which could impact overall Minecraft usage",
          undefined,
          textureHandles.length
        )
      );
    }

    return items;
  }
}
