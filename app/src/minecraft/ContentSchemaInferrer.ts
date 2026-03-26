// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentSchemaInferrer - Analyzes Minecraft content and infers meta-schema representation.
 *
 * This module is the inverse of ContentGenerator: instead of generating native Minecraft
 * content from a meta-schema, it analyzes existing native content and produces an
 * equivalent IMinecraftContentDefinition.
 *
 * Use cases:
 * 1. Import existing projects into simplified format
 * 2. Generate documentation for addons
 * 3. Enable AI-assisted editing of existing content
 * 4. Modernize legacy content with trait-based improvements
 *
 * @see ContentGenerator.ts for the forward transformation
 * @see TraitDetector.ts for trait detection logic
 * @see IContentMetaSchema.ts for schema type definitions
 */

import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import EntityTypeDefinition from "./EntityTypeDefinition";
import BlockTypeDefinition from "./BlockTypeDefinition";
import ItemTypeDefinition from "./ItemTypeDefinition";
import TraitDetector, { ITraitDetectionResult } from "./TraitDetector";
import {
  IMinecraftContentDefinition,
  IEntityTypeDefinition,
  IBlockTypeDefinition,
  IItemTypeDefinition,
  IRecipeDefinition,
  ILootTableDefinition,
  ISpawnRuleDefinition,
  IFeatureDefinition,
  ILootEntry,
  EntityTraitId,
  EntityBehaviorPreset,
} from "./IContentMetaSchema";

// ============================================================================
// INFERRER OPTIONS
// ============================================================================

/**
 * Options for controlling schema inference behavior.
 */
export interface IInferrerOptions {
  /** Minimum confidence threshold for trait detection (0-1). Default: 0.6 */
  minTraitConfidence?: number;

  /** Include raw components not explained by traits. Default: true */
  includeRawComponents?: boolean;

  /** Try to detect namespace from identifiers. Default: true */
  inferNamespace?: boolean;

  /** Include behavior presets in addition to traits. Default: true */
  includeBehaviorPresets?: boolean;

  /** Include component groups as raw data. Default: false */
  includeComponentGroups?: boolean;

  /** Include events as raw data. Default: false */
  includeEvents?: boolean;
}

/**
 * Default inferrer options.
 */
export const DEFAULT_INFERRER_OPTIONS: Required<IInferrerOptions> = {
  minTraitConfidence: 0.6,
  includeRawComponents: true,
  inferNamespace: true,
  includeBehaviorPresets: true,
  includeComponentGroups: false,
  includeEvents: false,
};

// ============================================================================
// INFERENCE RESULT
// ============================================================================

/**
 * Extended result with inference metadata.
 */
export interface IInferenceResult {
  /** The inferred content definition */
  definition: IMinecraftContentDefinition;

  /** Metadata about the inference process */
  metadata: IInferenceMetadata;
}

/**
 * Metadata about how the schema was inferred.
 */
export interface IInferenceMetadata {
  /** Number of entities analyzed */
  entitiesAnalyzed: number;

  /** Number of blocks analyzed */
  blocksAnalyzed: number;

  /** Number of items analyzed */
  itemsAnalyzed: number;

  /** Number of spawn rules analyzed */
  spawnRulesAnalyzed?: number;

  /** Number of loot tables analyzed */
  lootTablesAnalyzed?: number;

  /** Number of recipes analyzed */
  recipesAnalyzed?: number;

  /** Number of features analyzed */
  featuresAnalyzed?: number;

  /** Warnings encountered during inference */
  warnings: string[];

  /** Traits detected across all content */
  allDetectedTraits: {
    entity: Record<string, number>; // trait -> count
    block: Record<string, number>;
    item: Record<string, number>;
  };

  /** Time taken for inference in milliseconds */
  inferenceTimeMs: number;
}

// ============================================================================
// CONTENT SCHEMA INFERRER
// ============================================================================

/**
 * ContentSchemaInferrer - Main class for analyzing content and inferring schema.
 */
export default class ContentSchemaInferrer {
  private _options: Required<IInferrerOptions>;

  constructor(options?: IInferrerOptions) {
    this._options = { ...DEFAULT_INFERRER_OPTIONS, ...options };
  }

  /**
   * Infer a content schema from a project.
   */
  async inferFromProject(project: Project): Promise<IInferenceResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const traitCounts = {
      entity: {} as Record<string, number>,
      block: {} as Record<string, number>,
      item: {} as Record<string, number>,
    };

    // Ensure project items are loaded
    await project.inferProjectItemsFromFilesRootFolder();

    // Analyze entities
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const entityTypes: IEntityTypeDefinition[] = [];

    for (const item of entityItems) {
      try {
        const entityDef = await this.inferEntityFromItem(item);
        if (entityDef) {
          entityTypes.push(entityDef.definition);

          // Count traits
          if (entityDef.definition.traits) {
            for (const trait of entityDef.definition.traits) {
              traitCounts.entity[trait] = (traitCounts.entity[trait] || 0) + 1;
            }
          }
        }
      } catch (e) {
        warnings.push(`Failed to analyze entity ${item.name}: ${e}`);
      }
    }

