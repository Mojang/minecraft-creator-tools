// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CrossReferenceCompletionSource — Platform-agnostic cross-file completion data source
 *
 * ARCHITECTURE:
 * This module provides the shared completion logic for cross-file references in
 * Minecraft JSON files. It abstracts away the data source (ContentIndex + vanilla
 * metadata) so that both Monaco and VS Code providers can use identical logic.
 *
 * DESIGN:
 * - `IVanillaDataProvider` — Interface for supplying vanilla entity/block/item lists.
 *   Implemented differently in web (Database static methods) vs VS Code (same Database).
 * - `ICrossReferenceCompletionSource` — The query interface used by completion providers.
 * - `CrossReferenceCompletionSource` — Concrete implementation that queries ContentIndex
 *   for project items and IVanillaDataProvider for vanilla content.
 *
 * USAGE FLOW:
 * 1. Editor loads a project → info generation runs in background
 * 2. Info generators populate ContentIndex with annotated entries
 *    (CrossReferenceIndexGenerator, TypesInfoGenerator, TextureInfoGenerator)
 * 3. When user triggers autocomplete at a reference field,
 *    the completion provider detects the reference type via langcore
 * 4. Provider calls `getCompletionsForReferenceType(type)` on this source
 * 5. Source queries ContentIndex.getAll() with the appropriate annotation filter
 * 6. Source merges vanilla content (entities, blocks, items, biomes) from metadata
 * 7. Returns ICompletionItem[] which the platform adapter converts to native items
 *
 * RELATED FILES:
 * - ContentIndex.ts — Trie data structure with annotation categories
 * - CrossReferenceIndexGenerator.ts — Populates content index for all reference types
 * - TypesInfoGenerator.ts — Populates entity/block/item/feature annotations
 * - TextureInfoGenerator.ts — Populates texture file annotations
 * - MinecraftReferenceTypes.ts — Reference type detection from JSON paths
 * - MinecraftCompletionProvider.ts — Monaco consumer
 * - McCompletionProvider.ts — VS Code consumer
 *
 * Last updated: February 2026
 */

import { ICompletionItem, CompletionItemKind } from "./JsonCompletionItems";
import { ReferenceType } from "../shared/MinecraftReferenceTypes";

/**
 * Annotation category strings matching ContentIndex.AnnotationCategory.
 * We re-declare them here as string constants to avoid depending on ContentIndex
 * directly in langcore (ContentIndex is in core/, langcore should stay platform-agnostic).
 *
 * IMPORTANT: These values MUST stay in sync with the AnnotationCategory enum
 * in core/ContentIndex.ts. If you add or change a category there, update this
 * mapping as well (and vice-versa).
 */
const ANNOTATION_MAPPING: Record<string, string> = {
  texture: "t", // AnnotationCategory.textureFile
  geometry: "G", // AnnotationCategory.geometrySource
  animation: "A", // AnnotationCategory.animationSource
  animation_controller: "C", // AnnotationCategory.animationControllerSource
  render_controller: "D", // AnnotationCategory.renderControllerSource
  entity_id: "E", // AnnotationCategory.entityTypeSource
  block_id: "B", // AnnotationCategory.blockTypeSource
  item_id: "I", // AnnotationCategory.itemTypeSource
  loot_table: "O", // AnnotationCategory.lootTableSource
  sound: "w", // AnnotationCategory.soundEventSource
  particle: "P", // AnnotationCategory.particleSource
  fog: "F", // AnnotationCategory.fogSource
  recipe: "Q", // AnnotationCategory.recipeSource
  feature: "l", // AnnotationCategory.featureSource
  biome: "Y", // AnnotationCategory.biomeSource
  spawn_rule: "Z", // AnnotationCategory.spawnRuleSource
  structure: "r", // AnnotationCategory.structureSource
  dialogue: "q", // AnnotationCategory.dialogueSource
  function: "u", // AnnotationCategory.functionSource
};

/**
 * Reference types that have vanilla content available via metadata files
 */
const VANILLA_SUPPORTED_TYPES = new Set<ReferenceType>(["entity_id", "block_id", "item_id", "biome"]);

