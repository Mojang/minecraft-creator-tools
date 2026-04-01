// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AutocompleteProviders - Built-in autocomplete providers for ToolCommands
 *
 * These providers supply suggestions for command arguments and flags.
 * They query CreatorTools, Project, and content wizard data to provide
 * context-aware completions.
 */

import type { AutocompleteProvider } from "./IToolCommandArgument";
import type { IToolCommandContext } from "./IToolCommandContext";
import { GalleryItemType } from "../IGalleryItem";

// ============================================================================
// TRAIT DEFINITIONS (from ContentWizard)
// ============================================================================
// MAINTENANCE: These trait lists are manually maintained and must be updated
// when new traits are added to the ContentWizard / ContentIndexManager system.
// Cross-reference with ContentWizard trait definitions to keep in sync.
// ============================================================================

/**
 * Entity traits available in the content wizard.
 */
export const ENTITY_TRAITS = [
  "humanoid",
  "quadruped",
  "flying",
  "aquatic",
  "hostile",
  "passive",
  "neutral",
  "melee_attacker",
  "ranged_attacker",
  "exploder",
  "tameable",
  "rideable",
  "breedable",
  "undead",
  "wanders",
  "teleporter",
];

/**
 * Block traits available in the content wizard.
 */
export const BLOCK_TRAITS = [
  "solid",
  "transparent",
  "slab",
  "stairs",
  "fence",
  "door",
  "container",
  "light_source",
  "gravity",
  "redstone_signal",
];

/**
 * Item traits available in the content wizard.
 */
export const ITEM_TRAITS = [
  "sword",
  "pickaxe",
  "axe",
  "shovel",
  "food",
  "armor_helmet",
  "armor_chestplate",
  "armor_leggings",
  "armor_boots",
  "throwable",
];

/**
 * All traits combined for general trait completion.
 */
export const ALL_TRAITS = [...ENTITY_TRAITS, ...BLOCK_TRAITS, ...ITEM_TRAITS];

// ============================================================================
// CONTENT TYPE NAMES
// ============================================================================
// MAINTENANCE: This list must be updated when new content types are added.
// Cross-reference with GalleryItemType enum and CONTENT_TYPE_TO_GALLERY mapping.
// ============================================================================

/**
 * Content types that can be added via the /add command.
 */
export const CONTENT_TYPES = [
  "entity",
  "block",
  "item",
  "script",
  "function",
  "spawn_rule",
  "loot_table",
  "trade_table",
  "recipe",
  "biome",
  "feature",
  "feature_rule",
  "structure",
  "animation",
  "animation_controller",
  "render_controller",
  "model",
  "texture",
  "particle",
  "fog",
  "sound",
];

/**
 * Map content type names to GalleryItemType for lookup.
 */
export const CONTENT_TYPE_TO_GALLERY: Record<string, GalleryItemType> = {
  entity: GalleryItemType.entityType,
  block: GalleryItemType.blockType,
  item: GalleryItemType.itemType,
  script: GalleryItemType.codeSample,
  spawn_rule: GalleryItemType.spawnLootRecipes,
  loot_table: GalleryItemType.spawnLootRecipes,
  trade_table: GalleryItemType.spawnLootRecipes,
  recipe: GalleryItemType.spawnLootRecipes,
  biome: GalleryItemType.worldGen,
  feature: GalleryItemType.worldGen,
  feature_rule: GalleryItemType.worldGen,
  structure: GalleryItemType.chunk,
  animation: GalleryItemType.visuals,
  animation_controller: GalleryItemType.visuals,
  render_controller: GalleryItemType.visuals,
  model: GalleryItemType.visuals,
  texture: GalleryItemType.visuals,
  particle: GalleryItemType.visuals,
  fog: GalleryItemType.visuals,
  sound: GalleryItemType.visuals,
};

// ============================================================================
// PROJECT TEMPLATE NAMES
// ============================================================================

/**
 * Common project template identifiers.
 */
export const PROJECT_TEMPLATES = [
  "addonstarter",
  "tsstarter",
  "addonfull",
  "scriptbox",
  "dlstarter",
  "editorscriptbox",
  "editorbasics",
];

// ============================================================================
// AUTOCOMPLETE PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * Provides autocomplete for content type names (entity, block, item, etc.)
 */
export const contentTypeProvider: AutocompleteProvider = (partial: string, _context: IToolCommandContext) => {
  const lower = partial.toLowerCase();
  return CONTENT_TYPES.filter((t) => t.startsWith(lower));
};

