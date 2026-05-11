// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentWizardTemplates - Template Library for Content Wizard
 *
 * This module provides pre-built templates for common Minecraft content types.
 * Templates are complete, valid definitions that can be:
 * 1. Used directly as-is
 * 2. Customized by changing names, colors, and properties
 * 3. Combined with traits to add behavior
 *
 * TEMPLATE CATEGORIES:
 * - Entity Templates: Complete entity definitions with geometry, textures, and basic behavior
 * - Block Templates: Complete block definitions with geometry and textures
 * - Item Templates: Complete item definitions with textures and basic properties
 * - Texture Patterns: Reusable texture specifications for common materials
 *
 * USAGE:
 * ```typescript
 * import { EntityTemplates, BlockTemplates, TexturePatterns } from "./ContentWizardTemplates";
 *
 * // Get a template
 * const pigTemplate = EntityTemplates.quadruped_passive;
 *
 * // Customize it
 * const myPig = {
 *   ...pigTemplate,
 *   id: "my_custom_pig",
 *   displayName: "Custom Pig",
 * };
 * ```
 */

import {
  IEntityTypeDefinition,
  IBlockTypeDefinition,
  IItemTypeDefinition,
  ITextureSpec,
  IBlockTexture,
} from "./IContentMetaSchema";

// ============================================================================
// TEXTURE PATTERNS
// ============================================================================

/**
 * Pre-built texture patterns for common Minecraft materials.
 * Each pattern is an ITextureSpec that can be used in entity, block, or item definitions.
 * Uses the 'generate' property for procedural textures per ITextureSpec interface.
 */
