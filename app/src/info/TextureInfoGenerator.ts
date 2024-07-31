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
import StorageUtilities from "../storage/StorageUtilities";
import IFolder from "../storage/IFolder";
import Utilities from "../core/Utilities";
import JsonUIResourceDefinition from "../minecraft/JsonUIResourceDefinition";
import { IJsonUIControl } from "../minecraft/IJsonUIScreen";
import ContentIndex from "../core/ContentIndex";

export default class TextureInfoGenerator implements IProjectInfoGenerator {
  id = "TEXTURE";
  title = "Texture Validation";

  performAddOnValidations = false;

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Textures" };

      default:
        return { title: topicId.toString() };
    }
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.textureCount = infoSet.getSummedNumberValue("TEXTURE", 1);
  }

  static async matchesVanillaPath(path: string, resourcePackFolder: IFolder | null) {
    if (resourcePackFolder && resourcePackFolder.folderCount > 0) {
      path = Utilities.ensureStartsWithSlash(path);

      const folder = await resourcePackFolder.getFolderFromRelativePath(StorageUtilities.getFolderPath(path));

      if (!folder) {
        return false;
      }

      const exists = await folder.exists();

      if (!exists) {
        return false;
      }

      const itemName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(path)).toLowerCase();

      await folder.load();

      for (let fileName in folder.files) {
        if (fileName && StorageUtilities.getBaseFromName(fileName).toLowerCase() === itemName) {
          return true;
        }
      }
    } else {
      await Database.loadVanillaInfoData();

      if (Database.vanillaContentIndex) {
        const matches = await Database.vanillaContentIndex.getMatches(path);
        if (matches && matches.length > 0) {
          return true;
        }
      }
    }

    return false;
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

    const rpFolder = await Database.loadDefaultResourcePack();

    for (const projectItem of project.items) {
      if (projectItem.itemType === ProjectItemType.blocksCatalogResourceJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const blockCat = await BlocksCatalogDefinition.ensureBlocksCatalogResourceDefinitionOnFile(projectItem.file);

          if (blockCat && blockCat.blocksCatalog) {
            for (const resourceId in blockCat.blocksCatalog) {
              const resource = blockCat.blocksCatalog[resourceId];

              if (resource && resource.textures) {
                textureCountPi.incrementFeature("Block Resource Count");
                if (!blockTextureRefs.includes(resourceId)) {
                  blockTextureRefs.push(resourceId);
                }

                if (!allTexturePaths.includes(resource.textures)) {
                  allTexturePaths.push(resource.textures);
                }

                if (!blockTexturePaths.includes(resource.textures)) {
                  blockTexturePaths.push(resource.textures);
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.particleJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const particleEffect = await ParticleEffectResourceDefinition.ensureOnFile(projectItem.file);

          const desc = particleEffect?.wrapper?.particle_effect?.description;

          if (desc) {
            if (desc.identifier && desc.basic_render_parameters?.texture) {
              const texturePath = desc.basic_render_parameters.texture;
              const matchesVanillaPath = await TextureInfoGenerator.matchesVanillaPath(
                desc.basic_render_parameters.texture,
                rpFolder
              );

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

        if (projectItem.file) {
          const jsonUI = await JsonUIResourceDefinition.ensureOnFile(projectItem.file);

          const namespaceId = jsonUI?.namespaceId;

          if (namespaceId && jsonUI.jsonUIScreen) {
            for (const jsonControlId in jsonUI.jsonUIScreen) {
              const jsonControl = jsonUI.jsonUIScreen[jsonControlId] as IJsonUIControl;

              if (jsonControlId !== "namespace" && jsonControl && jsonControl.texture) {
                const texturePath = jsonControl.texture;
                const matchesVanillaPath = await TextureInfoGenerator.matchesVanillaPath(texturePath, rpFolder);

                if (!matchesVanillaPath) {
                  if (!textureHandles.includes(texturePath)) {
                    textureHandles.push(texturePath);
                  }

                  if (!jsonUITextureRefs.includes(jsonControlId)) {
                    jsonUITextureRefs.push(jsonControlId);
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
        }
      } else if (projectItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const terrainTextureCat = await TerrainTextureCatalogDefinition.ensureTerrainTextureCatalogDefinitionOnFile(
            projectItem.file
          );

          if (terrainTextureCat && terrainTextureCat.terrainTexture && terrainTextureCat.terrainTexture.texture_data) {
            for (const terrainTextureId in terrainTextureCat.terrainTexture.texture_data) {
              const terrainTexture = terrainTextureCat.terrainTexture.texture_data[terrainTextureId];

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

        if (projectItem.file) {
          const flipbookTexturesCat = await FlipbookTextureCatalogDefinition.ensureOnFile(projectItem.file);

          if (flipbookTexturesCat && flipbookTexturesCat && flipbookTexturesCat.flipbookTextures) {
            const pathId = projectItem.file.storageRelativePath + "_flipbooktextures";

            if (!allTexturePaths.includes(pathId)) {
              allTexturePaths.push(pathId);
            }

            for (const flipbookTexture of flipbookTexturesCat.flipbookTextures) {
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

        if (projectItem.file) {
          const itemTextureCat = await ItemTextureCatalogDefinition.ensureOnFile(projectItem.file);

          if (itemTextureCat && itemTextureCat.itemTexture && itemTextureCat.itemTexture.texture_data) {
            for (const itemTextureId in itemTextureCat.itemTexture.texture_data) {
              const itemTexture = itemTextureCat.itemTexture.texture_data[itemTextureId];

              if (itemTexture && itemTexture.textures) {
                textureCountPi.incrementFeature("Item Texture Resource Count");

                /*if (!allTextures.includes(itemTextureId)) {
                  allTextures.push(itemTextureId);
                }*/

                if (typeof itemTexture.textures === "string") {
                  /* assume these get atlas'ed into one texture, which is counted as 1, above.
                  if (!allTexturesLeaf.includes(itemTexture.textures)) {
                    allTexturesLeaf.push(itemTexture.textures);
                  }*/

                  const matchesVanillaPath = await TextureInfoGenerator.matchesVanillaPath(
                    itemTexture.textures,
                    rpFolder
                  );

                  if (!matchesVanillaPath && !itemTexturePaths.includes(itemTexture.textures)) {
                    itemTexturePaths.push(itemTexture.textures);
                  } else if (matchesVanillaPath && !itemTextureVanillaPaths.includes(itemTexture.textures)) {
                    itemTextureVanillaPaths.push(itemTexture.textures);
                  }
                } else if (itemTexture.textures) {
                  for (let str of itemTexture.textures) {
                    /*if (!allTexturesLeaf.includes(str)) {
                      allTexturesLeaf.push(str);
                    }*/

                    const matchesVanillaPath = await TextureInfoGenerator.matchesVanillaPath(str, rpFolder);

                    if (!matchesVanillaPath && !itemTexturePaths.includes(str)) {
                      itemTexturePaths.push(str);
                    } else if (matchesVanillaPath && !itemTextureVanillaPaths.includes(str)) {
                      itemTextureVanillaPaths.push(str);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.entityTypeResourceJson) {
        textureCountPi.incrementFeature("Entity Resource Count");
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const entityTypeResourceDef = await EntityTypeResourceDefinition.ensureOnFile(projectItem.file);

          if (
            entityTypeResourceDef?.clientEntityTypeWrapper &&
            entityTypeResourceDef?.clientEntityTypeWrapper["minecraft:client_entity"] &&
            entityTypeResourceDef?.clientEntityTypeWrapper["minecraft:client_entity"].description
          ) {
            const desc = entityTypeResourceDef.clientEntityTypeWrapper["minecraft:client_entity"].description;
            const textures = desc.textures;

            if (textures) {
              let textureCount = 0;

              for (const texture in textures) {
                const texturePath = textures[texture];

                const matchesVanillaPath = await TextureInfoGenerator.matchesVanillaPath(texturePath, rpFolder);

                if (!matchesVanillaPath) {
                  if (!textureHandles.includes(texturePath)) {
                    textureHandles.push(texturePath);
                  }

                  if (!entityTexturePaths.includes(texturePath)) {
                    entityTexturePaths.push(texturePath);
                  }

                  if (!allTexturePaths.includes(textures[texture])) {
                    allTexturePaths.push(textures[texture]);
                  }
                } else if (!entityVanillaTexturePaths.includes(texturePath)) {
                  entityVanillaTexturePaths.push(texturePath);
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

        if (projectItem.file) {
          const attachableResourceDef = await AttachableResourceDefinition.ensureOnFile(projectItem.file);

          if (
            attachableResourceDef?.attachableWrapper &&
            attachableResourceDef?.attachableWrapper["minecraft:attachable"] &&
            attachableResourceDef?.attachableWrapper["minecraft:attachable"].description
          ) {
            const desc = attachableResourceDef.attachableWrapper["minecraft:attachable"].description;
            const textures = desc.textures;

            if (textures) {
              let textureCount = 0;

              for (const texture in textures) {
                const texturePath = textures[texture];

                if (!textureHandles.includes(texturePath)) {
                  textureHandles.push(texturePath);
                }

                if (!attachableTextureRefs.includes(texturePath)) {
                  attachableTextureRefs.push(texturePath);
                }
                if (!allTexturePaths.includes(textures[texture])) {
                  allTexturePaths.push(textures[texture]);
                }

                textureCount++;
              }

              textureCountPi.incrementFeature("Texture References", "Count", textureCount);
              textureCountPi.incrementFeature("Attachable References", "Count", textureCount);
            }
          }
        }
      }

      if (projectItem.itemType === ProjectItemType.texture || projectItem.itemType === ProjectItemType.uiTexture) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          textureCountPi.incrementFeature("File Count");
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
