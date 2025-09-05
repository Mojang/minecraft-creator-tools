import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import BiomeBehaviorDefinition from "../minecraft/BiomeBehaviorDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import ItemTextureCatalogDefinition from "../minecraft/ItemTextureCatalogDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import JigsawProcessorListDefinition from "../minecraft/JigsawProcessorListDefinition";
import JigsawStructureDefinition from "../minecraft/JigsawStructureDefinition";
import JigsawStructureSetDefinition from "../minecraft/JigsawStructureSetDefinition";
import JigsawTemplatePoolDefinition from "../minecraft/JigsawTemplatePoolDefinition";
import JsonUIResourceDefinition from "../minecraft/JsonUIResourceDefinition";
import LootTableBehaviorDefinition from "../minecraft/LootTableBehaviorDefinition";
import MusicDefinitionCatalogDefinition from "../minecraft/MusicDefinitionCatalogDefinition";
import ParticleEffectResourceDefinition from "../minecraft/ParticleEffectResourceDefinition";
import RecipeBehaviorDefinition from "../minecraft/RecipeBehaviorDefinition";
import SkinCatalogDefinition from "../minecraft/SkinCatalogDefinition";
import SoundCatalogDefinition from "../minecraft/SoundCatalogDefinition";
import SoundDefinitionCatalogDefinition from "../minecraft/SoundDefinitionCatalogDefinition";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import TerrainTextureCatalogDefinition from "../minecraft/TerrainTextureCatalogDefinition";
import TextureDefinition from "../minecraft/TextureDefinition";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import ProjectItem from "./ProjectItem";

interface IDefinitionHandler {
  addChildItems(project: Project, item: ProjectItem): Promise<void>;
}

type EnsureOnFileMethod<T> = (file: any) => Promise<T | undefined>;

const ITEM_TYPE_CONFIG = new Map<ProjectItemType, { ensureOnFile: EnsureOnFileMethod<IDefinitionHandler> }>([
  [ProjectItemType.entityTypeBehavior, EntityTypeDefinition],
  [ProjectItemType.itemTypeBehavior, ItemTypeDefinition],
  [ProjectItemType.blockTypeBehavior, BlockTypeDefinition],
  [ProjectItemType.entityTypeResource, EntityTypeResourceDefinition],
  [ProjectItemType.skinCatalogJson, SkinCatalogDefinition],
  [ProjectItemType.lootTableBehavior, LootTableBehaviorDefinition],
  [ProjectItemType.particleJson, ParticleEffectResourceDefinition],
  [ProjectItemType.uiJson, JsonUIResourceDefinition],
  [ProjectItemType.attachableResourceJson, AttachableResourceDefinition],
  [ProjectItemType.itemTextureJson, ItemTextureCatalogDefinition],
  [ProjectItemType.terrainTextureCatalogResourceJson, TerrainTextureCatalogDefinition],
  [ProjectItemType.soundDefinitionCatalog, SoundDefinitionCatalogDefinition],
  [ProjectItemType.musicDefinitionJson, MusicDefinitionCatalogDefinition],
  [ProjectItemType.soundCatalog, SoundCatalogDefinition],
  [ProjectItemType.recipeBehavior, RecipeBehaviorDefinition],
  [ProjectItemType.spawnRuleBehavior, SpawnRulesBehaviorDefinition],
  [ProjectItemType.jigsawStructureSet, JigsawStructureSetDefinition],
  [ProjectItemType.jigsawStructure, JigsawStructureDefinition],
  [ProjectItemType.jigsawTemplatePool, JigsawTemplatePoolDefinition],
  [ProjectItemType.jigsawProcessorList, JigsawProcessorListDefinition],
  [ProjectItemType.texture, TextureDefinition],
  [ProjectItemType.biomeBehavior, BiomeBehaviorDefinition],
]);

export default class ProjectItemRelations {
  static clearDependencies(project: Project) {
    ProjectItemRelations.clearDependenciesForItems(project.getItemsCopy());
  }

  static clearDependenciesForItems(items: ProjectItem[]) {
    // clear all existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
    }
  }

  static async calculate(project: Project) {
    const items = project.getItemsCopy();

    // clear all existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
    }

    for (const item of items) {
      await this.calculateForItem(item);
    }
  }

  static async calculateForItems(items: ProjectItem[]) {
    for (const item of items) {
      await this.calculateForItem(item);
    }
  }

  static async calculateForItem(item: ProjectItem) {
    const project = item.project;

    const handlerClass = ITEM_TYPE_CONFIG.get(item.itemType);

    if (handlerClass) {
      await item.ensureStorage();

      if (item.primaryFile) {
        const handler = await handlerClass.ensureOnFile(item.primaryFile);

        if (handler) {
          await handler.addChildItems(project, item);
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
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (rel.parentItem.primaryFile) {
            const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(rel.parentItem.primaryFile);

            if (entityTypeResource) {
              await entityTypeResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.particleJson) {
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (rel.parentItem.primaryFile) {
            const particleResource = await ParticleEffectResourceDefinition.ensureOnFile(rel.parentItem.primaryFile);

            if (particleResource) {
              await particleResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.attachableResourceJson) {
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (rel.parentItem.primaryFile) {
            const attachableResource = await AttachableResourceDefinition.ensureOnFile(rel.parentItem.primaryFile);

            if (attachableResource) {
              await attachableResource.deleteLinkToChild(rel);
            }
          }
        } else if (rel.parentItem.itemType === ProjectItemType.soundCatalog) {
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (rel.parentItem.primaryFile) {
            const soundCat = await SoundDefinitionCatalogDefinition.ensureOnFile(rel.parentItem.primaryFile);

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