export const TexturePatterns: Record<string, ITextureSpec> = {
  // === ORGANIC MATERIALS ===
  skin_tone_1: {
    generate: { type: "stipple_noise", colors: ["#FFDFC4", "#E8C8AC", "#FFE8D4"], seed: 100 },
  },
  skin_tone_2: {
    generate: { type: "stipple_noise", colors: ["#C69C6D", "#B88B5C", "#D4A87A"], seed: 101 },
  },
  skin_tone_3: {
    generate: { type: "stipple_noise", colors: ["#8D5524", "#7A4820", "#9F6028"], seed: 102 },
  },
  fur_white: {
    generate: { type: "stipple_noise", colors: ["#F0F0F0", "#E0E0E0", "#FFFFFF"], seed: 110 },
  },
  fur_brown: {
    generate: { type: "stipple_noise", colors: ["#8B4513", "#A0522D", "#6B3410"], seed: 111 },
  },
  fur_black: {
    generate: { type: "stipple_noise", colors: ["#1A1A1A", "#2A2A2A", "#0A0A0A"], seed: 112 },
  },
  fur_orange: {
    generate: { type: "stipple_noise", colors: ["#E07020", "#C06010", "#F08030"], seed: 113 },
  },
  fur_gray: {
    generate: { type: "stipple_noise", colors: ["#808080", "#707070", "#909090"], seed: 114 },
  },
  scales_green: {
    generate: { type: "dither_noise", colors: ["#228B22", "#1A6B1A", "#2AAB2A"], seed: 120 },
  },
  scales_blue: {
    generate: { type: "dither_noise", colors: ["#2050A0", "#1840B0", "#2860B0"], seed: 121 },
  },
  scales_red: {
    generate: { type: "dither_noise", colors: ["#A02020", "#801818", "#C02828"], seed: 122 },
  },
  feathers_white: {
    generate: { type: "perlin_noise", colors: ["#F8F8F8", "#E8E8E8", "#FFFFFF"], seed: 130, scale: 8 },
  },
  feathers_brown: {
    generate: { type: "perlin_noise", colors: ["#8B6914", "#6B5010", "#AB7918"], seed: 131, scale: 8 },
  },

  // === STONE MATERIALS ===
  stone_gray: {
    generate: { type: "stipple_noise", colors: ["#808080", "#707070", "#909090"], seed: 200 },
  },
  stone_dark: {
    generate: { type: "stipple_noise", colors: ["#404040", "#303030", "#505050"], seed: 201 },
  },
  cobblestone: {
    generate: { type: "stipple_noise", colors: ["#6B6B6B", "#5B5B5B", "#7B7B7B"], seed: 202 },
    effects: { lighting: { preset: "outset", intensity: 0.3 } },
  },
  brick_red: {
    generate: { type: "dither_noise", colors: ["#A04040", "#803030", "#C05050"], seed: 210 },
    effects: { border: { all: { style: "solid", width: 1, color: "#604040" } } },
  },
  sandstone: {
    generate: { type: "perlin_noise", colors: ["#D4B896", "#C4A886", "#E4C8A6"], seed: 220, scale: 6 },
  },

  // === WOOD MATERIALS ===
  wood_oak: {
    generate: { type: "dither_noise", colors: ["#B8945C", "#A88450", "#C8A468"], seed: 300 },
  },
  wood_dark_oak: {
    generate: { type: "dither_noise", colors: ["#4A3728", "#3A2718", "#5A4738"], seed: 301 },
  },
  wood_birch: {
    generate: { type: "dither_noise", colors: ["#E8D8C8", "#D8C8B8", "#F8E8D8"], seed: 302 },
  },
  wood_spruce: {
    generate: { type: "dither_noise", colors: ["#6B5034", "#5B4024", "#7B6044"], seed: 303 },
  },
  planks_oak: {
    generate: { type: "dither_noise", colors: ["#BC9456", "#AC8446", "#CCA466"], seed: 310 },
    effects: { border: { bottom: { style: "solid", width: 1, color: "#8C6436" } } },
  },

  // === METAL MATERIALS ===
  metal_iron: {
    generate: { type: "dither_noise", colors: ["#C0C0C0", "#A8A8A8", "#D8D8D8"], seed: 400 },
    effects: { lighting: { preset: "outset", intensity: 0.2 } },
  },
  metal_gold: {
    generate: { type: "dither_noise", colors: ["#FFD700", "#E8C000", "#FFE828"], seed: 401 },
    effects: { lighting: { preset: "outset", intensity: 0.3 } },
  },
  metal_copper: {
    generate: { type: "dither_noise", colors: ["#B87333", "#A06328", "#C8833E"], seed: 402 },
  },
  metal_netherite: {
    generate: { type: "stipple_noise", colors: ["#3D3D3D", "#2D2D2D", "#4D4D4D"], seed: 403 },
  },

  // === CLOTH/FABRIC ===
  cloth_white: {
    generate: { type: "perlin_noise", colors: ["#F0F0F0", "#E0E0E0", "#FFFFFF"], seed: 500, scale: 4 },
  },
  cloth_red: {
    generate: { type: "perlin_noise", colors: ["#C03030", "#A02020", "#E04040"], seed: 501, scale: 4 },
  },
  cloth_blue: {
    generate: { type: "perlin_noise", colors: ["#3050A0", "#204090", "#4060B0"], seed: 502, scale: 4 },
  },
  cloth_green: {
    generate: { type: "perlin_noise", colors: ["#30A030", "#209020", "#40B040"], seed: 503, scale: 4 },
  },
  leather_brown: {
    generate: { type: "stipple_noise", colors: ["#8B4513", "#7A3A10", "#9C5016"], seed: 510 },
  },

  // === NATURAL MATERIALS ===
  dirt: {
    generate: { type: "stipple_noise", colors: ["#8B6914", "#7B5904", "#9B7924"], seed: 600 },
  },
  grass: {
    generate: { type: "perlin_noise", colors: ["#5B8731", "#4B7721", "#6B9741"], seed: 601, scale: 6 },
  },
  sand: {
    generate: { type: "random_noise", colors: ["#E8D8A0", "#D8C890", "#F8E8B0"], seed: 602 },
  },
  gravel: {
    generate: { type: "random_noise", colors: ["#808080", "#707070", "#909090"], seed: 603 },
  },
  leaves_green: {
    generate: { type: "perlin_noise", colors: ["#2D6B2D", "#1D5B1D", "#3D7B3D"], seed: 610, scale: 4 },
  },

  // === SPECIAL EFFECTS ===
  glowing_yellow: {
    generate: { type: "gradient", colors: ["#FFFF00", "#FFA500"] },
    effects: { overlay: { pattern: "sparkle", density: 0.2 } },
  },
  glowing_blue: {
    generate: { type: "gradient", colors: ["#00BFFF", "#0040FF"] },
    effects: { overlay: { pattern: "sparkle", density: 0.2 } },
  },
  crystal_purple: {
    generate: { type: "perlin_noise", colors: ["#9932CC", "#8B008B", "#BA55D3"], seed: 700, scale: 3 },
    effects: { lighting: { preset: "pillow", intensity: 0.4 } },
  },
  ice: {
    generate: { type: "perlin_noise", colors: ["#B0E0E6", "#87CEEB", "#E0FFFF"], seed: 710, scale: 8 },
  },
  lava: {
    generate: { type: "perlin_noise", colors: ["#FF4500", "#FF6600", "#FF0000"], seed: 720, scale: 4 },
    effects: { overlay: { pattern: "veins", density: 0.3, color: "#FFD700" } },
  },
  slime_green: {
    generate: { type: "solid", colors: ["#7FBF00"] },
    effects: { lighting: { preset: "pillow", intensity: 0.3 } },
  },
  ore_sparkle: {
    generate: { type: "stipple_noise", colors: ["#707070", "#606060", "#808080"], seed: 800 },
    effects: { overlay: { pattern: "sparkle", density: 0.15, color: "#FFD700" } },
  },
  disc_black: {
    generate: { type: "solid", colors: ["#1A1A1A"] },
    effects: { lighting: { preset: "outset", intensity: 0.2 } },
  },
};

