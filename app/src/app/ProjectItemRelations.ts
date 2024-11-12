import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import MusicDefinitionCatalogDefinition from "../minecraft/MusicDefinitionCatalogDefinition";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
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
            entityTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.entityTypeResource) {
        await item.ensureStorage();

        if (item.file) {
          const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(item.file);

          if (entityTypeResource) {
            entityTypeResource.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundDefinitionCatalog) {
        await item.ensureStorage();

        if (item.file) {
          const soundDefCat = await SoundDefinitionCatalogDefinition.ensureOnFile(item.file);

          if (soundDefCat) {
            soundDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.musicDefinitionJson) {
        await item.ensureStorage();

        if (item.file) {
          const musicDefCat = await MusicDefinitionCatalogDefinition.ensureOnFile(item.file);

          if (musicDefCat) {
            musicDefCat.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.soundCatalog) {
        await item.ensureStorage();

        if (item.file) {
          const soundCat = await SoundCatalogDefinition.ensureOnFile(item.file);

          if (soundCat) {
            soundCat.addChildItems(project, item);
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
              entityTypeResource.deleteLink(rel.childItem);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.soundCatalog) {
          await item.ensureStorage();

          if (rel.parentItem.file) {
            const soundCat = await SoundDefinitionCatalogDefinition.ensureOnFile(rel.parentItem.file);

            if (soundCat) {
              soundCat.deleteLink(rel.childItem);
            }
          }
        }
      }
    }

    await this.calculate(item.project);
  }
}