/**
 * Provides autocomplete for traits based on the content type being created.
 * @param contentType The type of content (entity, block, item)
 */
export function createTraitProvider(contentType?: string): AutocompleteProvider {
  return (partial: string, _context: IToolCommandContext) => {
    const lower = partial.toLowerCase();

    let traits: string[];
    switch (contentType?.toLowerCase()) {
      case "entity":
        traits = ENTITY_TRAITS;
        break;
      case "block":
        traits = BLOCK_TRAITS;
        break;
      case "item":
        traits = ITEM_TRAITS;
        break;
      default:
        traits = ALL_TRAITS;
    }

    return traits.filter((t) => t.startsWith(lower));
  };
}

/**
 * Provides autocomplete for all traits (entity, block, and item).
 */
export const allTraitsProvider: AutocompleteProvider = (partial: string, _context: IToolCommandContext) => {
  const lower = partial.toLowerCase();
  return ALL_TRAITS.filter((t) => t.startsWith(lower));
};

/**
 * Provides autocomplete for project templates.
 */
export const projectTemplateProvider: AutocompleteProvider = async (partial: string, context: IToolCommandContext) => {
  const lower = partial.toLowerCase();

  if (!context.creatorTools) {
    return PROJECT_TEMPLATES.filter((t) => t.startsWith(lower));
  }

  // Try to get templates from gallery
  await context.creatorTools.loadGallery();
  const projects = context.creatorTools.getGalleryProjectByType(GalleryItemType.project) || [];
  const editorProjects = context.creatorTools.getGalleryProjectByType(GalleryItemType.editorProject) || [];

  const allProjects = [...projects, ...editorProjects];

  if (allProjects.length > 0) {
    return allProjects.map((p) => p.id).filter((id) => id.toLowerCase().startsWith(lower));
  }

  // Fall back to static list
  return PROJECT_TEMPLATES.filter((t) => t.startsWith(lower));
};

/**
 * Provides autocomplete for gallery items of a specific type.
 * @param itemType The gallery item type to filter by
 */
export function createGalleryItemProvider(itemType?: GalleryItemType): AutocompleteProvider {
  return async (partial: string, context: IToolCommandContext) => {
    const lower = partial.toLowerCase();

    if (!context.creatorTools) {
      return [];
    }

    await context.creatorTools.loadGallery();

    let items;
    if (itemType !== undefined) {
      items = context.creatorTools.getGalleryProjectByType(itemType) || [];
    } else {
      // Return all gallery items
      const gallery = context.creatorTools.gallery;
      items = gallery?.items || [];
    }

    return items.map((item) => item.id).filter((id) => id.toLowerCase().startsWith(lower));
  };
}

/**
 * Provides autocomplete for project items (files in the current project).
 */
/**
 * Paths excluded from remove autocomplete to prevent accidental deletion of
 * config files, dotfiles, and other non-content project infrastructure.
 */
const REMOVE_EXCLUDED_PATTERNS = [
  /(?:^|\/)\./, // dotfiles and dot-directories (e.g., .vscode/, .env)
  /(?:^|\/)package\.json$/i,
  /(?:^|\/)package-lock\.json$/i,
  /(?:^|\/)tsconfig\.json$/i,
  /\.config\./i, // e.g., vite.config.ts, jest.config.js
  /(?:^|\/)\.env/i, // .env, .env.local, etc.
];

function isExcludedFromRemove(path: string): boolean {
  return REMOVE_EXCLUDED_PATTERNS.some((pattern) => pattern.test(path));
}

export const projectItemProvider: AutocompleteProvider = (partial: string, context: IToolCommandContext) => {
  if (!context.project) {
    return [];
  }

  const lower = partial.toLowerCase();
  const items = context.project.items || [];

  return items
    .filter((item) => item.projectPath)
    .map((item) => item.projectPath!)
    .filter((path) => path.toLowerCase().includes(lower) && !isExcludedFromRemove(path));
};

/**
 * Provides autocomplete for project item names (display names).
 */
export const projectItemNameProvider: AutocompleteProvider = (partial: string, context: IToolCommandContext) => {
  if (!context.project) {
    return [];
  }

  const lower = partial.toLowerCase();
  const items = context.project.items || [];

  return items
    .filter((item) => item.name)
    .map((item) => item.name)
    .filter((name) => name.toLowerCase().includes(lower));
};