// ============================================================================
// ENTITY TEMPLATES
// ============================================================================

/**
 * Pre-built entity templates for common mob types.
 * Each template is a complete IEntityTypeDefinition ready to use.
 * Uses correct property names per IEntityTypeDefinition interface:
 * - attackDamage (not attack)
 * - movementSpeed (not speed)
 * - bodyType values from GeometryTemplateType
 */
export const EntityTemplates: Record<string, IEntityTypeDefinition> = {
  /**
   * Simple passive quadruped (pig-like)
   */
  quadruped_passive: {
    id: "custom_pig",
    displayName: "Custom Pig",
    traits: ["quadruped", "passive", "breedable", "leasable"],
    appearance: {
      bodyType: "quadruped_small",
      primaryColor: "#E07020",
      textureStyle: "organic",
      scale: 1.0,
    },
  },

  /**
   * Simple hostile humanoid (zombie-like)
   */
  humanoid_hostile: {
    id: "custom_zombie",
    displayName: "Custom Zombie",
    traits: ["humanoid", "hostile", "melee_attacker", "undead", "flees_daylight"],
    appearance: {
      bodyType: "humanoid",
      primaryColor: "#4A6B4A",
      secondaryColor: "#2050A0",
      textureStyle: "organic",
      scale: 1.0,
    },
    health: 20,
    attackDamage: 3,
    movementSpeed: 0.23,
    drops: [{ item: "minecraft:rotten_flesh", count: { min: 0, max: 2 }, chance: 1.0 }],
    spawning: {
      biomes: ["plains", "forest"],
      lightLevel: { max: 7 },
      weight: 100,
    },
  },

  /**
   * Neutral animal (wolf-like)
   */
  quadruped_neutral: {
    id: "custom_wolf",
    displayName: "Custom Wolf",
    traits: ["quadruped", "neutral", "melee_attacker", "tameable", "breedable"],
    appearance: {
      bodyType: "quadruped_small",
      primaryColor: "#9E9E9E",
      secondaryColor: "#787878",
      textureStyle: "organic",
      scale: 0.9,
    },
    health: 8,
    attackDamage: 4,
    movementSpeed: 0.3,
  },

  /**
   * Flying creature (bat-like)
   */
  flying_passive: {
    id: "custom_bat",
    displayName: "Custom Bat",
    traits: ["flying", "passive"],
    appearance: {
      bodyType: "flying",
      primaryColor: "#6B4513",
      textureStyle: "organic",
      scale: 0.5,
    },
    health: 6,
    movementSpeed: 0.6,
  },

  /**
   * Aquatic creature (fish-like)
   * Note: Uses "fish" bodyType from GeometryTemplateType
   */
  aquatic_passive: {
    id: "custom_fish",
    displayName: "Custom Fish",
    traits: ["aquatic", "passive"],
    appearance: {
      bodyType: "fish",
      primaryColor: "#2050A0",
      textureStyle: "organic",
      scale: 1.0,
    },
    health: 3,
    movementSpeed: 0.4,
  },

  /**
   * Spider-like arthropod
   * Note: Uses "insect" bodyType from GeometryTemplateType
   */
  arthropod_hostile: {
    id: "custom_spider",
    displayName: "Custom Spider",
    traits: ["arthropod", "hostile", "melee_attacker"],
    appearance: {
      bodyType: "insect",
      primaryColor: "#1A1A1A",
      textureStyle: "organic",
      scale: 1.4,
      eyes: "red",
    },
    health: 16,
    attackDamage: 2,
    movementSpeed: 0.3,
  },

  /**
   * Simple slime creature
   */
  slime_hostile: {
    id: "custom_slime",
    displayName: "Custom Slime",
    traits: ["slime", "hostile", "melee_attacker"],
    appearance: {
      bodyType: "slime",
      primaryColor: "#7FBF00",
      textureStyle: "solid",
      scale: 1.0,
    },
    health: 16,
    attackDamage: 4,
    movementSpeed: 0.5,
  },

  /**
   * Boss entity template
   */
  boss_humanoid: {
    id: "custom_boss",
    displayName: "Custom Boss",
    traits: ["humanoid", "boss", "melee_attacker", "ranged_attacker"],
    appearance: {
      bodyType: "humanoid",
      primaryColor: "#3D3D3D",
      secondaryColor: "#8D5524",
      textureStyle: "armored",
      scale: 2.0,
      eyes: "glowing",
    },
    health: 300,
    attackDamage: 12,
    movementSpeed: 0.35,
  },
};