    // Analyze blocks
    const blockItems = project.items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    const blockTypes: IBlockTypeDefinition[] = [];

    for (const item of blockItems) {
      try {
        const blockDef = await this.inferBlockFromItem(item);
        if (blockDef) {
          blockTypes.push(blockDef.definition);

          if (blockDef.definition.traits) {
            for (const trait of blockDef.definition.traits) {
              traitCounts.block[trait] = (traitCounts.block[trait] || 0) + 1;
            }
          }
        }
      } catch (e) {
        warnings.push(`Failed to analyze block ${item.name}: ${e}`);
      }
    }

    // Analyze items
    const itemItems = project.items.filter((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    const itemTypes: IItemTypeDefinition[] = [];

    for (const item of itemItems) {
      try {
        const itemDef = await this.inferItemFromItem(item);
        if (itemDef) {
          itemTypes.push(itemDef.definition);

          if (itemDef.definition.traits) {
            for (const trait of itemDef.definition.traits) {
              traitCounts.item[trait] = (traitCounts.item[trait] || 0) + 1;
            }
          }
        }
      } catch (e) {
        warnings.push(`Failed to analyze item ${item.name}: ${e}`);
      }
    }

    // Analyze spawn rules
    const spawnRuleItems = project.items.filter((item) => item.itemType === ProjectItemType.spawnRuleBehavior);
    const spawnRules: ISpawnRuleDefinition[] = [];

    for (const item of spawnRuleItems) {
      try {
        const spawnRule = await this.inferSpawnRuleFromItem(item);
        if (spawnRule) {
          spawnRules.push(spawnRule);
        }
      } catch (e) {
        warnings.push(`Failed to analyze spawn rule ${item.name}: ${e}`);
      }
    }

    // Analyze loot tables
    const lootTableItems = project.items.filter((item) => item.itemType === ProjectItemType.lootTableBehavior);
    const lootTables: ILootTableDefinition[] = [];

    for (const item of lootTableItems) {
      try {
        const lootTable = await this.inferLootTableFromItem(item);
        if (lootTable) {
          lootTables.push(lootTable);
        }
      } catch (e) {
        warnings.push(`Failed to analyze loot table ${item.name}: ${e}`);
      }
    }

    // Analyze recipes
    const recipeItems = project.items.filter((item) => item.itemType === ProjectItemType.recipeBehavior);
    const recipes: IRecipeDefinition[] = [];

    for (const item of recipeItems) {
      try {
        const recipe = await this.inferRecipeFromItem(item);
        if (recipe) {
          recipes.push(recipe);
        }
      } catch (e) {
        warnings.push(`Failed to analyze recipe ${item.name}: ${e}`);
      }
    }

    // Analyze features
    const featureItems = project.items.filter((item) => item.itemType === ProjectItemType.featureBehavior);
    const features: IFeatureDefinition[] = [];

    for (const item of featureItems) {
      try {
        const feature = await this.inferFeatureFromItem(item);
        if (feature) {
          features.push(feature);
        }
      } catch (e) {
        warnings.push(`Failed to analyze feature ${item.name}: ${e}`);
      }
    }

    // Infer namespace
    let namespace: string | undefined;
    if (this._options.inferNamespace) {
      namespace = this.inferNamespace(entityTypes, blockTypes, itemTypes);
    }

    // Build the content definition
    const definition: IMinecraftContentDefinition = {
      schemaVersion: "1.0.0",
      namespace,
      entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
      blockTypes: blockTypes.length > 0 ? blockTypes : undefined,
      itemTypes: itemTypes.length > 0 ? itemTypes : undefined,
      spawnRules: spawnRules.length > 0 ? spawnRules : undefined,
      lootTables: lootTables.length > 0 ? lootTables : undefined,
      recipes: recipes.length > 0 ? recipes : undefined,
      features: features.length > 0 ? features : undefined,
    };

    const endTime = Date.now();

    return {
      definition,
      metadata: {
        entitiesAnalyzed: entityItems.length,
        blocksAnalyzed: blockItems.length,
        itemsAnalyzed: itemItems.length,
        spawnRulesAnalyzed: spawnRuleItems.length,
        lootTablesAnalyzed: lootTableItems.length,
        recipesAnalyzed: recipeItems.length,
        featuresAnalyzed: featureItems.length,
        warnings,
        allDetectedTraits: traitCounts,
        inferenceTimeMs: endTime - startTime,
      },
    };
  }

  /**
   * Infer entity type definition from a project item.
   */
  async inferEntityFromItem(
    item: ProjectItem
  ): Promise<{ definition: IEntityTypeDefinition; detectionDetails: ITraitDetectionResult<EntityTraitId>[] } | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const entityDef = await EntityTypeDefinition.ensureOnFile(item.primaryFile);
    if (!entityDef || !entityDef.data) return null;

    return this.inferEntityFromDefinition(entityDef);
  }

