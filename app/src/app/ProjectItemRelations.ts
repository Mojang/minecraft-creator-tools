import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import MusicDefinitionCatalogDefinition from "../minecraft/MusicDefinitionCatalogDefinition";
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

        if (item.file) {
          const entityTypeBehavior = await EntityTypeDefinition.ensureOnFile(item.file);

          if (entityTypeBehavior) {
            await entityTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.entityTypeResource) {
        await item.ensureStorage();

        if (item.file) {
          const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(item.file);

          if (entityTypeResource) {
            await entityTypeResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.attachableResourceJson) {
        await item.ensureStorage();

        if (item.file) {
          const attachableResource = await AttachableResourceDefinition.ensureOnFile(item.file);

          if (attachableResource) {
            await attachableResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.itemTextureJson) {
        await item.ensureStorage();

        if (item.file) {
          const itemTextures = await ItemTextureCatalogDefinition.ensureOnFile(item.file);

          if (itemTextures) {
            await itemTextures.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
        await item.ensureStorage();

        if (item.file) {
          const terrainTexture = await TerrainTextureCatalogDefinition.ensureOnFile(item.file);

          if (terrainTexture) {
            await terrainTexture.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundDefinitionCatalog) {
        await item.ensureStorage();

        if (item.file) {
          const soundDefCat = await SoundDefinitionCatalogDefinition.ensureOnFile(item.file);

          if (soundDefCat) {
            await soundDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.musicDefinitionJson) {
        await item.ensureStorage();

        if (item.file) {
          const musicDefCat = await MusicDefinitionCatalogDefinition.ensureOnFile(item.file);

          if (musicDefCat) {
            await musicDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundCatalog) {
        await item.ensureStorage();

        if (item.file) {
          const soundCat = await SoundCatalogDefinition.ensureOnFile(item.file);

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

          if (rel.parentItem.file) {
            const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(rel.parentItem.file);

            if (entityTypeResource) {
              await entityTypeResource.deleteLink(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.attachableResourceJson) {
          await item.ensureStorage();

          if (rel.parentItem.file) {
            const attachableResource = await AttachableResourceDefinition.ensureOnFile(rel.parentItem.file);

            if (attachableResource) {
              await attachableResource.deleteLink(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.soundCatalog) {
          await item.ensureStorage();

          if (rel.parentItem.file) {
            const soundCat = await SoundDefinitionCatalogDefinition.ensureOnFile(rel.parentItem.file);

            if (soundCat) {
              await soundCat.deleteLink(rel.childItem);
            }
          }
        }
      }
    }

    await this.calculate(item.project);
  }
}