// ============================================================================
// BLOCK TEMPLATES
// ============================================================================

/**
 * Helper to wrap a texture spec in an IBlockTexture
 */
function blockTexture(spec: ITextureSpec): IBlockTexture {
  return { all: spec };
}

/**
 * Pre-built block templates for common block types.
 * Each template is a complete IBlockTypeDefinition ready to use.
 */
export const BlockTemplates: Record<string, IBlockTypeDefinition> = {
  /**
   * Simple solid cube
   */
  solid_cube: {
    id: "custom_block",
    displayName: "Custom Block",
    traits: ["solid"],
    texture: blockTexture(TexturePatterns.stone_gray),
    sounds: "stone",
  },

  /**
   * Wood plank block
   */
  wood_planks: {
    id: "custom_planks",
    displayName: "Custom Planks",
    traits: ["solid"],
    texture: blockTexture(TexturePatterns.planks_oak),
    sounds: "wood",
    flammable: true,
  },

  /**
   * Light-emitting block
   */
  light_block: {
    id: "custom_lamp",
    displayName: "Custom Lamp",
    traits: ["solid", "light_source"],
    texture: blockTexture(TexturePatterns.glowing_yellow),
    sounds: "stone",
    lightEmission: 15,
  },

  /**
   * Door block
   */
  door_block: {
    id: "custom_door",
    displayName: "Custom Door",
    traits: ["door"],
    texture: blockTexture(TexturePatterns.wood_dark_oak),
    sounds: "wood",
  },

  /**
   * Transparent/glass block
   */
  glass_block: {
    id: "custom_glass",
    displayName: "Custom Glass",
    traits: ["transparent"],
    texture: blockTexture(TexturePatterns.ice),
    sounds: "glass",
  },

  /**
   * Crafting station
   */
  crafting_block: {
    id: "custom_workbench",
    displayName: "Custom Workbench",
    traits: ["solid", "workstation"],
    texture: blockTexture(TexturePatterns.planks_oak),
    sounds: "wood",
  },

  /**
   * Slab block
   */
  slab_block: {
    id: "custom_slab",
    displayName: "Custom Slab",
    traits: ["slab"],
    texture: blockTexture(TexturePatterns.stone_gray),
    sounds: "stone",
  },

  /**
   * Stairs block
   */
  stairs_block: {
    id: "custom_stairs",
    displayName: "Custom Stairs",
    traits: ["stairs"],
    texture: blockTexture(TexturePatterns.cobblestone),
    sounds: "stone",
  },

  /**
   * Ore block
   */
  ore_block: {
    id: "custom_ore",
    displayName: "Custom Ore",
    traits: ["solid"],
    texture: blockTexture(TexturePatterns.ore_sparkle),
    sounds: "stone",
  },
};

// ============================================================================
// ITEM TEMPLATES
// ============================================================================

/**
 * Pre-built item templates for common item types.
 * Each template is a complete IItemTypeDefinition ready to use.
 * Uses correct property names per IItemTypeDefinition:
 * - maxStackSize (not stackSize)
 * - icon (not texture) for inventory icon
 * - fuel is a number (burn duration in ticks)
 * - armor.slot is required
 */