/**
 * Maps reference types to their completion item kinds
 */
const REF_TYPE_TO_KIND: Record<string, CompletionItemKind> = {
  texture: CompletionItemKind.File,
  geometry: CompletionItemKind.Reference,
  animation: CompletionItemKind.Reference,
  animation_controller: CompletionItemKind.Reference,
  render_controller: CompletionItemKind.Reference,
  entity_id: CompletionItemKind.Entity,
  block_id: CompletionItemKind.Block,
  item_id: CompletionItemKind.Item,
  loot_table: CompletionItemKind.File,
  sound: CompletionItemKind.Reference,
  particle: CompletionItemKind.Reference,
  fog: CompletionItemKind.Reference,
  recipe: CompletionItemKind.Reference,
  feature: CompletionItemKind.Reference,
  biome: CompletionItemKind.Reference,
  spawn_rule: CompletionItemKind.Reference,
  structure: CompletionItemKind.File,
  dialogue: CompletionItemKind.Reference,
  function: CompletionItemKind.Function,
};

/**
 * Human-readable labels for reference type categories
 */
const REF_TYPE_LABELS: Record<string, string> = {
  texture: "Texture",
  geometry: "Geometry",
  animation: "Animation",
  animation_controller: "Animation Controller",
  render_controller: "Render Controller",
  entity_id: "Entity",
  block_id: "Block",
  item_id: "Item",
  loot_table: "Loot Table",
  sound: "Sound",
  particle: "Particle",
  fog: "Fog",
  recipe: "Recipe",
  feature: "Feature",
  biome: "Biome",
  spawn_rule: "Spawn Rule",
  structure: "Structure",
  dialogue: "Dialogue",
  function: "Function",
};

/**
 * Provider for vanilla Minecraft content identifiers.
 * Implemented by platform-specific code that wraps Database.*Metadata() calls.
 */
export interface IVanillaDataProvider {
  getVanillaEntities(): Promise<string[]>;
  getVanillaBlocks(): Promise<string[]>;
  getVanillaItems(): Promise<string[]>;
  getVanillaBiomes(): Promise<string[]>;
}

/**
 * Abstract interface for querying indexed content.
 * This decouples langcore from the ContentIndex implementation in core/.
 */
export interface IContentIndexProvider {
  /**
   * Returns all indexed entries that have the specified annotation character(s).
   * The annotation strings correspond to AnnotationCategory enum values.
   * Returns a map of { identifier → source_path[] }.
   */
  getAllWithAnnotation(annotationChars: string[]): { [key: string]: string[] };

  /**
   * Whether the content index has been populated (info generation is complete).
   */
  isReady(): boolean;
}

/**
 * Interface for the cross-reference completion source
 */
export interface ICrossReferenceCompletionSource {
  /**
   * Get completion items for a given reference type.
   * Returns both project-local and vanilla content suggestions.
   */
  getCompletionsForReferenceType(refType: ReferenceType): Promise<ICompletionItem[]>;

  /**
   * Get completion items for same-file references (events, component groups).
   * These don't use the content index — they parse the current file.
   */
  getSameFileCompletions(refType: "event" | "component_group", currentFileContent: any): ICompletionItem[];

  /**
   * Whether the data source is ready (content index populated).
   */
  isReady(): boolean;
}

/**
 * Concrete implementation that queries ContentIndex + vanilla metadata.
 */
export class CrossReferenceCompletionSource implements ICrossReferenceCompletionSource {
  private contentIndexProvider: IContentIndexProvider;
  private vanillaProvider: IVanillaDataProvider | undefined;

  // Cache to avoid re-querying for the same type within a short period
  private completionCache: Map<string, { items: ICompletionItem[]; timestamp: number }> = new Map();
  private static readonly CACHE_TTL_MS = 10000; // 10 seconds

  constructor(contentIndexProvider: IContentIndexProvider, vanillaProvider?: IVanillaDataProvider) {
    this.contentIndexProvider = contentIndexProvider;
    this.vanillaProvider = vanillaProvider;
  }

  public isReady(): boolean {
    return this.contentIndexProvider.isReady();
  }

