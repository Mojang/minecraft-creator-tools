// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LegacyItemMap — resolves pre-flattening Minecraft Bedrock item identifiers
 * (e.g. `minecraft:planks` with `data: 4`) to their modern, flattened
 * equivalents (`minecraft:acacia_planks`).
 *
 * Bedrock 1.16 ("Nether Update") flattened most metadata-keyed items so each
 * variant became its own identifier. Older recipe / loot / trade JSON still
 * commonly references the legacy ids — and those legacy ids generally have
 * no dedicated texture in the modern resource pack, which is why a recipe
 * that lists `{ "item": "minecraft:planks", "data": 4 }` shows up in the
 * editor as a "PLAN" placeholder instead of acacia planks.
 *
 * `resolveLegacyItem(id, data?)` returns the modern id when a known legacy
 * id+data pair is provided, otherwise returns the original id unchanged.
 *
 * The map intentionally focuses on the items that actually appear in
 * vanilla recipes; expand it as needed when more legacy references surface.
 *
 * References:
 *   https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemdefinitionproperties
 *   https://minecraft.wiki/w/Java_Edition_data_value/Pre-flattening (cross-referenced
 *   against Bedrock equivalents — Bedrock retained these legacy ids longer than Java).
 */

/**
 * Modern id for a (legacy id, data) tuple. Lookups without a `data` value
 * fall back to the entry at index 0 (the canonical default for that family,
 * usually the oak / white / stone / oak-boat variant).
 */
const LEGACY_VARIANTS: Record<string, string[]> = {
  // Wood family — data 0..5 across pre-flattening
  "minecraft:planks": [
    "minecraft:oak_planks",
    "minecraft:spruce_planks",
    "minecraft:birch_planks",
    "minecraft:jungle_planks",
    "minecraft:acacia_planks",
    "minecraft:dark_oak_planks",
  ],
  "minecraft:log": [
    "minecraft:oak_log",
    "minecraft:spruce_log",
    "minecraft:birch_log",
    "minecraft:jungle_log",
  ],
  "minecraft:log2": ["minecraft:acacia_log", "minecraft:dark_oak_log"],
  "minecraft:wood": [
    "minecraft:oak_wood",
    "minecraft:spruce_wood",
    "minecraft:birch_wood",
    "minecraft:jungle_wood",
    "minecraft:acacia_wood",
    "minecraft:dark_oak_wood",
  ],
  "minecraft:leaves": [
    "minecraft:oak_leaves",
    "minecraft:spruce_leaves",
    "minecraft:birch_leaves",
    "minecraft:jungle_leaves",
  ],
  "minecraft:leaves2": ["minecraft:acacia_leaves", "minecraft:dark_oak_leaves"],
  "minecraft:sapling": [
    "minecraft:oak_sapling",
    "minecraft:spruce_sapling",
    "minecraft:birch_sapling",
    "minecraft:jungle_sapling",
    "minecraft:acacia_sapling",
    "minecraft:dark_oak_sapling",
  ],
  "minecraft:boat": [
    "minecraft:oak_boat",
    "minecraft:spruce_boat",
    "minecraft:birch_boat",
    "minecraft:jungle_boat",
    "minecraft:acacia_boat",
    "minecraft:dark_oak_boat",
  ],
  "minecraft:wooden_slab": [
    "minecraft:oak_slab",
    "minecraft:spruce_slab",
    "minecraft:birch_slab",
    "minecraft:jungle_slab",
    "minecraft:acacia_slab",
    "minecraft:dark_oak_slab",
  ],
  "minecraft:double_wooden_slab": [
    "minecraft:oak_double_slab",
    "minecraft:spruce_double_slab",
    "minecraft:birch_double_slab",
    "minecraft:jungle_double_slab",
    "minecraft:acacia_double_slab",
    "minecraft:dark_oak_double_slab",
  ],

  // Stone family — data 0..6
  "minecraft:stone": [
    "minecraft:stone",
    "minecraft:granite",
    "minecraft:polished_granite",
    "minecraft:diorite",
    "minecraft:polished_diorite",
    "minecraft:andesite",
    "minecraft:polished_andesite",
  ],
  "minecraft:dirt": ["minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol"],
  "minecraft:sand": ["minecraft:sand", "minecraft:red_sand"],
  "minecraft:sandstone": [
    "minecraft:sandstone",
    "minecraft:chiseled_sandstone",
    "minecraft:cut_sandstone",
    "minecraft:smooth_sandstone",
  ],
  "minecraft:red_sandstone": [
    "minecraft:red_sandstone",
    "minecraft:chiseled_red_sandstone",
    "minecraft:cut_red_sandstone",
    "minecraft:smooth_red_sandstone",
  ],
  "minecraft:stonebrick": [
    "minecraft:stone_bricks",
    "minecraft:mossy_stone_bricks",
    "minecraft:cracked_stone_bricks",
    "minecraft:chiseled_stone_bricks",
  ],
  "minecraft:prismarine": [
    "minecraft:prismarine",
    "minecraft:dark_prismarine",
    "minecraft:prismarine_bricks",
  ],
  "minecraft:quartz_block": [
    "minecraft:quartz_block",
    "minecraft:chiseled_quartz_block",
    "minecraft:quartz_pillar",
    "minecraft:smooth_quartz",
  ],

  // Color-by-data families — share the standard 16-color order
  // 0=white,1=orange,2=magenta,3=light_blue,4=yellow,5=lime,6=pink,7=gray,
  // 8=light_gray,9=cyan,10=purple,11=blue,12=brown,13=green,14=red,15=black
  "minecraft:wool": colorVariants("wool"),
  "minecraft:carpet": colorVariants("carpet"),
  "minecraft:concrete": colorVariants("concrete"),
  "minecraft:concrete_powder": colorVariants("concrete_powder"),
  "minecraft:stained_hardened_clay": colorVariants("terracotta"),
  "minecraft:hardened_clay": ["minecraft:terracotta"],
  "minecraft:stained_glass": colorVariants("stained_glass"),
  "minecraft:stained_glass_pane": colorVariants("stained_glass_pane"),

  // Dyes use the inverse color order on Bedrock pre-flattening
  // 0=ink_sac (black), 15=bone_meal (white). We list in data-index order.
  "minecraft:dye": [
    "minecraft:ink_sac",
    "minecraft:red_dye",
    "minecraft:green_dye",
    "minecraft:cocoa_beans",
    "minecraft:lapis_lazuli",
    "minecraft:purple_dye",
    "minecraft:cyan_dye",
    "minecraft:light_gray_dye",
    "minecraft:gray_dye",
    "minecraft:pink_dye",
    "minecraft:lime_dye",
    "minecraft:yellow_dye",
    "minecraft:light_blue_dye",
    "minecraft:magenta_dye",
    "minecraft:orange_dye",
    "minecraft:bone_meal",
  ],

  // Fish — pre-flattening lumped variants under `fish` (raw) and `cooked_fish`
  "minecraft:fish": ["minecraft:cod", "minecraft:salmon", "minecraft:tropical_fish", "minecraft:pufferfish"],
  "minecraft:cooked_fish": ["minecraft:cooked_cod", "minecraft:cooked_salmon"],

  // Coral families
  "minecraft:coral_block": [
    "minecraft:tube_coral_block",
    "minecraft:brain_coral_block",
    "minecraft:bubble_coral_block",
    "minecraft:fire_coral_block",
    "minecraft:horn_coral_block",
  ],

  // Misc renamed-without-data items
  "minecraft:snow_layer": ["minecraft:snow"],
  "minecraft:snow": ["minecraft:snow_block"],
  "minecraft:slime": ["minecraft:slime_block"],
  "minecraft:melon_block": ["minecraft:melon"],
  "minecraft:reeds": ["minecraft:sugar_cane"],
  "minecraft:cobblestone_wall": ["minecraft:cobblestone_wall"],
};

