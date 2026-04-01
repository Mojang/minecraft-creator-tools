// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * PACKAGE SCHEMA MAPPING
 * ======================
 *
 * Defines the mapping from internal form document paths to the organized
 * package folder structure used by @minecraft/bedrock-schemas.
 *
 * Each document type maps to a bp_/rp_ prefixed folder that mirrors the
 * folder path within a Minecraft Bedrock pack. For example:
 * - Entity behavior forms → bp_entities/ (matches <behavior_pack>/entities/)
 * - Fog resource forms → rp_fogs/ (matches <resource_pack>/fogs/)
 *
 * The "common" folder holds schemas shared across 3+ document types
 * (filters, event triggers, ranges, etc.).
 */

export type PackType = "behavior" | "resource" | "skin" | "world";

export interface IPackageSchemaEntry {
  /** The form document path (e.g., "entity/entity_behavior_document") */
  formDocPath: string;
  /** Pack type: behavior, resource, skin, world */
  packType: PackType;
  /** Folder within the pack (e.g., "entities", "fogs") */
  packFolder: string;
  /** Output folder name in the package (e.g., "bp_entities", "rp_fogs") */
  outputFolder: string;
  /** Filename for the document-level schema (usually "index.schema.json") */
  outputFilename: string;
  /** Human-readable title */
  title: string;
  /** Glob patterns for VS Code json.schemas fileMatch. Empty = no auto-association. */
  fileMatch?: string[];
}

/**
 * Complete mapping of document-level form definitions to their package output locations.
 * This is the single source of truth for the package folder layout.
 */