  /**
   * Infer entity type from an EntityTypeDefinition.
   */
  inferEntityFromDefinition(
    entityDef: EntityTypeDefinition
  ): { definition: IEntityTypeDefinition; detectionDetails: ITraitDetectionResult<EntityTraitId>[] } | null {
    const data = entityDef.data;
    if (!data) return null;

    const wrapper = (entityDef as any)._wrapper;
    const entityData = wrapper?.["minecraft:entity"];
    if (!entityData) return null;

    // Get identifier
    const fullId = entityData.description?.identifier || "";
    const [namespace, shortId] = fullId.includes(":") ? fullId.split(":") : ["custom", fullId];

    // Get components
    const components = entityData.components || {};
    const componentGroups = entityData.component_groups || {};

    // Detect traits
    const traitResults = TraitDetector.detectEntityTraits(
      components,
      componentGroups,
      this._options.minTraitConfidence
    );
    const traits = traitResults.map((r) => r.traitId);

    // Detect behavior presets
    let behaviors: EntityBehaviorPreset[] | undefined;
    if (this._options.includeBehaviorPresets) {
      const behaviorResults = TraitDetector.detectBehaviorPresets(components, this._options.minTraitConfidence);
      behaviors = behaviorResults.length > 0 ? behaviorResults.map((r) => r.traitId) : undefined;
    }

    // Extract simplified properties
    const props = TraitDetector.extractEntityProperties(components);

    // Get unexplained components
    let rawComponents: Record<string, any> | undefined;
    if (this._options.includeRawComponents) {
      const allDetections = [...traitResults];
      const unexplained = TraitDetector.getUnexplainedComponents(components, allDetections);

      if (unexplained.length > 0) {
        rawComponents = {};
        for (const compName of unexplained) {
          // Filter out very common components that are implicit
          if (!this.isImplicitComponent(compName)) {
            rawComponents[compName] = components[compName];
          }
        }
        if (Object.keys(rawComponents).length === 0) {
          rawComponents = undefined;
        }
      }
    }

    // Build the inferred definition
    const definition: IEntityTypeDefinition = {
      id: shortId,
      displayName: this.formatDisplayName(shortId),
    };

    // Add detected traits
    if (traits.length > 0) {
      definition.traits = traits;
    }

    // Add behaviors
    if (behaviors && behaviors.length > 0) {
      definition.behaviors = behaviors;
    }

    // Add simplified properties (only if different from defaults)
    if (props.health !== undefined && props.health !== 20) {
      definition.health = props.health;
    }
    if (props.attackDamage !== undefined && props.attackDamage !== 3) {
      definition.attackDamage = props.attackDamage;
    }
    if (props.movementSpeed !== undefined && props.movementSpeed !== 0.25) {
      definition.movementSpeed = props.movementSpeed;
    }
    if (props.scale !== undefined) {
      definition.scale = props.scale;
    }
    if (props.followRange !== undefined) {
      definition.followRange = props.followRange;
    }
    if (props.knockbackResistance !== undefined) {
      definition.knockbackResistance = props.knockbackResistance;
    }
    if (props.collisionWidth !== undefined || props.collisionHeight !== undefined) {
      definition.collisionWidth = props.collisionWidth;
      definition.collisionHeight = props.collisionHeight;
    }
    if (props.families && props.families.length > 0) {
      definition.families = props.families;
    }

    // Add raw components if any
    if (rawComponents) {
      definition.components = rawComponents;
    }

    // Add component groups if requested
    if (this._options.includeComponentGroups && Object.keys(componentGroups).length > 0) {
      definition.componentGroups = componentGroups;
    }

    // Add events if requested
    if (this._options.includeEvents) {
      const events = entityData.events;
      if (events && Object.keys(events).length > 0) {
        definition.events = events;
      }
    }

    return {
      definition,
      detectionDetails: traitResults,
    };
  }

  /**
   * Infer block type definition from a project item.
   */
  async inferBlockFromItem(item: ProjectItem): Promise<{ definition: IBlockTypeDefinition } | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const blockDef = await BlockTypeDefinition.ensureOnFile(item.primaryFile);
    if (!blockDef || !blockDef.data) return null;