  /**
   * Clear the completion cache (call when project content changes)
   */
  public clearCache(): void {
    this.completionCache.clear();
  }

  public async getCompletionsForReferenceType(refType: ReferenceType): Promise<ICompletionItem[]> {
    // Check cache
    const cached = this.completionCache.get(refType);
    if (cached && Date.now() - cached.timestamp < CrossReferenceCompletionSource.CACHE_TTL_MS) {
      return cached.items;
    }

    const items: ICompletionItem[] = [];
    const seen = new Set<string>();

    // 1. Get project content from the content index
    if (this.contentIndexProvider.isReady()) {
      const annotationChar = ANNOTATION_MAPPING[refType];
      if (annotationChar) {
        const indexed = this.contentIndexProvider.getAllWithAnnotation([annotationChar]);
        const kind = REF_TYPE_TO_KIND[refType] || CompletionItemKind.Reference;
        const label = REF_TYPE_LABELS[refType] || refType;

        for (const identifier in indexed) {
          if (seen.has(identifier)) {
            continue;
          }
          seen.add(identifier);

          const sourcePaths = indexed[identifier];
          const detail =
            sourcePaths && sourcePaths.length > 0 ? `Project ${label} (${sourcePaths[0]})` : `Project ${label}`;

          items.push({
            label: identifier,
            kind,
            detail,
            insertText: `"${identifier}"`,
            sortText: "0_" + identifier, // Project items sort first
          });
        }
      }
    }

    // 2. Add vanilla content where available
    if (this.vanillaProvider && VANILLA_SUPPORTED_TYPES.has(refType)) {
      const vanillaItems = await this.getVanillaCompletions(refType);
      for (const vanillaItem of vanillaItems) {
        if (!seen.has(vanillaItem.label)) {
          seen.add(vanillaItem.label);
          items.push(vanillaItem);
        }
      }
    }

    // Update cache
    this.completionCache.set(refType, { items, timestamp: Date.now() });

    return items;
  }

  private async getVanillaCompletions(refType: ReferenceType): Promise<ICompletionItem[]> {
    if (!this.vanillaProvider) {
      return [];
    }

    const items: ICompletionItem[] = [];
    let vanillaIds: string[] = [];
    let kindLabel = "";

    switch (refType) {
      case "entity_id":
        vanillaIds = await this.vanillaProvider.getVanillaEntities();
        kindLabel = "Vanilla entity";
        break;
      case "block_id":
        vanillaIds = await this.vanillaProvider.getVanillaBlocks();
        kindLabel = "Vanilla block";
        break;
      case "item_id":
        vanillaIds = await this.vanillaProvider.getVanillaItems();
        kindLabel = "Vanilla item";
        break;
      case "biome":
        vanillaIds = await this.vanillaProvider.getVanillaBiomes();
        kindLabel = "Vanilla biome";
        break;
    }

    const kind = REF_TYPE_TO_KIND[refType] || CompletionItemKind.Reference;

    for (const id of vanillaIds) {
      items.push({
        label: id,
        kind,
        detail: kindLabel,
        insertText: `"${id}"`,
        sortText: "1_" + id, // Vanilla items sort after project items
      });
    }

    return items;
  }

  public getSameFileCompletions(refType: "event" | "component_group", currentFileContent: any): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    if (!currentFileContent) {
      return items;
    }

    try {
      const entity = currentFileContent["minecraft:entity"];
      if (!entity) {
        return items;
      }

      if (refType === "event" && entity.events) {
        for (const eventName of Object.keys(entity.events)) {
          items.push({
            label: eventName,
            kind: CompletionItemKind.Event,
            detail: "Event in this entity",
            insertText: `"${eventName}"`,
            sortText: "0_" + eventName,
          });
        }
      } else if (refType === "component_group" && entity.component_groups) {
        for (const groupName of Object.keys(entity.component_groups)) {
          items.push({
            label: groupName,
            kind: CompletionItemKind.Class,
            detail: "Component group in this entity",
            insertText: `"${groupName}"`,
            sortText: "0_" + groupName,
          });
        }
      }
    } catch {
      // File content may not be valid
    }

    return items;
  }
}