export const PACKAGE_SCHEMA_ENTRIES: IPackageSchemaEntry[] = [
  // ── Behavior Pack document types ──────────────────────────────────────
  {
    formDocPath: "entity/entity_behavior_document",
    packType: "behavior",
    packFolder: "entities",
    outputFolder: "bp/entities",
    outputFilename: "index.schema.json",
    title: "Entity Behavior",
  },
  {
    formDocPath: "block/block_behavior_document",
    packType: "behavior",
    packFolder: "blocks",
    outputFolder: "bp/blocks",
    outputFilename: "index.schema.json",
    title: "Block Behavior",
  },
  {
    formDocPath: "item/item_behavior_document",
    packType: "behavior",
    packFolder: "items",
    outputFolder: "bp/items",
    outputFilename: "index.schema.json",
    title: "Item Behavior",
  },
  {
    formDocPath: "biome/biome_json_file",
    packType: "behavior",
    packFolder: "biomes",
    outputFolder: "bp/biomes",
    outputFilename: "index.schema.json",
    title: "Biome",
  },
  {
    formDocPath: "features/features",
    packType: "behavior",
    packFolder: "features",
    outputFolder: "bp/features",
    outputFilename: "index.schema.json",
    title: "Feature",
  },
  {
    formDocPath: "feature/feature_rule_definition",
    packType: "behavior",
    packFolder: "feature_rules",
    outputFolder: "bp/feature_rules",
    outputFilename: "index.schema.json",
    title: "Feature Rule",
  },
  {
    formDocPath: "loot/loot_table",
    packType: "behavior",
    packFolder: "loot_tables",
    outputFolder: "bp/loot_tables",
    outputFilename: "index.schema.json",
    title: "Loot Table",
  },
  {
    formDocPath: "recipe/recipe",
    packType: "behavior",
    packFolder: "recipes",
    outputFolder: "bp/recipes",
    outputFilename: "index.schema.json",
    title: "Recipe",
  },
  {
    formDocPath: "spawn/spawn_rules_document",
    packType: "behavior",
    packFolder: "spawn_rules",
    outputFolder: "bp/spawn_rules",
    outputFilename: "index.schema.json",
    title: "Spawn Rule",
  },
  {
    formDocPath: "trade/tradetabledata",
    packType: "behavior",
    packFolder: "trading",
    outputFolder: "bp/trading",
    outputFilename: "index.schema.json",
    title: "Trade Table",
  },
  {
    formDocPath: "dialogue/dialogue_document",
    packType: "behavior",
    packFolder: "dialogue",
    outputFolder: "bp/dialogue",
    outputFilename: "index.schema.json",
    title: "NPC Dialogue",
  },
  {
    formDocPath: "animation/animation_document",
    packType: "behavior",
    packFolder: "animations",
    outputFolder: "bp/animations",
    outputFilename: "index.schema.json",
    title: "Animation (BP)",
  },
  {
    formDocPath: "animation/animation_controller_document",
    packType: "behavior",
    packFolder: "animation_controllers",
    outputFolder: "bp/animation_controllers",
    outputFilename: "index.schema.json",
    title: "Animation Controller (BP)",
  },
  {
    formDocPath: "voxel_shapes/voxel_shape_document",
    packType: "behavior",
    packFolder: "voxel_shapes",
    outputFolder: "bp/voxel_shapes",
    outputFilename: "index.schema.json",
    title: "Voxel Shape",
  },
  {
    formDocPath: "behavior/tick",
    packType: "behavior",
    packFolder: "functions",
    outputFolder: "bp/functions",
    outputFilename: "tick.schema.json",
    title: "Tick (functions)",
  },
  {
    formDocPath: "pack/behavior_pack_header_json",
    packType: "behavior",
    packFolder: "",
    outputFolder: "bp/manifest",
    outputFilename: "index.schema.json",
    title: "Behavior Pack Manifest",
  },

  // ── Resource Pack document types ──────────────────────────────────────
  {
    formDocPath: "visual/actor_resource_definition",
    packType: "resource",
    packFolder: "entity",
    outputFolder: "rp/entity",
    outputFilename: "index.schema.json",
    title: "Entity Resource",
  },
  {
    formDocPath: "visual/geometry",
    packType: "resource",
    packFolder: "models",
    outputFolder: "rp/models",
    outputFilename: "index.schema.json",
    title: "Model Geometry",
  },
  {
    formDocPath: "fog/fog_document",
    packType: "resource",
    packFolder: "fogs",
    outputFolder: "rp/fogs",
    outputFilename: "index.schema.json",
    title: "Fog",
  },
  {
    formDocPath: "client_particles/particle_document",
    packType: "resource",
    packFolder: "particles",
    outputFolder: "rp/particles",
    outputFilename: "index.schema.json",
    title: "Particle",
  },
  {
    formDocPath: "attachable/attachable",
    packType: "resource",
    packFolder: "attachables",
    outputFolder: "rp/attachables",
    outputFilename: "index.schema.json",
    title: "Attachable",
  },
  {
    formDocPath: "resource/render_controller_set",
    packType: "resource",
    packFolder: "render_controllers",
    outputFolder: "rp/render_controllers",
    outputFilename: "index.schema.json",
    title: "Render Controller",
  },
  {
    formDocPath: "resource/sound_definitions",
    packType: "resource",
    packFolder: "sounds",
    outputFolder: "rp/sounds",
    outputFilename: "index.schema.json",
    title: "Sound Definition",
  },
  {
    formDocPath: "resource/blocks_resource",
    packType: "resource",
    packFolder: "textures",
    outputFolder: "rp/textures",
    outputFilename: "blocks_resource.schema.json",
    title: "Blocks Resource (blocks.json)",
  },
  {
    formDocPath: "resource/terrain_texture",
    packType: "resource",
    packFolder: "textures",
    outputFolder: "rp/textures",
    outputFilename: "terrain_texture.schema.json",
    title: "Terrain Texture",
  },
  {
    formDocPath: "resource/item_texture",
    packType: "resource",
    packFolder: "textures",
    outputFolder: "rp/textures",
    outputFilename: "item_texture.schema.json",
    title: "Item Texture",
  },
  {
    formDocPath: "resource/flipbook_textures",
    packType: "resource",
    packFolder: "textures",
    outputFolder: "rp/textures",
    outputFilename: "flipbook_textures.schema.json",
    title: "Flipbook Textures",
  },
  {
    formDocPath: "block_culling/blockculling",
    packType: "resource",
    packFolder: "block_culling",
    outputFolder: "rp/block_culling",
    outputFilename: "index.schema.json",
    title: "Block Culling",
  },
  {
    formDocPath: "ui/ui_screen",
    packType: "resource",
    packFolder: "ui",
    outputFolder: "rp/ui",
    outputFilename: "index.schema.json",
    title: "UI Screen",
  },
  {
    formDocPath: "ui/ui_global_variables",
    packType: "resource",
    packFolder: "ui",
    outputFolder: "rp/ui",
    outputFilename: "global_variables.schema.json",
    title: "UI Global Variables",
  },
  {
    formDocPath: "biomes_client/biomes_client",
    packType: "resource",
    packFolder: "",
    outputFolder: "rp/biomes_client",
    outputFilename: "index.schema.json",
    title: "Biomes Client (legacy)",
  },
  {
    formDocPath: "visual/texture_set",
    packType: "resource",
    packFolder: "textures",
    outputFolder: "rp/textures",
    outputFilename: "texture_set.schema.json",
    title: "Texture Set",
  },
  {
    formDocPath: "pack/resource_pack_manifest",
    packType: "resource",
    packFolder: "",
    outputFolder: "rp/manifest",
    outputFilename: "index.schema.json",
    title: "Resource Pack Manifest",
  },
  {
    formDocPath: "resource/languages",
    packType: "resource",
    packFolder: "texts",
    outputFolder: "rp/texts",
    outputFilename: "languages.schema.json",
    title: "Languages",
  },
  {
    formDocPath: "resource/music_definitions",
    packType: "resource",
    packFolder: "sounds",
    outputFolder: "rp/sounds",
    outputFilename: "music_definitions.schema.json",
    title: "Music Definitions",
  },

  // ── Resource Pack: Deferred Rendering ─────────────────────────────────
  {
    formDocPath: "client_deferred_rendering/lightinggroup_lightingimpl",
    packType: "resource",
    packFolder: "lighting",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "lighting.schema.json",
    title: "Lighting",
  },
  {
    formDocPath: "client_deferred_rendering/colorgraderconfig_colorgradingparameterssrc",
    packType: "resource",
    packFolder: "color_grading",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "color_grading.schema.json",
    title: "Color Grading",
  },
  {
    formDocPath: "client_deferred_rendering/atmosphericscattering_atmosphericscatteringconfigsettings",
    packType: "resource",
    packFolder: "atmospherics",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "atmospherics.schema.json",
    title: "Atmospherics",
  },
  {
    formDocPath: "client_deferred_rendering/pbrfallbackconfig_pbrfallbackconfigsettings",
    packType: "resource",
    packFolder: "pbr",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "pbr.schema.json",
    title: "PBR Fallback",
  },
  {
    formDocPath: "client_deferred_rendering/pointlightconfig_pointlightconfigsettings",
    packType: "resource",
    packFolder: "point_lights",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "point_lights.schema.json",
    title: "Point Lights",
  },
  {
    formDocPath: "client_deferred_rendering/shadowstylizationconfig_shadowstylizationconfigsettings",
    packType: "resource",
    packFolder: "shadows",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "shadows.schema.json",
    title: "Shadows",
  },
  {
    formDocPath: "client_deferred_rendering/waterconfig_waterconfigsettingsv1",
    packType: "resource",
    packFolder: "water",
    outputFolder: "rp/deferred_rendering",
    outputFilename: "water.schema.json",
    title: "Water",
  },

  // ── World types ───────────────────────────────────────────────────────
  {
    formDocPath: "world/world_packs",
    packType: "world",
    packFolder: "",
    outputFolder: "world",
    outputFilename: "world_packs.schema.json",
    title: "World Packs",
  },
];

