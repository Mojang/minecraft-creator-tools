// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MinecraftReferenceTypes - Reference type detection for cross-file navigation
 *
 * This module provides utilities for detecting what type of reference a value
 * represents (texture path, entity ID, animation name, etc.). Used by both
 * VS Code go-to-definition and Monaco cross-file navigation.
 *
 * USAGE:
 * ```typescript
 * import { ReferenceType, getReferenceTypeFromPath } from '../langcore';
 *
 * const refType = getReferenceTypeFromPath(['minecraft:entity', 'components', 'minecraft:loot', 'table']);
 * // Returns: 'loot_table'
 * ```
 */

/**
 * Types of cross-file references in Minecraft content
 */
export type ReferenceType =
  | "texture"
  | "geometry"
  | "animation"
  | "animation_controller"
  | "render_controller"
  | "event"
  | "component_group"
  | "entity_id"
  | "block_id"
  | "item_id"
  | "loot_table"
  | "spawn_rule"
  | "sound"
  | "particle"
  | "fog"
  | "recipe"
  | "feature"
  | "biome"
  | "structure"
  | "dialogue"
  | "function"
  | "unknown";

/**
 * Reference information with context
 */
export interface IReferenceInfo {
  /** The type of reference */
  type: ReferenceType;
  /** The identifier value */
  identifier: string;
  /** Whether this is a definition or a usage */
  isDefinition: boolean;
  /** The JSON path where this reference was found */
  jsonPath: string[];
  /** Namespace (e.g., "minecraft" from "minecraft:pig") */
  namespace?: string;
  /** Short name (e.g., "pig" from "minecraft:pig") */
  shortName?: string;
}

/**
 * Patterns for detecting reference types from JSON paths
 * Patterns match against the end of the path (last few segments)
 */
interface IPathPattern {
  /** Path segment pattern to match */
  pattern: RegExp;
  /** Reference type if matched */
  type: ReferenceType;
  /** Weight for priority (higher = more specific) */
  weight: number;
}

const PATH_PATTERNS: IPathPattern[] = [
  // Texture references
  { pattern: /textures\.[^.]+$/, type: "texture", weight: 10 },
  { pattern: /^texture$/, type: "texture", weight: 5 },
  { pattern: /textures\.default$/, type: "texture", weight: 10 },

  // Geometry references
  { pattern: /geometry\.[^.]+$/, type: "geometry", weight: 10 },
  { pattern: /^geometry$/, type: "geometry", weight: 5 },
  { pattern: /description\.geometry$/, type: "geometry", weight: 10 },

  // Animation references
  { pattern: /animations\.[^.]+$/, type: "animation", weight: 10 },
  { pattern: /^animation$/, type: "animation", weight: 5 },
  { pattern: /animate\[\d+\]$/, type: "animation", weight: 10 },

  // Animation controller references
  { pattern: /animation_controllers\[\d+\]$/, type: "animation_controller", weight: 10 },

  // Render controller references
  { pattern: /render_controllers\[\d+\]$/, type: "render_controller", weight: 10 },

  // Event references (within same file)
  { pattern: /^event$/, type: "event", weight: 8 },
  { pattern: /on_.*_event\.event$/, type: "event", weight: 10 },
  { pattern: /trigger\.event$/, type: "event", weight: 10 },

  // Component group references (within same file)
  { pattern: /add\.component_groups\[\d+\]$/, type: "component_group", weight: 10 },
  { pattern: /remove\.component_groups\[\d+\]$/, type: "component_group", weight: 10 },

  // Entity references
  { pattern: /entity_type$/, type: "entity_id", weight: 8 },
  { pattern: /spawn_entity$/, type: "entity_id", weight: 8 },
  { pattern: /target_entity$/, type: "entity_id", weight: 8 },
  { pattern: /minecraft:rideable\.family_types\[\d+\]$/, type: "entity_id", weight: 10 },

  // Block references
  { pattern: /^block$/, type: "block_id", weight: 5 },
  { pattern: /block_type$/, type: "block_id", weight: 8 },
  { pattern: /blocks\[\d+\]$/, type: "block_id", weight: 7 },

  // Item references
  { pattern: /^item$/, type: "item_id", weight: 5 },
  { pattern: /items\[\d+\]\.item$/, type: "item_id", weight: 10 },
  { pattern: /repair_items\[\d+\]$/, type: "item_id", weight: 10 },

  // Loot table references
  { pattern: /^table$/, type: "loot_table", weight: 6 },
  { pattern: /loot_table$/, type: "loot_table", weight: 8 },

  // Sound references
  { pattern: /^sound$/, type: "sound", weight: 5 },
  { pattern: /sounds\.[^.]+$/, type: "sound", weight: 8 },

  // Particle references
  { pattern: /^particle$/, type: "particle", weight: 5 },
  { pattern: /particle_type$/, type: "particle", weight: 8 },

  // Fog references
  { pattern: /^fog$/, type: "fog", weight: 5 },
  { pattern: /fog_identifier$/, type: "fog", weight: 8 },

  // Structure references
  { pattern: /^structure$/, type: "structure", weight: 5 },
  { pattern: /structure_name$/, type: "structure", weight: 8 },

  // Function references
  { pattern: /^function$/, type: "function", weight: 5 },
  { pattern: /run_command\.command$/, type: "function", weight: 8 },
];

/**
 * Property name patterns for reference detection
 */
