import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import JsonUIResourceDefinition from "../minecraft/JsonUIResourceDefinition";
import MusicDefinitionCatalogDefinition from "../minecraft/MusicDefinitionCatalogDefinition";
import ParticleEffectResourceDefinition from "../minecraft/ParticleEffectResourceDefinition";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
import TerrainTextureCatalogDefinition from "../minecraft/TerrainTextureCatalogDefinition";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import ProjectItem from "./ProjectItem";

export default class ProjectItemRelations {
  static async calculate(project: Project) {
    const items = project.getItemsCopy();

    // clear all existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
    }

    for (const item of items) {
      if (item.itemType === ProjectItemType.entityTypeBehavior) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const entityTypeBehavior = await EntityTypeDefinition.ensureOnFile(item.defaultFile);

          if (entityTypeBehavior) {
            await entityTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.itemTypeBehavior) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const itemTypeBehavior = await ItemTypeDefinition.ensureOnFile(item.defaultFile);

          if (itemTypeBehavior) {
            await itemTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.blockTypeBehavior) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const blockTypeBehavior = await BlockTypeDefinition.ensureOnFile(item.defaultFile);

          if (blockTypeBehavior) {
            await blockTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.entityTypeResource) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(item.defaultFile);

          if (entityTypeResource) {
            await entityTypeResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.particleJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const particleResource = await ParticleEffectResourceDefinition.ensureOnFile(item.defaultFile);

          if (particleResource) {
            await particleResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.uiJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const jsonUi = await JsonUIResourceDefinition.ensureOnFile(item.defaultFile);

          if (jsonUi) {
            await jsonUi.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.attachableResourceJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const attachableResource = await AttachableResourceDefinition.ensureOnFile(item.defaultFile);

          if (attachableResource) {
            await attachableResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.itemTextureJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const itemTextures = await ItemTextureCatalogDefinition.ensureOnFile(item.defaultFile);

          if (itemTextures) {
            await itemTextures.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const terrainTexture = await TerrainTextureCatalogDefinition.ensureOnFile(item.defaultFile);

          if (terrainTexture) {
            await terrainTexture.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundDefinitionCatalog) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const soundDefCat = await SoundDefinitionCatalogDefinition.ensureOnFile(item.defaultFile);

          if (soundDefCat) {
            await soundDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.musicDefinitionJson) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const musicDefCat = await MusicDefinitionCatalogDefinition.ensureOnFile(item.defaultFile);

          if (musicDefCat) {
            await musicDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundCatalog) {
        await item.ensureStorage();

        if (item.defaultFile) {
          const soundCat = await SoundCatalogDefinition.ensureOnFile(item.defaultFile);

          if (soundCat) {
            await soundCat.addChildItems(project, item);
          }
        }
      }
    }
  }

  static async deleteLinksFromParents(item: ProjectItem) {
    if (!item.parentItems || item.parentItems.length === 0) {
      return;
    }

    for (const rel of item.parentItems) {
      if (rel.parentItem && rel.childItem) {
        if (rel.parentItem.itemType === ProjectItemType.entityTypeResource) {
          await item.ensureStorage();

          if (rel.parentItem.defaultFile) {
            const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(rel.parentItem.defaultFile);

            if (entityTypeResource) {
              await entityTypeResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.particleJson) {
          await item.ensureStorage();

          if (rel.parentItem.defaultFile) {
            const particleResource = await ParticleEffectResourceDefinition.ensureOnFile(rel.parentItem.defaultFile);

            if (particleResource) {
              await particleResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.attachableResourceJson) {
          await item.ensureStorage();

          if (rel.parentItem.defaultFile) {
            const attachableResource = await AttachableResourceDefinition.ensureOnFile(rel.parentItem.defaultFile);

            if (attachableResource) {
              await attachableResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.soundCatalog) {
          await item.ensureStorage();

          if (rel.parentItem.defaultFile) {
            const soundCat = await SoundDefinitionCatalogDefinition.ensureOnFile(rel.parentItem.defaultFile);

            if (soundCat) {
              await soundCat.deleteLinkToChild(rel.childItem);
            }
          }
        }
      }
    }

    await this.calculate(item.project);
  }
}