/**
 * SubFormIds that should be placed in the common/ folder because they are
 * referenced by multiple document types. These get extracted once and
 * referenced via "../common/<name>.schema.json".
 */
export const COMMON_SUBFORM_IDS: string[] = [
  "misc/floatrange",
  "misc/intrange",
  "misc/stringrange",
  "world_common/filter_test",
  "world_common/filter_group",
  "world_common/filter_group_map",
  "entityfilters/filter_test",
];

/**
 * Leaf names (the part after the last /) that should be treated as common
 * regardless of what their full subFormId path is. Many shared types exist
 * under multiple prefixes (e.g., "misc/floatrange", "item_components/floatrange").
 */
export const COMMON_LEAF_NAMES: string[] = [
  "floatrange",
  "intrange",
  "stringrange",
  "filter_test",
  "filter_group",
  "filter_group_map",
];

/**
 * Look up the package output entry for a given form document ID.
 * The formDocId is the subFormId path of a document-level form
 * (e.g., "entity/entity_behavior_document").
 *
 * Matches are done with startsWith to handle versioned form paths like
 * "visual/geometry.v1.21.0" matching "visual/geometry".
 */
export function getPackageEntryForFormDoc(formDocId: string): IPackageSchemaEntry | undefined {
  // Try exact match first
  const exact = PACKAGE_SCHEMA_ENTRIES.find((e) => e.formDocPath === formDocId);
  if (exact) return exact;

  // Try prefix match for versioned paths (e.g., "visual/geometry.v1.21.0" → "visual/geometry")
  return PACKAGE_SCHEMA_ENTRIES.find((e) => formDocId.startsWith(e.formDocPath));
}

/**
 * Check if a subFormId should be placed in the common/ folder.
 * Matches by exact subFormId, prefix, or leaf name.
 */
export function isCommonSubForm(subFormId: string): boolean {
  if (COMMON_SUBFORM_IDS.some((commonId) => subFormId === commonId || subFormId.startsWith(commonId + "."))) {
    return true;
  }

  // Also check by leaf name — e.g., "item_components/floatrange" matches "floatrange"
  const leaf = subFormId.includes("/") ? subFormId.substring(subFormId.lastIndexOf("/") + 1) : subFormId;
  return COMMON_LEAF_NAMES.includes(leaf);
}

/**
 * Check if a $defs definition name looks like a common type based on its leaf name.
 * Used when the defName was derived from a subFormId we can't reverse-lookup.
 */
export function isCommonDefName(defName: string): boolean {
  for (const leaf of COMMON_LEAF_NAMES) {
    if (defName === leaf || defName.endsWith("_" + leaf)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all unique output folders from the mapping.
 */
export function getPackageOutputFolders(): string[] {
  const folders = new Set<string>();
  for (const entry of PACKAGE_SCHEMA_ENTRIES) {
    folders.add(entry.outputFolder);
  }
  return Array.from(folders);
}