const PROPERTY_PATTERNS: Array<{ pattern: RegExp; type: ReferenceType }> = [
  // Texture references
  { pattern: /^texture$/i, type: "texture" },
  { pattern: /texture_?path$/i, type: "texture" },

  // Geometry references
  { pattern: /^geometry$/i, type: "geometry" },

  // Animation references
  { pattern: /^animation$/i, type: "animation" },

  // Entity references
  { pattern: /entity_?type$/i, type: "entity_id" },
  { pattern: /spawn_?entity$/i, type: "entity_id" },
  { pattern: /target_?entity$/i, type: "entity_id" },

  // Block references
  { pattern: /block_?type$/i, type: "block_id" },

  // Item references
  { pattern: /^item$/i, type: "item_id" },
  { pattern: /item_?type$/i, type: "item_id" },

  // Loot table references
  { pattern: /loot_?table$/i, type: "loot_table" },
  { pattern: /^table$/i, type: "loot_table" },

  // Sound references
  { pattern: /^sound$/i, type: "sound" },
  { pattern: /sound_?event$/i, type: "sound" },

  // Particle references
  { pattern: /^particle$/i, type: "particle" },
  { pattern: /particle_?type$/i, type: "particle" },
  { pattern: /particle_?effect$/i, type: "particle" },

  // Fog references
  { pattern: /fog_?identifier$/i, type: "fog" },
  { pattern: /^fog$/i, type: "fog" },

  // Biome references
  { pattern: /^biome$/i, type: "biome" },
  { pattern: /biome_?filter$/i, type: "biome" },

  // Spawn rule references
  { pattern: /spawn_?rule$/i, type: "spawn_rule" },

  // Event references
  { pattern: /^event$/i, type: "event" },
  { pattern: /trigger_?event$/i, type: "event" },
];

/**
 * Value patterns for reference detection based on the value itself
 */
const VALUE_PATTERNS: Array<{ pattern: RegExp; type: ReferenceType }> = [
  // Texture paths
  { pattern: /^textures\//, type: "texture" },

  // Geometry identifiers
  { pattern: /^geometry\./, type: "geometry" },

  // Animation identifiers
  { pattern: /^animation\./, type: "animation" },

  // Animation controller identifiers
  { pattern: /^controller\.animation\./, type: "animation_controller" },

  // Render controller identifiers
  { pattern: /^controller\.render\./, type: "render_controller" },

  // Loot table paths
  { pattern: /^loot_tables\//, type: "loot_table" },

  // Recipe paths
  { pattern: /^recipes\//, type: "recipe" },

  // Structure paths
  { pattern: /^structures\//, type: "structure" },

  // Function paths (mcfunction)
  { pattern: /^functions\//, type: "function" },

  // Particle effect identifiers (e.g., "minecraft:campfire_smoke_particle")
  { pattern: /_particle$/, type: "particle" },
  { pattern: /^minecraft:.*particle/, type: "particle" },

  // Fog identifiers (e.g., "minecraft:fog_hell", "minecraft:fog_the_end")
  { pattern: /^minecraft:fog_/, type: "fog" },
];

/**
 * Get reference type from a JSON path
 *
 * @param jsonPath - Array of path segments from root to current position
 * @returns The detected reference type, or 'unknown'
 */
export function getReferenceTypeFromPath(jsonPath: string[]): ReferenceType {
  const pathString = jsonPath.join(".");

  let bestMatch: { type: ReferenceType; weight: number } = { type: "unknown", weight: 0 };

  for (const { pattern, type, weight } of PATH_PATTERNS) {
    if (pattern.test(pathString) && weight > bestMatch.weight) {
      bestMatch = { type, weight };
    }
  }

  return bestMatch.type;
}

/**
 * Get reference type from a property name
 *
 * @param propertyName - The property name to analyze
 * @returns The detected reference type, or 'unknown'
 */
export function getReferenceTypeFromProperty(propertyName: string): ReferenceType {
  for (const { pattern, type } of PROPERTY_PATTERNS) {
    if (pattern.test(propertyName)) {
      return type;
    }
  }

  return "unknown";
}

/**
 * Get reference type from a value
 *
 * @param value - The string value to analyze
 * @returns The detected reference type, or 'unknown'
 */
export function getReferenceTypeFromValue(value: string): ReferenceType {
  for (const { pattern, type } of VALUE_PATTERNS) {
    if (pattern.test(value)) {
      return type;
    }
  }

  return "unknown";
}

/**
 * Parse a namespaced identifier (e.g., "minecraft:pig")
 *
 * @param identifier - The identifier to parse
 * @returns Object with namespace and name parts
 */
export function parseNamespacedId(identifier: string): { namespace: string; name: string } {
  const colonIndex = identifier.indexOf(":");
  if (colonIndex >= 0) {
    return {
      namespace: identifier.substring(0, colonIndex),
      name: identifier.substring(colonIndex + 1),
    };
  }
  return {
    namespace: "minecraft", // Default namespace
    name: identifier,
  };
}

/**
 * Check if a value looks like a Minecraft identifier
 *
 * @param value - The value to check
 * @returns true if the value looks like a Minecraft identifier
 */
export function looksLikeMinecraftId(value: string): boolean {
  // Check for namespace:id pattern
  if (/^[a-z_][a-z0-9_]*:[a-z_][a-z0-9_./]*$/i.test(value)) {
    return true;
  }

  // Check for path patterns
  if (
    value.startsWith("textures/") ||
    value.startsWith("geometry.") ||
    value.startsWith("animation.") ||
    value.startsWith("controller.")
  ) {
    return true;
  }

  return false;
}

/**
 * Get the file extension typically associated with a reference type
 */
export function getFileExtensionForType(type: ReferenceType): string {
  switch (type) {
    case "texture":
      return ".png";
    case "geometry":
      return ".geo.json";
    case "animation":
      return ".animation.json";
    case "animation_controller":
      return ".animation_controllers.json";
    case "render_controller":
      return ".render_controllers.json";
    case "function":
      return ".mcfunction";
    case "structure":
      return ".mcstructure";
    default:
      return ".json";
  }
}
