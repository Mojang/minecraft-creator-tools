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

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const allTextures: string[] = [];
    const allTexturesLeaf: string[] = [];
    const blockTextures: string[] = [];
    const blockTexturesLeaf: string[] = [];
    const entityTextures: string[] = [];
    const entityTexturesLeaf: string[] = [];
    const particleTextures: string[] = [];
    const particleTexturesLeaf: string[] = [];
    const terrainTextures: string[] = [];
    const terrainTexturesLeaf: string[] = [];
    const itemTextures: string[] = [];
    const itemTexturesLeaf: string[] = [];
    const entitySpawnEggTextures: string[] = [];
    const textureCountPi = new ProjectInfoItem(InfoItemType.featureAggregate, this.id, 1, "Textures");
    items.push(textureCountPi);

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

                if (!allTextures.includes(resourceId)) {
                  allTextures.push(resourceId);
                }

                if (!blockTextures.includes(resourceId)) {
                  blockTextures.push(resourceId);
                }

                if (!allTexturesLeaf.includes(resource.textures)) {
                  allTexturesLeaf.push(resource.textures);
                }

                if (!blockTexturesLeaf.includes(resource.textures)) {
                  blockTexturesLeaf.push(resource.textures);
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.particleJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const particleEffect = await ParticleEffectResourceDefinition.ensureParticleEffectResourceDefinitionOnFile(
            projectItem.file
          );

          const desc = particleEffect?.particleEffectWrapper?.particle_effect.description;

          if (desc) {
            if (desc.identifier && desc.basic_render_parameters?.texture) {
              if (!allTextures.includes(desc.identifier)) {
                allTextures.push(desc.identifier);
              }

              if (!particleTextures.includes(desc.identifier)) {
                particleTextures.push(desc.identifier);
              }

              if (!allTexturesLeaf.includes(desc.basic_render_parameters.texture)) {
                allTexturesLeaf.push(desc.basic_render_parameters.texture);
              }

              if (!particleTexturesLeaf.includes(desc.basic_render_parameters.texture)) {
                particleTexturesLeaf.push(desc.basic_render_parameters.texture);
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

                if (!allTextures.includes(terrainTextureId)) {
                  allTextures.push(terrainTextureId);
                }

                if (!terrainTextures.includes(terrainTextureId)) {
                  terrainTextures.push(terrainTextureId);
                }

                if (typeof terrainTexture.textures === "string") {
                  if (!allTexturesLeaf.includes(terrainTexture.textures)) {
                    allTexturesLeaf.push(terrainTexture.textures);
                  }

                  if (!terrainTexturesLeaf.includes(terrainTexture.textures)) {
                    terrainTexturesLeaf.push(terrainTexture.textures);
                  }
                } else {
                  for (let str of terrainTexture.textures) {
                    if (!allTexturesLeaf.includes(str)) {
                      allTexturesLeaf.push(str);
                    }

                    if (!terrainTexturesLeaf.includes(str)) {
                      terrainTexturesLeaf.push(str);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (projectItem.itemType === ProjectItemType.itemTextureJson) {
        await projectItem.ensureFileStorage();

        if (projectItem.file) {
          const itemTextureCat = await ItemTextureCatalogDefinition.ensureItemTextureCatalogDefinitionOnFile(
            projectItem.file
          );

          if (itemTextureCat && itemTextureCat.itemTexture && itemTextureCat.itemTexture.texture_data) {
            for (const itemTextureId in itemTextureCat.itemTexture.texture_data) {
              const itemTexture = itemTextureCat.itemTexture.texture_data[itemTextureId];

              if (itemTexture && itemTexture.textures) {
                textureCountPi.incrementFeature("Item Texture Resource Count");

                if (!allTextures.includes(itemTextureId)) {
                  allTextures.push(itemTextureId);
                }

                if (!itemTextures.includes(itemTextureId)) {
                  itemTextures.push(itemTextureId);
                }

                if (typeof itemTexture.textures === "string") {
                  if (!allTexturesLeaf.includes(itemTexture.textures)) {
                    allTexturesLeaf.push(itemTexture.textures);
                  }

                  if (!itemTexturesLeaf.includes(itemTexture.textures)) {
                    itemTexturesLeaf.push(itemTexture.textures);
                  }
                } else {
                  for (let str of itemTexture.textures) {
                    if (!allTexturesLeaf.includes(str)) {
                      allTexturesLeaf.push(str);
                    }

                    if (!itemTexturesLeaf.includes(str)) {
                      itemTexturesLeaf.push(str);
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
          const entityTypeResourceDef = await EntityTypeResourceDefinition.ensureEntityTypeResourceDefinitionOnFile(
            projectItem.file
          );

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
                if (!allTextures.includes(texture)) {
                  allTextures.push(texture);
                }

                if (!entityTextures.includes(texture)) {
                  entityTextures.push(texture);
                }
                if (!allTexturesLeaf.includes(textures[texture])) {
                  allTexturesLeaf.push(textures[texture]);
                }

                if (!entityTexturesLeaf.includes(textures[texture])) {
                  entityTexturesLeaf.push(textures[texture]);
                }

                textureCount++;
              }

              if (desc.spawn_egg && desc.spawn_egg.texture) {
                textureCountPi.incrementFeature("Texture References");
                textureCountPi.incrementFeature("Entity Spawn Egg References");

                if (!allTextures.includes(desc.spawn_egg.texture)) {
                  allTextures.push(desc.spawn_egg.texture);
                }

                if (!entitySpawnEggTextures.includes(desc.spawn_egg.texture)) {
                  entitySpawnEggTextures.push(desc.spawn_egg.texture);
                }
              }

              textureCountPi.incrementFeature("Texture References", textureCount);
              textureCountPi.incrementFeature("Entity References", textureCount);
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

    textureCountPi.incrementFeature("Unique Texture References", allTextures.length);
    textureCountPi.incrementFeature("Unique Texture References (Leaf)", allTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Particle Texture References", particleTextures.length);
    textureCountPi.incrementFeature("Unique Particle Texture References (Leaf)", particleTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Entity Texture References", entityTextures.length);
    textureCountPi.incrementFeature("Unique Entity Texture References (Leaf)", entityTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Terrain Texture References", terrainTextures.length);
    textureCountPi.incrementFeature("Unique Terrain Texture References (Leaf)", terrainTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Item Texture References", itemTextures.length);
    textureCountPi.incrementFeature("Unique Item Texture References (Leaf)", itemTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Block Texture References", blockTextures.length);
    textureCountPi.incrementFeature("Unique Block Texture References (Leaf)", blockTexturesLeaf.length);
    textureCountPi.incrementFeature("Unique Entity Spawn Egg Texture References", entitySpawnEggTextures.length);

    return items;
  }
}