    return this.inferBlockFromDefinition(blockDef);
  }

  /**
   * Infer block type from a BlockTypeDefinition.
   */
  inferBlockFromDefinition(blockDef: BlockTypeDefinition): { definition: IBlockTypeDefinition } | null {
    const wrapper = (blockDef as any)._wrapper;
    const blockData = wrapper?.["minecraft:block"];
    if (!blockData) return null;

    // Get identifier
    const fullId = blockData.description?.identifier || "";
    const [namespace, shortId] = fullId.includes(":") ? fullId.split(":") : ["custom", fullId];

    // Get components
    const components = blockData.components || {};

    // Detect block traits
    const detectedTraits = TraitDetector.detectBlockTraits(components, this._options.minTraitConfidence);
    const traitIds = detectedTraits.map((t) => t.traitId);

    // Extract simplified properties
    const props = TraitDetector.extractBlockProperties(components);

    // Build the inferred definition
    const definition: IBlockTypeDefinition = {
      id: shortId,
      displayName: this.formatDisplayName(shortId),
    };

    // Add detected traits
    if (traitIds.length > 0) {
      definition.traits = traitIds;
    }

    // Add properties
    if (props.destroyTime !== undefined) {
      definition.destroyTime = props.destroyTime;
    }
    if (props.explosionResistance !== undefined) {
      definition.explosionResistance = props.explosionResistance;
    }
    if (props.lightEmission !== undefined && props.lightEmission > 0) {
      definition.lightEmission = props.lightEmission;
    }
    if (props.lightDampening !== undefined) {
      definition.lightDampening = props.lightDampening;
    }
    if (props.friction !== undefined && props.friction !== 0.6) {
      definition.friction = props.friction;
    }
    if (props.mapColor !== undefined) {
      definition.mapColor = props.mapColor;
    }

    // Add components if requested
    if (this._options.includeRawComponents) {
      // Filter to non-default components
      const significantComponents: Record<string, any> = {};
      for (const [key, value] of Object.entries(components)) {
        if (!this.isImplicitBlockComponent(key)) {
          significantComponents[key] = value;
        }
      }
      if (Object.keys(significantComponents).length > 0) {
        definition.components = significantComponents;
      }
    }

    return { definition };
  }

  /**
   * Infer item type definition from a project item.
   */
  async inferItemFromItem(item: ProjectItem): Promise<{ definition: IItemTypeDefinition } | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const itemDef = await ItemTypeDefinition.ensureOnFile(item.primaryFile);
    if (!itemDef || !itemDef.data) return null;

    return this.inferItemFromDefinition(itemDef);
  }

  /**
   * Infer item type from an ItemTypeDefinition.
   */
  inferItemFromDefinition(itemDef: ItemTypeDefinition): { definition: IItemTypeDefinition } | null {
    const wrapper = (itemDef as any)._wrapper;
    const itemData = wrapper?.["minecraft:item"];
    if (!itemData) return null;

    // Get identifier
    const fullId = itemData.description?.identifier || "";
    const [namespace, shortId] = fullId.includes(":") ? fullId.split(":") : ["custom", fullId];

    // Get components
    const components = itemData.components || {};

    // Detect item traits
    const detectedTraits = TraitDetector.detectItemTraits(components, this._options.minTraitConfidence);
    const traitIds = detectedTraits.map((t) => t.traitId);

    // Extract simplified properties
    const props = TraitDetector.extractItemProperties(components);

    // Build the inferred definition
    const definition: IItemTypeDefinition = {
      id: shortId,
      displayName: this.formatDisplayName(shortId),
    };

    // Add detected traits
    if (traitIds.length > 0) {
      definition.traits = traitIds;
    }

    // Add properties
    if (props.maxStackSize !== undefined && props.maxStackSize !== 64) {
      definition.maxStackSize = props.maxStackSize;
    }
    if (props.durability !== undefined) {
      definition.durability = props.durability;
    }

    // Food properties
    if (props.nutrition !== undefined) {
      definition.food = {
        nutrition: props.nutrition,
        saturation: props.saturation,
      };
    }

    // Weapon properties
    if (props.damage !== undefined) {
      definition.weapon = {
        damage: props.damage,
      };
    }

    // Add components if requested
    if (this._options.includeRawComponents) {
      const significantComponents: Record<string, any> = {};
      for (const [key, value] of Object.entries(components)) {
        if (!this.isImplicitItemComponent(key)) {
          significantComponents[key] = value;
        }
      }
      if (Object.keys(significantComponents).length > 0) {
        definition.components = significantComponents;
      }
    }

    return { definition };
  }

  // ============================================================================
  // WORLD GEN CONTENT INFERENCE
  // ============================================================================

  /**
   * Infer spawn rule definition from a project item.
   */
  async inferSpawnRuleFromItem(item: ProjectItem): Promise<ISpawnRuleDefinition | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const content = item.primaryFile.content;
    if (typeof content !== "string") return null;

    try {
      const data = JSON.parse(content);
      const spawnRule = data["minecraft:spawn_rules"];
      if (!spawnRule) return null;

      const description = spawnRule.description || {};
      const conditions = spawnRule.conditions || [];

      const definition: ISpawnRuleDefinition = {
        entity: description.identifier?.replace(/^[^:]+:/, "") || item.name.replace(".json", ""),
      };

      // Extract spawn conditions from the first condition group
      if (conditions.length > 0) {
        const condition = conditions[0];

        // Biome filter
        if (condition["minecraft:biome_filter"]) {
          const biomeFilter = condition["minecraft:biome_filter"];
          const biomes = this.extractBiomesFromFilter(biomeFilter);
          if (biomes.length > 0) {
            definition.biomes = biomes;
          }
        }

        // Brightness filter (light level)
        if (condition["minecraft:brightness_filter"]) {
          const brightness = condition["minecraft:brightness_filter"];
          definition.lightLevel = {
            min: brightness.min ?? 0,
            max: brightness.max ?? 15,
          };
        }

        // Height filter
        if (condition["minecraft:height_filter"]) {
          const height = condition["minecraft:height_filter"];
          definition.heightRange = {
            min: height.min ?? -64,
            max: height.max ?? 320,
          };
        }

        // Weight
        if (condition["minecraft:weight"]) {
          definition.weight = condition["minecraft:weight"].default;
        }

        // Herd/group size
        if (condition["minecraft:herd"]) {
          const herd = condition["minecraft:herd"];
          definition.groupSize = {
            min: herd.min_size ?? 1,
            max: herd.max_size ?? 1,
          };
        }

        // Spawn on block
        if (condition["minecraft:spawns_on_block_filter"]) {
          const blocks = condition["minecraft:spawns_on_block_filter"];
          if (Array.isArray(blocks)) {
            definition.spawnOn = blocks.map((b: string) => b.replace("minecraft:", ""));
          } else if (typeof blocks === "string") {
            definition.spawnOn = [blocks.replace("minecraft:", "")];
          }
        }

        // Surface/underground
        if (condition["minecraft:spawns_on_surface"]) {
          definition.surface = true;
        }
        if (condition["minecraft:spawns_underground"]) {
          definition.surface = false;
        }

        // Time of day
        if (condition["minecraft:difficulty_filter"]) {
          // Use difficulty as a proxy for time preferences sometimes
        }
      }

      return definition;
    } catch {
      return null;
    }
  }

  /**
   * Extract biome names from a biome filter.
   */
  private extractBiomesFromFilter(filter: any): string[] {
    const biomes: string[] = [];

    if (!filter) return biomes;

    if (filter.test === "has_biome_tag" && filter.value) {
      biomes.push(filter.value);
    }

    if (filter.any_of) {
      for (const subFilter of filter.any_of) {
        biomes.push(...this.extractBiomesFromFilter(subFilter));
      }
    }

    if (filter.all_of) {
      for (const subFilter of filter.all_of) {
        biomes.push(...this.extractBiomesFromFilter(subFilter));
      }
    }

    return biomes;
  }

  /**
   * Infer loot table definition from a project item.
   */
  async inferLootTableFromItem(item: ProjectItem): Promise<ILootTableDefinition | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const content = item.primaryFile.content;
    if (typeof content !== "string") return null;

    try {
      const data = JSON.parse(content);
      const pools = data.pools || [];

      // Derive ID from file path
      const id = item.name.replace(".json", "").replace(/^loot_tables\//, "");

      const definition: ILootTableDefinition = {
        id,
        pools: [],
      };

      for (const pool of pools) {
        const rollsValue = pool.rolls;
        let rolls: number | { min: number; max: number } = 1;

        if (typeof rollsValue === "number") {
          rolls = rollsValue;
        } else if (typeof rollsValue === "object" && rollsValue !== null) {
          rolls = {
            min: rollsValue.min ?? 1,
            max: rollsValue.max ?? 1,
          };
        }

        const entries: ILootEntry[] = [];
        for (const entry of pool.entries || []) {
          if (entry.type === "item" && entry.name) {
            const lootEntry: ILootEntry = {
              item: entry.name.replace("minecraft:", ""),
            };

            if (entry.weight !== undefined) {
              lootEntry.weight = entry.weight;
            }

            // Extract count from functions
            if (entry.functions) {
              for (const fn of entry.functions) {
                if (fn.function === "set_count") {
                  if (typeof fn.count === "number") {
                    lootEntry.count = fn.count;
                  } else if (typeof fn.count === "object") {
                    lootEntry.count = {
                      min: fn.count.min ?? 1,
                      max: fn.count.max ?? 1,
                    };
                  }
                }
                if (fn.function === "looting_enchant") {
                  lootEntry.lootingBonus = fn.count?.max ?? 1;
                }
              }
            }

            entries.push(lootEntry);
          }
        }

        if (entries.length > 0) {
          definition.pools.push({ rolls, entries });
        }
      }

      return definition.pools.length > 0 ? definition : null;
    } catch {
      return null;
    }
  }

  /**
   * Infer recipe definition from a project item.
   */
  async inferRecipeFromItem(item: ProjectItem): Promise<IRecipeDefinition | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const content = item.primaryFile.content;
    if (typeof content !== "string") return null;

    try {
      const data = JSON.parse(content);

      // Determine recipe type
      if (data["minecraft:recipe_shaped"]) {
        return this.inferShapedRecipe(data["minecraft:recipe_shaped"], item.name);
      } else if (data["minecraft:recipe_shapeless"]) {
        return this.inferShapelessRecipe(data["minecraft:recipe_shapeless"], item.name);
      } else if (data["minecraft:recipe_furnace"]) {
        return this.inferFurnaceRecipe(data["minecraft:recipe_furnace"], item.name);
      } else if (data["minecraft:recipe_brewing_mix"] || data["minecraft:recipe_brewing_container"]) {
        const brewingData = data["minecraft:recipe_brewing_mix"] || data["minecraft:recipe_brewing_container"];
        return this.inferBrewingRecipe(brewingData, item.name);
      } else if (data["minecraft:recipe_smithing_transform"]) {
        return this.inferSmithingRecipe(data["minecraft:recipe_smithing_transform"], item.name);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Infer a shaped recipe.
   */
  private inferShapedRecipe(recipe: any, fileName: string): IRecipeDefinition {
    const description = recipe.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    const result = recipe.result || recipe.output;
    let resultItem: string | { item: string; count: number };

    if (typeof result === "string") {
      resultItem = result.replace("minecraft:", "");
    } else if (result.item) {
      if (result.count && result.count > 1) {
        resultItem = { item: result.item.replace("minecraft:", ""), count: result.count };
      } else {
        resultItem = result.item.replace("minecraft:", "");
      }
    } else {
      resultItem = "unknown";
    }

    const definition: IRecipeDefinition = {
      id,
      type: "shaped",
      result: resultItem,
      pattern: recipe.pattern || [],
      key: {},
    };

    // Convert key
    if (recipe.key) {
      for (const [symbol, value] of Object.entries(recipe.key)) {
        if (typeof value === "string") {
          definition.key![symbol] = value.replace("minecraft:", "");
        } else if ((value as any).item) {
          definition.key![symbol] = (value as any).item.replace("minecraft:", "");
        }
      }
    }

    return definition;
  }

  /**
   * Infer a shapeless recipe.
   */
  private inferShapelessRecipe(recipe: any, fileName: string): IRecipeDefinition {
    const description = recipe.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    const result = recipe.result || recipe.output;
    let resultItem: string | { item: string; count: number };

    if (typeof result === "string") {
      resultItem = result.replace("minecraft:", "");
    } else if (result.item) {
      if (result.count && result.count > 1) {
        resultItem = { item: result.item.replace("minecraft:", ""), count: result.count };
      } else {
        resultItem = result.item.replace("minecraft:", "");
      }
    } else {
      resultItem = "unknown";
    }

    const ingredients: string[] = [];
    for (const ing of recipe.ingredients || []) {
      if (typeof ing === "string") {
        ingredients.push(ing.replace("minecraft:", ""));
      } else if (ing.item) {
        ingredients.push(ing.item.replace("minecraft:", ""));
      }
    }

    return {
      id,
      type: "shapeless",
      result: resultItem,
      ingredients,
    };
  }

  /**
   * Infer a furnace recipe.
   */
  private inferFurnaceRecipe(recipe: any, fileName: string): IRecipeDefinition {
    const description = recipe.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    const input =
      typeof recipe.input === "string"
        ? recipe.input.replace("minecraft:", "")
        : recipe.input?.item?.replace("minecraft:", "") || "unknown";

    const output =
      typeof recipe.output === "string"
        ? recipe.output.replace("minecraft:", "")
        : recipe.output?.item?.replace("minecraft:", "") || "unknown";

    return {
      id,
      type: "furnace",
      result: output,
      input,
    };
  }

  /**
   * Infer a brewing recipe.
   */
  private inferBrewingRecipe(recipe: any, fileName: string): IRecipeDefinition {
    const description = recipe.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    return {
      id,
      type: "brewing",
      result: recipe.output?.replace("minecraft:", "") || "unknown",
      input: recipe.input?.replace("minecraft:", ""),
    };
  }

  /**
   * Infer a smithing recipe.
   */
  private inferSmithingRecipe(recipe: any, fileName: string): IRecipeDefinition {
    const description = recipe.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    return {
      id,
      type: "smithing",
      result:
        typeof recipe.result === "string"
          ? recipe.result.replace("minecraft:", "")
          : recipe.result?.item?.replace("minecraft:", "") || "unknown",
    };
  }

  /**
   * Infer feature definition from a project item.
   */
  async inferFeatureFromItem(item: ProjectItem): Promise<IFeatureDefinition | null> {
    if (!item.primaryFile) return null;

    await item.loadContent();
    if (!item.primaryFile.isContentLoaded) {
      await item.primaryFile.loadContent();
    }

    const content = item.primaryFile.content;
    if (typeof content !== "string") return null;

    try {
      const data = JSON.parse(content);

      // Check for various feature types
      const featureTypes = [
        "minecraft:ore_feature",
        "minecraft:scatter_feature",
        "minecraft:single_block_feature",
        "minecraft:aggregate_feature",
        "minecraft:tree_feature",
        "minecraft:vegetation_patch_feature",
        "minecraft:geode_feature",
      ];

      for (const featureType of featureTypes) {
        if (data[featureType]) {
          return this.inferFeatureFromData(data[featureType], featureType, item.name);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Infer feature definition from raw data.
   */
  private inferFeatureFromData(featureData: any, featureType: string, fileName: string): IFeatureDefinition {
    const description = featureData.description || {};
    const id = description.identifier?.replace(/^[^:]+:/, "") || fileName.replace(".json", "");

    const definition: IFeatureDefinition = {
      id,
    };

    // Extract spread/placement info
    if (featureData.places_block) {
      const block = featureData.places_block;
      definition.spread = {
        places: [
          {
            type: "block",
            id: typeof block === "string" ? block.replace("minecraft:", "") : block.name?.replace("minecraft:", ""),
          },
        ],
      };
    }

    // For ore features
    if (featureType === "minecraft:ore_feature") {
      const replaces = featureData.replace_rules?.[0];
      if (replaces) {
        const places = featureData.replace_rules.map((rule: any) => ({
          type: "ore" as const,
          id:
            typeof rule.places_block === "string"
              ? rule.places_block.replace("minecraft:", "")
              : rule.places_block?.name?.replace("minecraft:", ""),
          replacesBlocks: Array.isArray(rule.may_replace)
            ? rule.may_replace.map((b: string) => b.replace("minecraft:", ""))
            : undefined,
        }));

        definition.spread = { places };

        if (featureData.count) {
          definition.spread.count =
            typeof featureData.count === "number"
              ? featureData.count
              : { min: featureData.count.min ?? 1, max: featureData.count.max ?? 1 };
        }
      }
    }

    // For scatter features
    if (featureType === "minecraft:scatter_feature") {
      if (featureData.scatter_chance) {
        if (!definition.spread) {
          definition.spread = { places: [] };
        }
        definition.spread.rarity = 1 / (featureData.scatter_chance.numerator / featureData.scatter_chance.denominator);
      }
    }

    // Store native feature data if we have complex configurations
    if (this._options.includeRawComponents) {
      definition.nativeFeature = { [featureType.replace("minecraft:", "")]: featureData };
    }

    return definition;
  }

  /**
   * Infer namespace from identifiers.
   */
  private inferNamespace(
    entities: IEntityTypeDefinition[],
    blocks: IBlockTypeDefinition[],
    items: IItemTypeDefinition[]
  ): string | undefined {
    const namespaceCounts: Record<string, number> = {};

    // This would need access to original identifiers which we stripped
    // For now, return undefined - could be improved later
    return undefined;
  }

  /**
   * Format an ID into a display name.
   */
  private formatDisplayName(id: string): string {
    return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Check if a component is implicit and doesn't need to be included.
   */
  private isImplicitComponent(componentName: string): boolean {
    // Components that are usually added by default or are very common
    const implicitComponents = [
      "minecraft:physics",
      "minecraft:pushable",
      "minecraft:collision_box",
      "minecraft:conditional_bandwidth_optimization",
      "minecraft:experience_reward",
    ];
    return implicitComponents.includes(componentName);
  }

  /**
   * Check if a block component is implicit.
   */
  private isImplicitBlockComponent(componentName: string): boolean {
    const implicitComponents = [
      "minecraft:unit_cube",
      "minecraft:destructible_by_mining",
      "minecraft:destructible_by_explosion",
    ];
    return implicitComponents.includes(componentName);
  }

  /**
   * Check if an item component is implicit.
   */
  private isImplicitItemComponent(componentName: string): boolean {
    const implicitComponents = ["minecraft:max_stack_size", "minecraft:icon", "minecraft:display_name"];
    return implicitComponents.includes(componentName);
  }

  // ============================================================================
  // STATIC CONVENIENCE METHODS
  // ============================================================================

  /**
   * Infer schema from a project (static convenience method).
   */
  static async inferFromProject(project: Project, options?: IInferrerOptions): Promise<IInferenceResult> {
    const inferrer = new ContentSchemaInferrer(options);
    return inferrer.inferFromProject(project);
  }

  /**
   * Infer schema from an entity definition (static convenience method).
   */
  static inferEntityFromDefinition(
    entityDef: EntityTypeDefinition,
    options?: IInferrerOptions
  ): { definition: IEntityTypeDefinition; detectionDetails: ITraitDetectionResult<EntityTraitId>[] } | null {
    const inferrer = new ContentSchemaInferrer(options);
    return inferrer.inferEntityFromDefinition(entityDef);
  }

  /**
   * Generate a lightweight summary of a project's content for AI context injection.
   * This produces an IProjectSchemaSummary that can be sent with chat messages
   * without bloating the context window.
   *
   * @param project The project to summarize
   * @returns A summary object suitable for AI context
   */
  static async inferSummary(project: Project): Promise<{
    isSummarized: true;
    projectPath?: string;
    namespace?: string;
    entityCount: number;
    blockCount: number;
    itemCount: number;
    recipeCount: number;
    lootTableCount: number;
    spawnRuleCount: number;
    entityIds?: string[];
    blockIds?: string[];
    itemIds?: string[];
    detectedEntityTraits?: string[];
    detectedBlockTraits?: string[];
    detectedItemTraits?: string[];
    recentValidationIssues?: string[];
    fullSchemaAvailableViaTool: "getEffectiveContentSchema";
  }> {
    await project.inferProjectItemsFromFiles();

    const entityItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);
    const blockItems = project.getItemsByType(ProjectItemType.blockTypeBehavior);
    const itemItems = project.getItemsByType(ProjectItemType.itemTypeBehavior);
    const recipeItems = project.getItemsByType(ProjectItemType.recipeBehavior);
    const lootItems = project.getItemsByType(ProjectItemType.lootTableBehavior);
    const spawnItems = project.getItemsByType(ProjectItemType.spawnRuleBehavior);

    // Extract IDs from items
    const entityIds: string[] = [];
    const blockIds: string[] = [];
    const itemIds: string[] = [];

    // Collect unique traits
    const entityTraits = new Set<string>();
    const blockTraits = new Set<string>();
    const itemTraits = new Set<string>();

    // Process entities to get IDs and traits
    for (const item of entityItems) {
      if (!item.primaryFile) continue;
      await item.loadContent();

      const entityDef = await EntityTypeDefinition.ensureOnFile(item.primaryFile);
      if (entityDef) {
        const id = entityDef.id;
        if (id) {
          // Strip namespace for concise IDs
          const shortId = id.includes(":") ? id.split(":")[1] : id;
          entityIds.push(shortId);
        }

        // Detect traits from the wrapper's components
        const wrapper = (entityDef as any)._wrapper;
        const entityData = wrapper?.["minecraft:entity"];
        const components = entityData?.components;
        if (components) {
          const componentGroups = entityData?.component_groups || {};
          const detected = TraitDetector.detectEntityTraits(components, componentGroups, 0.6);
          for (const trait of detected) {
            entityTraits.add(trait.traitId);
          }
        }
      }
    }

    // Process blocks
    for (const item of blockItems) {
      if (!item.primaryFile) continue;
      await item.loadContent();

      const blockDef = await BlockTypeDefinition.ensureOnFile(item.primaryFile);
      if (blockDef) {
        const id = blockDef.id;
        if (id) {
          const shortId = id.includes(":") ? id.split(":")[1] : id;
          blockIds.push(shortId);
        }

        // Detect traits
        const components = blockDef.getComponents();
        if (components && Object.keys(components).length > 0) {
          const detected = TraitDetector.detectBlockTraits(components, 0.6);
          for (const trait of detected) {
            blockTraits.add(trait.traitId);
          }
        }
      }
    }

    // Process items
    for (const item of itemItems) {
      if (!item.primaryFile) continue;
      await item.loadContent();

      const itemDef = await ItemTypeDefinition.ensureOnFile(item.primaryFile);
      if (itemDef) {
        const id = itemDef.id;
        if (id) {
          const shortId = id.includes(":") ? id.split(":")[1] : id;
          itemIds.push(shortId);
        }

        // Detect traits
        const components = itemDef.getComponents();
        if (components && Object.keys(components).length > 0) {
          const detected = TraitDetector.detectItemTraits(components, 0.6);
          for (const trait of detected) {
            itemTraits.add(trait.traitId);
          }
        }
      }
    }

    // Infer namespace from first entity/block/item ID
    let namespace: string | undefined;
    const allItems = [...entityItems, ...blockItems, ...itemItems];
    for (const item of allItems) {
      if (!item.primaryFile) continue;
      await item.loadContent();

      // Try entity
      const entityDef = item.primaryFile.manager as EntityTypeDefinition | undefined;
      if (entityDef?.id?.includes(":")) {
        namespace = entityDef.id.split(":")[0];
        break;
      }

      // Try block
      const blockDef = item.primaryFile.manager as BlockTypeDefinition | undefined;
      if (blockDef?.id?.includes(":")) {
        namespace = blockDef.id.split(":")[0];
        break;
      }

      // Try item
      const itemDefCheck = item.primaryFile.manager as ItemTypeDefinition | undefined;
      if (itemDefCheck?.id?.includes(":")) {
        namespace = itemDefCheck.id.split(":")[0];
        break;
      }
    }

    // Prefer localFolderPath (the user's actual folder) over projectFolder (which may be a workspace path)
    const projectPath = project.localFolderPath || project.projectFolder?.fullPath;

    return {
      isSummarized: true,
      projectPath: projectPath,
      namespace,
      entityCount: entityItems.length,
      blockCount: blockItems.length,
      itemCount: itemItems.length,
      recipeCount: recipeItems.length,
      lootTableCount: lootItems.length,
      spawnRuleCount: spawnItems.length,
      entityIds: entityIds.length > 0 ? entityIds.slice(0, 50) : undefined, // Limit for context
      blockIds: blockIds.length > 0 ? blockIds.slice(0, 50) : undefined,
      itemIds: itemIds.length > 0 ? itemIds.slice(0, 50) : undefined,
      detectedEntityTraits: entityTraits.size > 0 ? Array.from(entityTraits) : undefined,
      detectedBlockTraits: blockTraits.size > 0 ? Array.from(blockTraits) : undefined,
      detectedItemTraits: itemTraits.size > 0 ? Array.from(itemTraits) : undefined,
      fullSchemaAvailableViaTool: "getEffectiveContentSchema",
    };
  }
}
