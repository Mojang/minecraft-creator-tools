// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RelationsIndex: Pre-built lookup indexes for fast project item relation resolution.
 *
 * ## Problem
 * Without an index, each definition's `addChildItems()` method iterates ALL items of
 * cross-referenced types (e.g., each entity behavior scans ALL entity resources to find
 * matching IDs). With ~500 entities and ~500 entity resources, this is 250K iterations
 * with file loading — O(n²) behavior that causes relations to take 4+ minutes on vanilla.
 *
 * ## Solution
 * Build ID→ProjectItem[] maps in a single O(n) pass before processing relations.
 * Handlers then do O(1) lookups instead of O(n) scans.
 *
 * ## Indexed Types
 * - Entity type resources by ID (minecraft:pig → ProjectItem)
 * - Spawn rules by entity ID (minecraft:pig → ProjectItem)
 * - Entity behaviors by ID (minecraft:pig → ProjectItem)
 * - Attachable resources by ID
 * - Item types by ID
 * - Animations by animation ID (one file → multiple IDs)
 * - Animation controllers by controller ID
 * - Render controllers by controller ID
 * - Models by geometry identifier (one file → multiple identifiers)
 * - Loot tables by pack-relative path
 * - Textures by canonicalized relative path
 *
 * ## Usage
 * ```typescript
 * const index = new RelationsIndex();
 * await index.build(project);
 * // Then pass to calculateForItem
 * await handler.addChildItems(project, item, index);
 * ```
 */

import AnimationControllerResourceDefinition from "../minecraft/AnimationControllerResourceDefinition";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import FeatureDefinition from "../minecraft/FeatureDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import RenderControllerSetDefinition from "../minecraft/RenderControllerSetDefinition";
import SpawnRulesBehaviorDefinition from "../minecraft/SpawnRulesBehaviorDefinition";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";
import ProjectItem from "./ProjectItem";

/** Batch size for parallel content loading */
const PRELOAD_BATCH_SIZE = 100;

export default class RelationsIndex {
  /** Entity type resources indexed by their definition ID (e.g., "minecraft:pig") */
  entityResourcesById = new Map<string, ProjectItem[]>();

  /** Spawn rules indexed by their entity ID (e.g., "minecraft:pig") */
  spawnRulesById = new Map<string, ProjectItem[]>();

  /** Entity type behaviors indexed by their definition ID */
  entityBehaviorsById = new Map<string, ProjectItem[]>();

  /** Attachable resources indexed by their ID */
  attachablesById = new Map<string, ProjectItem[]>();

  /** Item type behaviors indexed by their ID */
  itemTypesById = new Map<string, ProjectItem[]>();

  /** Feature behaviors indexed by their ID */
  featureBehaviorsById = new Map<string, ProjectItem[]>();

  /** Animation resources indexed by individual animation IDs (one file can have multiple) */
  animationsById = new Map<string, ProjectItem[]>();

  /** Animation controller resources indexed by individual controller IDs */
  animationControllersById = new Map<string, ProjectItem[]>();

  /** Render controllers indexed by individual controller IDs */
  renderControllersById = new Map<string, ProjectItem[]>();

  /** Model geometry items indexed by individual geometry identifiers */
  modelsById = new Map<string, ProjectItem[]>();

  /** Loot tables indexed by canonicalized pack-relative path */
  lootTablesByPath = new Map<string, ProjectItem>();

  /** Whether the index has been built */
  isBuilt = false;

  /**
   * Build all indexes from the project's items.
   * Batch-loads content for all relatable item types, parses definitions,
   * and populates lookup maps.
   */
  async build(project: Project, onProgress?: (message: string) => void): Promise<void> {
    // Collect all item types that participate in relations
    const typesToPreload: ProjectItemType[] = [
      ProjectItemType.entityTypeBehavior,
      ProjectItemType.entityTypeResource,
      ProjectItemType.spawnRuleBehavior,
      ProjectItemType.attachableResourceJson,
      ProjectItemType.itemTypeBehavior,
      ProjectItemType.featureBehavior,
      ProjectItemType.animationResourceJson,
      ProjectItemType.animationControllerResourceJson,
      ProjectItemType.renderControllerJson,
      ProjectItemType.modelGeometryJson,
      ProjectItemType.lootTableBehavior,
    ];

    // Phase 1: Batch-load all file contents in parallel chunks
    const allItems: ProjectItem[] = [];
    for (const itemType of typesToPreload) {
      const items = project.getItemsByType(itemType);
      allItems.push(...items);
    }

    if (onProgress) {
      onProgress(`Pre-loading ${allItems.length} items for relations...`);
    }

    // Load content in batches to avoid overwhelming I/O.
    // PRELOAD_BATCH_SIZE is a fixed constant rather than dynamic based on hardware
    // because the bottleneck is file I/O (disk and network storage), not CPU or memory.
    // 100 concurrent loads is a reasonable ceiling for any system.
    for (let i = 0; i < allItems.length; i += PRELOAD_BATCH_SIZE) {
      const batch = allItems.slice(i, i + PRELOAD_BATCH_SIZE);

      await Promise.all(
        batch.map(async (item) => {
          if (!item.isContentLoaded) {
            await item.loadContent();
          }
          // Also resolve file storage for ensureOnFile
          await item.ensureStorage();
        })
      );
    }

    if (onProgress) {
      onProgress(`Building relation indexes...`);
    }

    // Phase 2: Parse definitions and build indexes.
    // Each method reads from a distinct item type and writes to a distinct map,
    // so they can safely run in parallel via Promise.all().
    await Promise.all([
      this._indexEntityResources(project),
      this._indexSpawnRules(project),
      this._indexEntityBehaviors(project),
      this._indexAttachables(project),
      this._indexItemTypes(project),
      this._indexFeatureBehaviors(project),
      this._indexAnimations(project),
      this._indexAnimationControllers(project),
      this._indexRenderControllers(project),
      this._indexModels(project),
      this._indexLootTables(project),
    ]);
    // Note: textures are not indexed here because they require pack-root-relative
    // path resolution that varies per handler. Handlers fall back to getItemsByType().

    this.isBuilt = true;
  }

