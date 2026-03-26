// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ModelDesignTemplates
 *
 * Provides starter model templates for common Minecraft entity types.
 * These templates use Minecraft's native coordinate system: 16 units = 1 block.
 * All origin, size, and pivot values are in Minecraft pixel units.
 *
 * ARCHITECTURE:
 * - Templates are stored as JSON files in `public/data/model_templates/`
 * - Use `getModelTemplateAsync()` to load templates dynamically (required)
 * - Templates are cached after first load for performance
 *
 * REFACTORING NOTE (2024):
 * Templates were moved from bundled TypeScript to external JSON files to reduce
 * bundle size (~4000 lines / 170KB removed). All consumers should use async loading.
 * The JSON files are located in `public/data/model_templates/{type}.model.json`.
 */

import { IMcpModelDesign } from "./IMcpModelDesign";
import Database from "./Database";

/**
 * Available model template types. These correspond to JSON files in
 * `public/data/model_templates/{type}.model.json`
 */
export type ModelTemplateType =
  | "humanoid"
  | "small_animal"
  | "large_animal"
  | "vehicle"
  | "block"
  | "item"
  | "bird"
  | "insect"
  | "flying"
  | "fish"
  | "slime"
  | "wizard"
  | "golem"
  | "fox"
  | "crystal"
  | "enchanted_sword"
  | "tropical_fish"
  | "ghost"
  | "robot"
  | "mushroom_creature"
  | "treasure_chest"
  // Block templates
  | "stone_brick"
  | "wooden_crate"
  | "glowing_ore"
  | "mossy_stone"
  | "crystal_block"
  | "tech_block"
  // Item templates
  | "potion_bottle"
  | "magic_wand"
  | "ornate_key"
  | "gemstone"
  | "apple"
  | "pickaxe";

/**
 * List of all available template types for iteration and validation.
 */
const ALL_TEMPLATE_TYPES: ModelTemplateType[] = [
  "humanoid",
  "small_animal",
  "large_animal",
  "vehicle",
  "block",
  "item",
  "bird",
  "insect",
  "flying",
  "fish",
  "slime",
  "wizard",
  "golem",
  "fox",
  "crystal",
  "enchanted_sword",
  "tropical_fish",
  "ghost",
  "robot",
  "mushroom_creature",
  "treasure_chest",
  "stone_brick",
  "wooden_crate",
  "glowing_ore",
  "mossy_stone",
  "crystal_block",
  "tech_block",
  "potion_bottle",
  "magic_wand",
  "ornate_key",
  "gemstone",
  "apple",
  "pickaxe",
];

/**
 * Runtime cache for templates loaded from JSON files.
 * Populated lazily as templates are requested via getModelTemplateAsync().
 * @internal
 */
const templateCache: Record<string, IMcpModelDesign> = {};

/**
 * Get a model template by type (async, loads from JSON file)
 * This is the preferred method for loading templates.
 * Templates are cached after first load.
 *
 * @param templateType The type of template to retrieve
 * @returns Promise resolving to the template design, or undefined if not found
 */
export async function getModelTemplateAsync(templateType: ModelTemplateType): Promise<IMcpModelDesign | undefined> {
  // Check cache first
  if (templateCache[templateType]) {
    return templateCache[templateType];
  }

  // Load from JSON file
  const loaded = await Database.ensureModelTemplateLoaded(templateType);
  if (loaded) {
    // Cache for future access
    templateCache[templateType] = loaded as IMcpModelDesign;
    return loaded as IMcpModelDesign;
  }

  return undefined;
}

/**
 * Get a model template by type (synchronous, uses cached templates only)
 * NOTE: This only returns templates that have already been loaded via getModelTemplateAsync().
 * For reliable access, use getModelTemplateAsync() instead.
 *
 * @deprecated Prefer getModelTemplateAsync() for reliable template access
 * @param templateType The type of template to retrieve
 * @returns The template design if cached, or undefined if not loaded yet
 */
export function getModelTemplate(templateType: ModelTemplateType): IMcpModelDesign | undefined {
  return templateCache[templateType];
}

/**
 * Get all available template types (synchronous)
 * @returns Array of available template type names
 */
export function getAvailableTemplateTypes(): ModelTemplateType[] {
  return [...ALL_TEMPLATE_TYPES];
}

/**
 * Get all available template types from JSON files (async)
 * This queries the actual JSON files available in the data folder.
 * @returns Promise resolving to array of available template type names
 */
export async function getAvailableTemplateTypesAsync(): Promise<string[]> {
  return await Database.getModelTemplateNames();
}

/**
 * Check if a template type is valid
 * @param templateType The template type to check
 * @returns True if the template type is valid
 */
export function isValidTemplateType(templateType: string): templateType is ModelTemplateType {
  return ALL_TEMPLATE_TYPES.includes(templateType as ModelTemplateType);
}

/**
 * Preload all templates into cache (async)
 * Call this once at startup if you need synchronous access to all templates later.
 * @returns Promise resolving when all templates are loaded
 */
export async function preloadAllTemplates(): Promise<void> {
  const loadPromises = ALL_TEMPLATE_TYPES.map((type) => getModelTemplateAsync(type));
  await Promise.all(loadPromises);
}