function colorVariants(suffix: string): string[] {
  const COLORS = [
    "white",
    "orange",
    "magenta",
    "light_blue",
    "yellow",
    "lime",
    "pink",
    "gray",
    "light_gray",
    "cyan",
    "purple",
    "blue",
    "brown",
    "green",
    "red",
    "black",
  ];
  return COLORS.map((c) => `minecraft:${c}_${suffix}`);
}

/**
 * Map a legacy item id (optionally with a Bedrock pre-flattening data value)
 * to its modern flattened identifier. Returns the input id unchanged when
 * there is no known mapping.
 */
export function resolveLegacyItem(id: string | undefined, data?: number): string | undefined {
  if (!id) return id;

  // Normalize bare names (no namespace) to the minecraft: namespace so callers
  // can pass either form. Custom-namespaced items are never legacy-mapped.
  const lookupId = id.includes(":") ? id : "minecraft:" + id;

  const variants = LEGACY_VARIANTS[lookupId];
  if (!variants || variants.length === 0) return id;

  const index = typeof data === "number" && data >= 0 && data < variants.length ? data : 0;
  return variants[index];
}

/**
 * Convenience: returns true if `id` is a known legacy (pre-flattening) item.
 * Useful for tests and validation messages.
 */
export function isLegacyItemId(id: string | undefined): boolean {
  if (!id) return false;
  const lookupId = id.includes(":") ? id : "minecraft:" + id;
  return LEGACY_VARIANTS[lookupId] !== undefined;
}