export const ItemTemplates: Record<string, IItemTypeDefinition> = {
  /**
   * Simple sword
   */
  sword_iron: {
    id: "custom_sword",
    displayName: "Custom Sword",
    traits: ["sword"],
    icon: TexturePatterns.metal_iron,
    weapon: {
      damage: 6,
      durability: 250,
    },
  },

  /**
   * Golden sword (high enchantability)
   */
  sword_gold: {
    id: "custom_gold_sword",
    displayName: "Custom Gold Sword",
    traits: ["sword"],
    icon: TexturePatterns.metal_gold,
    weapon: {
      damage: 4,
      durability: 32,
    },
    glint: true,
  },

  /**
   * Pickaxe
   */
  pickaxe_iron: {
    id: "custom_pickaxe",
    displayName: "Custom Pickaxe",
    traits: ["pickaxe"],
    icon: TexturePatterns.metal_iron,
    tool: {
      miningSpeed: 1.2,
      durability: 250,
    },
  },

  /**
   * Simple food
   */
  food_basic: {
    id: "custom_food",
    displayName: "Custom Food",
    traits: ["food"],
    icon: TexturePatterns.fur_brown,
    maxStackSize: 64,
    food: {
      nutrition: 4,
      saturation: 0.6,
    },
  },

  /**
   * Healing potion
   */
  potion_healing: {
    id: "custom_potion",
    displayName: "Custom Potion",
    traits: ["food"],
    icon: TexturePatterns.glowing_blue,
    maxStackSize: 1,
    glint: true,
  },

  /**
   * Armor piece (helmet)
   */
  armor_helmet: {
    id: "custom_helmet",
    displayName: "Custom Helmet",
    traits: ["armor_helmet"],
    icon: TexturePatterns.metal_iron,
    armor: {
      slot: "helmet",
      defense: 2,
      durability: 165,
    },
  },

  /**
   * Armor piece (chestplate)
   */
  armor_chestplate: {
    id: "custom_chestplate",
    displayName: "Custom Chestplate",
    traits: ["armor_chestplate"],
    icon: TexturePatterns.metal_iron,
    armor: {
      slot: "chestplate",
      defense: 6,
      durability: 240,
    },
  },

  /**
   * Throwable item
   */
  throwable_item: {
    id: "custom_throwable",
    displayName: "Custom Throwable",
    traits: ["throwable"],
    icon: TexturePatterns.stone_gray,
    maxStackSize: 16,
  },

  /**
   * Music disc
   */
  music_disc: {
    id: "custom_disc",
    displayName: "Custom Music Disc",
    icon: TexturePatterns.disc_black,
    maxStackSize: 1,
  },

  /**
   * Fuel item
   */
  fuel_item: {
    id: "custom_fuel",
    displayName: "Custom Fuel",
    icon: TexturePatterns.wood_dark_oak,
    maxStackSize: 64,
    fuel: 200,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all available texture pattern names.
 */
export function getTexturePatternNames(): string[] {
  return Object.keys(TexturePatterns);
}

/**
 * Get a texture pattern by name.
 */
export function getTexturePattern(name: string): ITextureSpec | undefined {
  return TexturePatterns[name];
}

/**
 * Get all available entity template names.
 */
export function getEntityTemplateNames(): string[] {
  return Object.keys(EntityTemplates);
}

/**
 * Get an entity template by name.
 */
export function getEntityTemplate(name: string): IEntityTypeDefinition | undefined {
  return EntityTemplates[name];
}

/**
 * Get all available block template names.
 */
export function getBlockTemplateNames(): string[] {
  return Object.keys(BlockTemplates);
}

/**
 * Get a block template by name.
 */
export function getBlockTemplate(name: string): IBlockTypeDefinition | undefined {
  return BlockTemplates[name];
}

/**
 * Get all available item template names.
 */
export function getItemTemplateNames(): string[] {
  return Object.keys(ItemTemplates);
}

/**
 * Get an item template by name.
 */
export function getItemTemplate(name: string): IItemTypeDefinition | undefined {
  return ItemTemplates[name];
}

/**
 * Create a customized copy of an entity template.
 */
export function customizeEntityTemplate(
  templateName: string,
  overrides: Partial<IEntityTypeDefinition>
): IEntityTypeDefinition | undefined {
  const template = EntityTemplates[templateName];
  if (!template) return undefined;

  return {
    ...template,
    ...overrides,
    // Deep merge appearance if provided
    appearance: overrides.appearance ? { ...template.appearance, ...overrides.appearance } : template.appearance,
  };
}

/**
 * Create a customized copy of a block template.
 */
export function customizeBlockTemplate(
  templateName: string,
  overrides: Partial<IBlockTypeDefinition>
): IBlockTypeDefinition | undefined {
  const template = BlockTemplates[templateName];
  if (!template) return undefined;

  return {
    ...template,
    ...overrides,
  };
}

/**
 * Create a customized copy of an item template.
 */
export function customizeItemTemplate(
  templateName: string,
  overrides: Partial<IItemTypeDefinition>
): IItemTypeDefinition | undefined {
  const template = ItemTemplates[templateName];
  if (!template) return undefined;

  return {
    ...template,
    ...overrides,
  };
}