  private static readonly EMPTY_ITEMS: ProjectItem[] = [];

  /** Look up items in a map, returning empty array if not found */
  getItemsById(map: Map<string, ProjectItem[]>, id: string): ProjectItem[] {
    return map.get(id) || RelationsIndex.EMPTY_ITEMS;
  }

  /**
   * Add unique child items from the index to a parent item.
   * Deduplicates when multiple IDs in `idList` resolve to the same ProjectItem.
   * Returns the set of IDs from `idList` that were successfully matched, so callers
   * can determine which IDs remain unfulfilled.
   */
  addUniqueChildItems(parentItem: ProjectItem, indexMap: Map<string, ProjectItem[]>, idList: string[]): Set<string> {
    const addedItems = new Set<ProjectItem>();
    const matchedIds = new Set<string>();
    for (const id of idList) {
      const matchingItems = this.getItemsById(indexMap, id);
      if (matchingItems.length > 0) {
        matchedIds.add(id);
      }
      for (const candItem of matchingItems) {
        if (!addedItems.has(candItem)) {
          addedItems.add(candItem);
          parentItem.addChildItem(candItem);
        }
      }
    }
    return matchedIds;
  }

  private _addToIndex(map: Map<string, ProjectItem[]>, key: string, item: ProjectItem): void {
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(item);
  }

  private async _indexEntityResources(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.entityTypeResource);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await EntityTypeResourceDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.entityResourcesById, def.id, item);
        }
      }
    }
  }

  private async _indexSpawnRules(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.spawnRuleBehavior);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await SpawnRulesBehaviorDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.spawnRulesById, def.id, item);
        }
      }
    }
  }

  private async _indexEntityBehaviors(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.entityTypeBehavior);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await EntityTypeDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.entityBehaviorsById, def.id, item);
        }
      }
    }
  }

  private async _indexAttachables(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.attachableResourceJson);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await AttachableResourceDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.attachablesById, def.id, item);
        }
      }
    }
  }

  private async _indexItemTypes(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.itemTypeBehavior);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await ItemTypeDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.itemTypesById, def.id, item);
        }
      }
    }
  }

  private async _indexAnimations(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.animationResourceJson);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await AnimationResourceDefinition.ensureOnFile(item.primaryFile);
        if (def?.idList) {
          for (const id of def.idList) {
            this._addToIndex(this.animationsById, id, item);
          }
        }
      }
    }
  }

  private async _indexAnimationControllers(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.animationControllerResourceJson);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await AnimationControllerResourceDefinition.ensureOnFile(item.primaryFile);
        if (def?.idList) {
          for (const id of def.idList) {
            this._addToIndex(this.animationControllersById, id, item);
          }
        }
      }
    }
  }

  private async _indexRenderControllers(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.renderControllerJson);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await RenderControllerSetDefinition.ensureOnFile(item.primaryFile);
        if (def?.idList) {
          for (const id of def.idList) {
            this._addToIndex(this.renderControllersById, id, item);
          }
        }
      }
    }
  }

  private async _indexModels(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.modelGeometryJson);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await ModelGeometryDefinition.ensureOnFile(item.primaryFile);
        if (def) {
          for (const id of def.identifiers) {
            this._addToIndex(this.modelsById, id, item);
          }
        }
      }
    }
  }

  private async _indexLootTables(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.lootTableBehavior);
    for (const item of items) {
      if (item.projectPath) {
        this.lootTablesByPath.set(item.projectPath, item);
      }
    }
  }

  private async _indexFeatureBehaviors(project: Project): Promise<void> {
    const items = project.getItemsByType(ProjectItemType.featureBehavior);
    for (const item of items) {
      if (item.primaryFile) {
        const def = await FeatureDefinition.ensureOnFile(item.primaryFile);
        if (def?.id) {
          this._addToIndex(this.featureBehaviorsById, def.id, item);
        }
      }
    }
  }
}
