// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import BiomeBehaviorDefinition from "../minecraft/BiomeBehaviorDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import FeatureDefinition from "../minecraft/FeatureDefinition";
import FeatureRuleDefinition from "../minecraft/FeatureRuleDefinition";
import FlipbookTextureCatalogDefinition from "../minecraft/FlipbookTextureCatalogDefinition";
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
import TextureSetDefinition from "../minecraft/TextureSetDefinition";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import ProjectItem from "./ProjectItem";
import RelationsIndex from "./RelationsIndex";
import Log from "../core/Log";

interface IDefinitionHandler {
  addChildItems(project: Project, item: ProjectItem, index?: RelationsIndex): Promise<void>;
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
  [ProjectItemType.flipbookTexturesJson, FlipbookTextureCatalogDefinition],
  [ProjectItemType.textureSetJson, TextureSetDefinition],
  [ProjectItemType.texture, TextureDefinition],
  [ProjectItemType.biomeBehavior, BiomeBehaviorDefinition],
  [ProjectItemType.featureBehavior, FeatureDefinition],
  [ProjectItemType.featureRuleBehavior, FeatureRuleDefinition],
]);

export type RelationsProgressCallback = (message: string, percent?: number) => void;

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

  static async calculate(project: Project, onProgress?: RelationsProgressCallback) {
    const items = project.getItemsCopy();

    // clear all existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
    }

    // Only process items that have relation handlers - skip the rest
    const itemsToProcess = items.filter((item) => ITEM_TYPE_CONFIG.has(item.itemType));
    const totalItems = itemsToProcess.length;

    if (totalItems === 0) {
      return;
    }

    // Pre-build the relations index for O(1) lookups instead of O(n²) scanning
    const index = new RelationsIndex();
    if (onProgress) {
      onProgress("Building relations index...", 0);
    }
    const indexStartTime = Date.now();
    await index.build(project);
    const indexBuildTime = Date.now() - indexStartTime;
    Log.verbose(`[RelationsIndex] Index built in ${indexBuildTime}ms, isBuilt=${index.isBuilt}, entityResources=${index.entityResourcesById.size}, animations=${index.animationsById.size}, models=${index.modelsById.size}`);

    // Report progress at most ~20 times total (every 5% of progress)
    const progressInterval = Math.max(100, Math.floor(totalItems / 20));
    let lastReportedPercent = -1;

    const processStartTime = Date.now();
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      await this.calculateForItem(item, index);

      // Report progress only when percent changes by at least 5%
      if (onProgress && (i % progressInterval === 0 || i === totalItems - 1)) {
        const percent = Math.floor((i / totalItems) * 100);
        if (percent !== lastReportedPercent) {
          lastReportedPercent = percent;
          onProgress(`Calculating relations... (${percent}%)`, percent);
        }
      }
    }
    const processTime = Date.now() - processStartTime;
    Log.verbose(`[RelationsIndex] Relations processing completed in ${processTime}ms for ${itemsToProcess.length} items`);
  }

  static async calculateForItems(items: ProjectItem[], onProgress?: RelationsProgressCallback) {
    // Only process items that have relation handlers
    const itemsToProcess = items.filter((item) => ITEM_TYPE_CONFIG.has(item.itemType));
    const totalItems = itemsToProcess.length;

    if (totalItems === 0) {
      return;
    }

    // Pre-build the relations index if we have enough items to justify the overhead
    let index: RelationsIndex | undefined;
    if (itemsToProcess.length > 0 && itemsToProcess[0].project) {
      index = new RelationsIndex();
      if (onProgress) {
        onProgress("Building relations index...", 0);
      }
      await index.build(itemsToProcess[0].project);
    }

    // Report progress at most ~20 times total
    const progressInterval = Math.max(100, Math.floor(totalItems / 20));
    let lastReportedPercent = -1;

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      await this.calculateForItem(item, index);

      // Report progress only when percent changes
      if (onProgress && (i % progressInterval === 0 || i === totalItems - 1)) {
        const percent = Math.floor((i / totalItems) * 100);
        if (percent !== lastReportedPercent) {
          lastReportedPercent = percent;
          onProgress(`Calculating relations... (${percent}%)`, percent);
        }
      }
    }
  }

  static async calculateForItem(item: ProjectItem, index?: RelationsIndex) {
    const project = item.project;

    const handlerClass = ITEM_TYPE_CONFIG.get(item.itemType);

    if (handlerClass) {
      await item.ensureStorage();

      if (item.primaryFile) {
        const handler = await handlerClass.ensureOnFile(item.primaryFile);

        if (handler) {
          await handler.addChildItems(project, item, index);
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
