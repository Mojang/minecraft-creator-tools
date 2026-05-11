/**
 * generate-item-catalog.mjs — Build-time script that produces a static JSON
 * catalog mapping every vanilla Minecraft item/block ID to its sprite image,
 * display name, and category.
 *
 * Output: app/public/data/recipe-item-catalog.json
 *
 * Run from app/:
 *   node scripts/generate-item-catalog.mjs
 *
 * SPRITE RESOLUTION STRATEGY (in priority order):
 * 1. Direct match in items/ PNGs (item name === PNG filename)
 * 2. item_texture.json lookup (maps short names to texture paths)
 * 3. Spawn eggs, buckets, boats, signs, dyes (prefix/suffix transforms)
 * 4. terrain_texture.json lookup (maps block names to block textures)
 * 5. Block suffix derivation (fence/slab/stairs/wall → parent block texture)
 * 6. Color+type pattern matching (red_wool → blocks/wool_colored_red.png)
 * 7. Prefix-inverted matching (acacia_planks → blocks/planks_acacia.png)
 * 8. Item aliases (beef → beef_raw, bone_meal → dye_powder_white, etc.)
 *
 * Items resolved from blocks/ use "b:" prefix in the sprite field to
 * distinguish from items/ textures at runtime.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Paths (relative to app/) ──────────────────────────────────────────────
const ITEMS_META = "public/res/latest/van/preview/metadata/vanilladata_modules/mojang-items.json";
const ITEM_TEXTURES = "public/res/latest/van/serve/resource_pack/textures/item_texture.json";
const TERRAIN_TEXTURES = "public/res/latest/van/serve/resource_pack/textures/terrain_texture.json";
const ITEM_SPRITE_DIR = "public/res/latest/van/serve/resource_pack/textures/items";
const BLOCK_SPRITE_DIR = "public/res/latest/van/serve/resource_pack/textures/blocks";
const OUTPUT = "public/data/recipe-item-catalog.json";
const ATLAS_OUTPUT_DIR = "public/data/atlases";
const ATLAS_PNG = "public/data/atlases/item-sprites.png";
const SPRITE_SIZE = 16; // Minecraft item sprites are 16×16

// ── Categorisation ────────────────────────────────────────────────────────
const CATEGORIES = [
  [
    "Tools & Weapons",
    [
      "pickaxe",
      "axe",
      "shovel",
      "hoe",
      "sword",
      "shears",
      "fishing_rod",
      "flint_and_steel",
      "compass",
      "clock",
      "spyglass",
      "brush",
      "mace",
    ],
  ],
  [
    "Food",
    [
      "apple",
      "bread",
      "beef",
      "pork",
      "chicken",
      "mutton",
      "rabbit",
      "cod",
      "salmon",
      "potato",
      "carrot",
      "beetroot",
      "melon_slice",
      "sweet_berries",
      "cookie",
      "cake",
      "pie",
      "stew",
      "soup",
      "glow_berries",
      "dried_kelp",
      "chorus_fruit",
      "honey_bottle",
      "golden_apple",
      "tropical_fish",
      "cooked_",
      "baked_",
    ],
  ],
  [
    "Combat",
    [
      "helmet",
      "chestplate",
      "leggings",
      "boots",
      "shield",
      "bow",
      "crossbow",
      "arrow",
      "trident",
      "totem",
      "turtle_shell",
    ],
  ],
  [
    "Brewing",
    [
      "potion",
      "brewing",
      "blaze_powder",
      "blaze_rod",
      "ghast_tear",
      "magma_cream",
      "nether_wart",
      "fermented_spider_eye",
      "glistering_melon",
      "dragon_breath",
      "glass_bottle",
    ],
  ],
  [
    "Materials",
    [
      "ingot",
      "nugget",
      "diamond",
      "emerald",
      "lapis",
      "quartz",
      "amethyst",
      "copper_ingot",
      "gold_ingot",
      "iron_ingot",
      "netherite_ingot",
      "coal",
      "redstone",
      "dye",
      "leather",
      "string",
      "feather",
      "bone",
      "gunpowder",
      "slime_ball",
      "ender_pearl",
      "phantom_membrane",
      "echo_shard",
      "scute",
    ],
  ],
];

function categorise(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of CATEGORIES) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "Miscellaneous";
}

function humanify(name) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function loadJsonWithComments(path) {
  let raw = readFileSync(path, "utf-8");
  raw = raw.replace(/^\s*\/\/[^\n]*\n/gm, "");
  return JSON.parse(raw);
}

function loadPngSet(dir) {
  const set = new Set();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".png") && !f.endsWith("_mers.png")) {
        set.add(f.replace(/\.png$/, ""));
      }
    }
  }
  return set;
}

// ── Colors ────────────────────────────────────────────────────────────────
const MC_COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "silver",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
];

// light_gray uses "silver" in some texture names
const COLOR_TO_TEXTURE = {
  light_gray: "silver",
};

// ── Item aliases (item ID → known sprite base) ───────────────────────────
const ITEM_ALIASES = {
  beef: "beef_raw",
  porkchop: "pork_raw",
  chicken: "chicken_raw",
  cod: "fish_raw",
  salmon: "salmon_raw",
  rabbit: "rabbit_raw",
  cooked_beef: "beef_cooked",
  cooked_porkchop: "pork_cooked",
  cooked_chicken: "chicken_cooked",
  cooked_cod: "fish_cooked",
  cooked_salmon: "salmon_cooked",
  cooked_rabbit: "rabbit_cooked",
  cooked_mutton: "mutton_cooked",
  baked_potato: "potato_baked",
  beetroot_seeds: "seeds_beetroot",
  wheat_seeds: "seeds_wheat",
  melon_seeds: "seeds_melon",
  pumpkin_seeds: "seeds_pumpkin",
  torchflower_seeds: "torchflower_seeds",
  bone_meal: "dye_powder_white",
  book: "book_normal",
  bow: "bow_standby",
  experience_bottle: "experience_bottle",
  glass_bottle: "potion_bottle_empty",
  writable_book: "book_writable",
  written_book: "book_written",
  enchanted_book: "book_enchanted",
  map: "map_filled",
  empty_map: "map_empty",
  filled_map: "map_filled",
  fire_charge: "fireball",
  name_tag: "name_tag",
  sugar_cane: "reeds",
  wheat: "wheat",
  nether_wart: "nether_wart",
  glistering_melon_slice: "melon_speckled",
  golden_carrot: "carrot_golden",
  fermented_spider_eye: "spider_eye_fermented",
  enchanted_golden_apple: "apple_golden",
  poisonous_potato: "potato_poisonous",
  suspicious_stew: "suspicious_stew",
  turtle_scute: "scute",
  turtle_helmet: "turtle_helmet",
  trial_key: "trial_key",
  ominous_trial_key: "ominous_trial_key",
  wind_charge: "wind_charge",
  breeze_rod: "breeze_rod",
  chest_minecart: "minecart_chest",
  hopper_minecart: "minecart_hopper",
  tnt_minecart: "minecart_tnt",
  command_block_minecart: "minecart_command_block",
  clock: "clock_item",
  compass: "compass_item",
  crossbow: "crossbow_standby",
  cocoa_beans: "dye_powder_brown",
  cooked_porkchop: "porkchop_cooked",
  banner: "banner",
  // golden_ → gold_ prefix (Minecraft IDs use "golden" but sprites use "gold")
  golden_axe: "gold_axe",
  golden_pickaxe: "gold_pickaxe",
  golden_shovel: "gold_shovel",
  golden_hoe: "gold_hoe",
  golden_sword: "gold_sword",
  golden_helmet: "gold_helmet",
  golden_chestplate: "gold_chestplate",
  golden_leggings: "gold_leggings",
  golden_boots: "gold_boots",
  golden_horse_armor: "gold_horse_armor",
  golden_apple: "apple_golden",
  golden_carrot: "carrot_golden",
  enchanted_golden_apple: "apple_golden",
  // Misc items
  firework_rocket: "fireworks",
  firework_star: "fireworks_charge",
  glow_ink_sac: "dye_powder_glow",
  ink_sac: "dye_powder_black",
  dried_kelp: "dried_kelp",
  frame: "item_frame",
  glow_frame: "glow_item_frame",
  // Potions use "potion_bottle_" prefix
  potion: "potion_bottle_drinkable",
  splash_potion: "potion_bottle_splash",
  lingering_potion: "potion_bottle_lingering",
  // Food/material renames
  lapis_lazuli: "dye_powder_blue",
  melon_slice: "melon",
  mutton: "mutton_raw",
  raw_mutton: "mutton_raw",
  cooked_mutton: "mutton_cooked",
  minecart: "minecart_normal",
  totem_of_undying: "totem",
  iron_chain: "chain",
  lodestone_compass: "compass_item",
  recovery_compass: "compass_item",
  // light_gray → silver in sprite names
  light_gray_dye: "dye_powder_silver",
  // Misc blocks as items
  honey_block: "honey_bottle",
  dried_kelp_block: "dried_kelp",
  lit_pumpkin: "pumpkin_face_on",
  // Nautilus armor/spears (new items, no sprites — use closest)
  copper_nautilus_armor: "nautilus",
  iron_nautilus_armor: "nautilus",
  golden_nautilus_armor: "nautilus",
  diamond_nautilus_armor: "nautilus",
  netherite_nautilus_armor: "nautilus",
  copper_spear: "trident",
  iron_spear: "trident",
  golden_spear: "trident",
  diamond_spear: "trident",
  netherite_spear: "trident",
  // Other
  spider_eye: "spider_eye",
  slime_ball: "slimeball",
  redstone: "redstone_dust",
  porkchop: "porkchop_raw",
  popped_chorus_fruit: "chorus_fruit_popped",
  tropical_fish: "fish_clownfish_raw",
  tropical_fish_bucket: "bucket_tropical",
  turtle_scute: "armadillo_scute",
  shield: "arrow", // no shield sprite, use arrow as combat placeholder
  oak_sign: "sign",
  banner: "banner_pattern",
  candle: "torch_on",
  // Waxed copper variants
  waxed_copper_door: "copper_door",
  waxed_copper_chain: "copper_chain",
  waxed_cut_copper_slab: "cut_copper",
  waxed_cut_copper_stairs: "cut_copper",
  waxed_exposed_copper_chain: "copper_chain",
  waxed_exposed_copper_chest: "exposed_copper",
  // Stripped nether stems
  stripped_crimson_stem: "crimson_nylium_side",
  stripped_warped_stem: "warped_nylium_side",
  stripped_crimson_hyphae: "crimson_nylium_side",
  stripped_warped_hyphae: "warped_nylium_side",
  // wooden_ → wood_ prefix
  wooden_axe: "wood_axe",
  wooden_pickaxe: "wood_pickaxe",
  wooden_shovel: "wood_shovel",
  wooden_hoe: "wood_hoe",
  wooden_sword: "wood_sword",
  wooden_spear: "trident",
  stone_spear: "trident",
};

// ── Block aliases (block ID → known block sprite base) ────────────────────
const BLOCK_ALIASES = {
  terracotta: "hardened_clay",
  smooth_stone: "stone_slab_top",
  rail: "rail_normal",
  activator_rail: "rail_activator",
  detector_rail: "rail_detector",
  powered_rail: "rail_golden",
  furnace: "furnace_front_off",
  blast_furnace: "blast_furnace_front_off",
  smoker: "smoker_front_off",
  piston: "piston_side",
  sticky_piston: "piston_side",
  torch: "torch_on",
  redstone_torch: "redstone_torch_on",
  soul_torch: "soul_torch",
  crafting_table: "crafting_table_front",
  cartography_table: "cartography_table_side3",
  smithing_table: "smithing_table_front",
  fletching_table: "fletching_table_front",
  loom: "loom_front",
  barrel: "barrel_side",
  bell: "bell",
  composter: "composter_side",
  grindstone: "grindstone_side",
  lectern: "lectern_front",
  stonecutter: "stonecutter_side",
  enchanting_table: "enchanting_table_side",
  brewing_stand: "brewing_stand",
  cauldron: "cauldron_side",
  hopper: "hopper_outside",
  dispenser: "dispenser_front_horizontal",
  dropper: "dropper_front_horizontal",
  observer: "observer_front",
  daylight_detector: "daylight_detector_top",
  jukebox: "jukebox_side",
  note_block: "noteblock",
  tnt: "tnt_side",
  respawn_anchor: "respawn_anchor_top_off",
  lodestone: "lodestone_top",
  target: "target_side",
  beehive: "beehive_front",
  bee_nest: "bee_nest_front",
  campfire: "campfire_log_lit",
  soul_campfire: "soul_campfire_log_lit",
  lantern: "lantern",
  soul_lantern: "soul_lantern",
  chain: "chain1",
  ladder: "ladder",
  scaffolding: "scaffolding_side",
  conduit: "conduit",
  end_portal_frame: "endframe_side",
  end_rod: "end_rod",
  dragon_egg: "dragon_egg",
  sponge: "sponge",
  wet_sponge: "sponge_wet",
  hay_block: "hay_block_side",
  melon_block: "melon_side",
  pumpkin: "pumpkin_side",
  carved_pumpkin: "pumpkin_face_off",
  jack_o_lantern: "pumpkin_face_on",
  sea_lantern: "sea_lantern",
  glowstone: "glowstone",
  shroomlight: "shroomlight",
  froglight: "ochre_froglight_side",
  ochre_froglight: "ochre_froglight_side",
  verdant_froglight: "verdant_froglight_side",
  pearlescent_froglight: "pearlescent_froglight_side",
  bookshelf: "bookshelf",
  chiseled_bookshelf: "chiseled_bookshelf_empty",
  clay: "clay",
  brick_block: "brick",
  nether_brick: "nether_brick",
  red_nether_brick: "red_nether_brick",
  end_stone: "end_stone",
  end_stone_bricks: "end_bricks",
  end_bricks: "end_bricks",
  prismarine: "prismarine_rough",
  dark_prismarine: "prismarine_dark",
  prismarine_bricks: "prismarine_bricks",
  purpur_block: "purpur_block_side",
  purpur_pillar: "purpur_pillar",
  nether_gold_ore: "nether_gold_ore",
  ancient_debris: "ancient_debris_side",
  sculk: "sculk",
  sculk_sensor: "sculk_sensor_bottom",
  sculk_catalyst: "sculk_catalyst_side",
  sculk_shrieker: "sculk_shrieker_side",
  calibrated_sculk_sensor: "sculk_sensor_bottom",
  budding_amethyst: "budding_amethyst",
  tuff: "tuff",
  calcite: "calcite",
  dripstone_block: "dripstone_block",
  pointed_dripstone: "pointed_dripstone_up_base",
  mangrove_roots: "mangrove_roots_side",
  muddy_mangrove_roots: "muddy_mangrove_roots_side",
  mud: "mud",
  packed_mud: "packed_mud",
  mud_bricks: "mud_bricks",
  moss_block: "moss_block",
  moss_carpet: "moss_block",
  big_dripleaf: "big_dripleaf_top1",
  small_dripleaf: "small_dripleaf_top",
  hanging_roots: "hanging_roots",
  glow_lichen: "glow_lichen",
  spore_blossom: "spore_blossom",
  soul_sand: "soul_sand",
  soul_soil: "soul_soil",
  basalt: "basalt_side",
  polished_basalt: "polished_basalt_side",
  smooth_basalt: "smooth_basalt",
  blackstone: "blackstone",
  gilded_blackstone: "gilded_blackstone",
  polished_blackstone: "polished_blackstone",
  polished_blackstone_bricks: "polished_blackstone_bricks",
  chiseled_polished_blackstone: "chiseled_polished_blackstone",
  crying_obsidian: "crying_obsidian",
  obsidian: "obsidian",
  netherrack: "netherrack",
  magma: "magma",
  nether_wart_block: "nether_wart_block",
  warped_wart_block: "warped_wart_block",
  crimson_nylium: "crimson_nylium_side",
  warped_nylium: "warped_nylium_side",
  mycelium: "mycelium_side",
  podzol: "dirt_podzol_side",
  grass_block: "grass_carried",
  dirt: "dirt",
  coarse_dirt: "coarse_dirt",
  rooted_dirt: "rooted_dirt",
  farmland: "farmland_dry",
  dirt_path: "grass_path_side",
  sand: "sand",
  sandstone: "sandstone_normal",
  red_sand: "red_sand",
  red_sandstone: "red_sandstone_normal",
  gravel: "gravel",
  ice: "ice",
  blue_ice: "blue_ice",
  packed_ice: "ice_packed",
  snow_block: "snow",
  snow: "snow",
  powder_snow: "powder_snow",
  cactus: "cactus_side",
  sugar_cane: "reeds",
  bamboo: "bamboo_stem",
  bamboo_block: "bamboo_block",
  kelp: "kelp_top",
  vine: "vine",
  weeping_vines: "weeping_vines_bottom",
  twisting_vines: "twisting_vines_bottom",
  cave_vines: "cave_vines_head_berries",
  lily_pad: "waterlily",
  dead_bush: "deadbush",
  grass: "tallgrass",
  short_grass: "tallgrass",
  tall_grass: "double_plant_grass_top",
  fern: "fern",
  large_fern: "double_plant_fern_top",
  sunflower: "double_plant_sunflower_front",
  lilac: "double_plant_syringa_top",
  rose_bush: "double_plant_rose_top",
  peony: "double_plant_paeonia_top",
  pitcher_plant: "pitcher_crop_top_stage_4",
  allium: "flower_allium",
  azure_bluet: "flower_houstonia",
  blue_orchid: "flower_blue_orchid",
  cornflower: "flower_cornflower",
  lily_of_the_valley: "flower_lily_of_the_valley",
  oxeye_daisy: "flower_oxeye_daisy",
  poppy: "flower_rose",
  dandelion: "flower_dandelion",
  tulip: "flower_tulip_red",
  orange_tulip: "flower_tulip_orange",
  pink_tulip: "flower_tulip_pink",
  red_tulip: "flower_tulip_red",
  white_tulip: "flower_tulip_white",
  wither_rose: "flower_wither_rose",
  torchflower: "torchflower",
  cactus_flower: "cactus_flower",
  open_eyeblossom: "open_eyeblossom",
  closed_eyeblossom: "closed_eyeblossom",
  cobweb: "web",
  chest: "chest",
  ender_chest: "ender_chest",
  trapped_chest: "chest",
  tripwire_hook: "trip_wire_source",
  lever: "lever",
  redstone_lamp: "redstone_lamp_off",
  sea_pickle: "sea_pickle",
  turtle_egg: "turtle_egg_not_cracked",
  flower_pot: "flower_pot",
  armor_stand: "armor_stand",
  item_frame: "item_frame",
  glow_item_frame: "glow_item_frame",
  painting: "painting",
  decorated_pot: "decorated_pot_base",
  structure_block: "structure_block",
  structure_void: "structure_void",
  barrier: "barrier",
  allow: "allow",
  deny: "deny",
  border_block: "border",
  light_block: "light_block_0",
  jigsaw: "jigsaw_front",
  candle: "candle_white",
  tinted_glass: "tinted_glass",
  trial_spawner: "trial_spawner_side_inactive",
  vault: "vault_front_off",
  heavy_core: "heavy_core",
  creaking_heart: "creaking_heart_active",
  resin_block: "resin_block",
  resin_bricks: "resin_bricks",
  resin_clump: "resin_clump",
  pale_moss_block: "pale_moss_block",
  pale_hanging_moss: "pale_hanging_moss",
  pale_oak_leaves: "pale_oak_leaves",
  // Dark oak uses "big_oak" in texture names
  dark_oak_log: "log_big_oak",
  dark_oak_wood: "log_big_oak",
  dark_oak_leaves: "leaves_big_oak",
  dark_oak_planks: "planks_big_oak",
  stripped_dark_oak_log: "stripped_dark_oak_log",
  stripped_dark_oak_wood: "stripped_dark_oak_log",
  // Crimson/warped nether wood
  crimson_planks: "crimson_shelf",
  warped_planks: "warped_shelf",
  crimson_stem: "crimson_nylium_side",
  warped_stem: "warped_nylium_side",
  crimson_hyphae: "crimson_nylium_side",
  warped_hyphae: "warped_nylium_side",
  // Deepslate (only reinforced_deepslate textures exist as PNGs)
  deepslate: "reinforced_deepslate_side",
  cobbled_deepslate: "reinforced_deepslate_side",
  deepslate_bricks: "reinforced_deepslate_side",
  deepslate_tiles: "reinforced_deepslate_side",
  polished_deepslate: "reinforced_deepslate_side",
  chiseled_deepslate: "reinforced_deepslate_side",
  cracked_deepslate_bricks: "reinforced_deepslate_side",
  cracked_deepslate_tiles: "reinforced_deepslate_side",
  // Deepslate ores (use reinforced_deepslate as placeholder)
  deepslate_coal_ore: "reinforced_deepslate_side",
  deepslate_copper_ore: "reinforced_deepslate_side",
  deepslate_diamond_ore: "reinforced_deepslate_side",
  deepslate_emerald_ore: "reinforced_deepslate_side",
  deepslate_gold_ore: "reinforced_deepslate_side",
  deepslate_iron_ore: "reinforced_deepslate_side",
  deepslate_lapis_ore: "reinforced_deepslate_side",
  deepslate_redstone_ore: "reinforced_deepslate_side",
  // Copper
  copper_block: "copper_block",
  exposed_copper: "exposed_copper",
  weathered_copper: "weathered_copper",
  oxidized_copper: "oxidized_copper",
  waxed_copper: "copper_block",
  waxed_exposed_copper: "exposed_copper",
  waxed_weathered_copper: "weathered_copper",
  waxed_oxidized_copper: "oxidized_copper",
  cut_copper: "cut_copper",
  exposed_cut_copper: "exposed_cut_copper",
  weathered_cut_copper: "weathered_cut_copper",
  oxidized_cut_copper: "oxidized_cut_copper",
  // Tuff
  tuff_bricks: "tuff_bricks",
  polished_tuff: "polished_tuff",
  chiseled_tuff_bricks: "chiseled_tuff_bricks",
  chiseled_tuff: "chiseled_tuff",
  // Cocoa
  cocoa: "cocoa_stage_2",
  // Candle (uncolored)
  candle: "candle_white",
  // Brown mushroom block
  brown_mushroom_block: "mushroom_block_skin_brown",
  red_mushroom_block: "mushroom_block_skin_red",
  mushroom_stem: "mushroom_block_skin_stem",
  // Heads (most don't have standalone PNGs - use mob textures or placeholders)
  creeper_head: "creeper",
  skeleton_skull: "bone",
  wither_skeleton_skull: "bone",
  zombie_head: "rotten_flesh",
  dragon_head: "dragons_breath",
  piglin_head: "gold_ingot",
  player_head: "armor_stand",
  // Misc blocks
  end_stone_bricks: "end_bricks",
  end_brick_stairs: "end_bricks",
  nether_bricks: "nether_brick",
  red_nether_bricks: "red_nether_brick",
  prismarine_bricks: "prismarine_bricks",
  normal_stone_stairs: "stone",
  petrified_oak_slab: "planks_oak",
  heavy_weighted_pressure_plate: "gold_block",
  light_weighted_pressure_plate: "iron_block",
  mud_bricks: "mud_bricks",
  mud_brick_slab: "mud_bricks",
  mud_brick_stairs: "mud_bricks",
  mud_brick_wall: "mud_bricks",
  fence_gate: "planks_oak",
  allow: "allow",
  deny: "deny",
  fletching_table: "fletching_table_side",
  crimson_trapdoor: "crimson_shelf",
  warped_trapdoor: "warped_shelf",
  dark_oak_sign: "planks_big_oak",
  infested_deepslate: "reinforced_deepslate_side",
  // Copper variants with states
  copper_chest: "copper_block",
  exposed_copper_chest: "exposed_copper",
  oxidized_copper_chest: "oxidized_copper",
  weathered_copper_chest: "weathered_copper",
  waxed_copper_chest: "copper_block",
  // Deepslate brick/tile variants
  deepslate_brick_slab: "reinforced_deepslate_side",
  deepslate_brick_stairs: "reinforced_deepslate_side",
  deepslate_brick_wall: "reinforced_deepslate_side",
  deepslate_tile_slab: "reinforced_deepslate_side",
  deepslate_tile_stairs: "reinforced_deepslate_side",
  deepslate_tile_wall: "reinforced_deepslate_side",
  // Newer items that may not have textures
  dried_ghast: "ghast_tear",
  copper_golem_statue: "copper_block",
  exposed_copper_golem_statue: "exposed_copper",
  oxidized_copper_golem_statue: "oxidized_copper",
  weathered_copper_golem_statue: "weathered_copper",
  waxed_copper_golem_statue: "copper_block",
  // More block aliases
  quartz_pillar: "quartz_block_chiseled",
  quartz_slab: "quartz_block_side",
  quartz_stairs: "quartz_block_side",
  stonecutter_block: "stonecutter_side",
  purpur_stairs: "purpur_block_side",
  stone_brick_stairs: "stonebrick",
  polished_blackstone_brick_slab: "polished_blackstone_bricks",
  polished_blackstone_brick_stairs: "polished_blackstone_bricks",
  polished_blackstone_brick_wall: "polished_blackstone_bricks",
  snow_layer: "snow",
  small_dripleaf_block: "small_dripleaf_top",
  undyed_shulker_box: "shulker_top_undyed",
  pale_moss_carpet: "pale_moss_block",
  tuff_brick_slab: "tuff_bricks",
  tuff_brick_stairs: "tuff_bricks",
  tuff_brick_wall: "tuff_bricks",
  resin_brick_slab: "resin_bricks",
  resin_brick_stairs: "resin_bricks",
  resin_brick_wall: "resin_bricks",
  // Purpur
  purpur_stairs: "purpur_pillar",
  // Waxed copper doors/chains/lightning rods (use exposed_ or base copper)
  waxed_exposed_copper_door: "exposed_copper_door_top",
  waxed_exposed_copper_golem_statue: "exposed_copper",
  waxed_exposed_cut_copper_slab: "exposed_cut_copper",
  waxed_exposed_cut_copper_stairs: "exposed_cut_copper",
  waxed_exposed_lightning_rod: "lightning_rod",
  waxed_lightning_rod: "lightning_rod",
  waxed_oxidized_copper_chain: "copper_chain",
  waxed_oxidized_copper_chest: "oxidized_copper",
  waxed_oxidized_copper_door: "oxidized_copper",
  waxed_oxidized_copper_golem_statue: "oxidized_copper",
  waxed_oxidized_cut_copper_slab: "oxidized_cut_copper",
  waxed_oxidized_cut_copper_stairs: "oxidized_cut_copper",
  waxed_oxidized_lightning_rod: "lightning_rod",
  waxed_weathered_copper_chain: "copper_chain",
  waxed_weathered_copper_chest: "weathered_copper",
  waxed_weathered_copper_door: "weathered_copper",
  waxed_weathered_copper_golem_statue: "weathered_copper",
  waxed_weathered_cut_copper_slab: "weathered_cut_copper",
  waxed_weathered_cut_copper_stairs: "weathered_cut_copper",
  waxed_weathered_lightning_rod: "lightning_rod",
  // Wooden button/pressure plate
  wooden_button: "planks_oak",
  wooden_pressure_plate: "planks_oak",
  // Allow/deny (education edition - no textures)
  allow: "structure_block",
  deny: "structure_block",
  // Fletching table
  fletching_table: "planks_birch",
  // Heads (use closest available item sprite)
  creeper_head: "gunpowder",
  dragon_head: "dragons_breath",
  // Resin/cinnabar/sulfur (newer blocks - may not have textures yet)
  resin_bricks: "resin_bricks",
  resin_block: "resin_block",
};

// ── Main ──────────────────────────────────────────────────────────────────

const itemSprites = loadPngSet(ITEM_SPRITE_DIR);
const blockSprites = loadPngSet(BLOCK_SPRITE_DIR);
console.log(`Item sprites: ${itemSprites.size}, Block sprites: ${blockSprites.size}`);

// item_texture.json: shortName → first item texture basename
const itemTexMap = new Map();
if (existsSync(ITEM_TEXTURES)) {
  const texJson = loadJsonWithComments(ITEM_TEXTURES);
  for (const [shortName, entry] of Object.entries(texJson.texture_data)) {
    let tex = entry.textures;
    const arr = Array.isArray(tex) ? tex : [tex];
    if (typeof arr[0] === "string") {
      itemTexMap.set(shortName, arr[0].split("/").pop());
    }
  }
}
console.log(`item_texture.json: ${itemTexMap.size} entries`);

// terrain_texture.json: terrainKey → first block PNG basename
const terrainMap = new Map();
if (existsSync(TERRAIN_TEXTURES)) {
  const terrain = loadJsonWithComments(TERRAIN_TEXTURES);
  for (const [key, entry] of Object.entries(terrain.texture_data)) {
    let t = entry.textures;
    if (!t) continue;
    let path = null;
    if (typeof t === "string") path = t;
    else if (t.path) path = t.path;
    else if (Array.isArray(t)) {
      const first = t[0];
      if (typeof first === "string") path = first;
      else if (first?.path) path = first.path;
    } else if (typeof t === "object") {
      path = t.up || t.side || t.north || t.south || t.east || t.west;
      if (typeof path === "object") path = path?.path;
    }
    if (path) terrainMap.set(key, path.split("/").pop());
  }
}
console.log(`terrain_texture.json: ${terrainMap.size} entries`);

let items = [];
if (existsSync(ITEMS_META)) {
  const meta = JSON.parse(readFileSync(ITEMS_META, "utf-8"));
  items = meta.data_items || [];
}
console.log(`mojang-items.json: ${items.length} items`);

// ── Sprite resolution ─────────────────────────────────────────────────────
const VARIANT_SUFFIXES = ["_slab", "_stairs", "_wall", "_fence", "_fence_gate", "_button", "_pressure_plate"];

function resolveSprite(name) {
  // --- ITEM SPRITES ---
  if (itemSprites.has(name)) return { file: name + ".png", type: "i" };

  // item_texture.json
  if (itemTexMap.has(name)) {
    const base = itemTexMap.get(name);
    if (itemSprites.has(base)) return { file: base + ".png", type: "i" };
  }

  // Item aliases
  if (ITEM_ALIASES[name]) {
    const a = ITEM_ALIASES[name];
    if (itemSprites.has(a)) return { file: a + ".png", type: "i" };
    if (blockSprites.has(a)) return { file: a + ".png", type: "b" };
  }

  // Spawn eggs: "bat_spawn_egg" → "egg_bat"
  if (name.endsWith("_spawn_egg")) {
    const mob = name.replace(/_spawn_egg$/, "");
    if (itemSprites.has("egg_" + mob)) return { file: "egg_" + mob + ".png", type: "i" };
    // Generic egg fallback
    if (itemSprites.has("egg_null")) return { file: "egg_null.png", type: "i" };
  }

  // Buckets: "axolotl_bucket" → "bucket_axolotl"
  if (name.endsWith("_bucket")) {
    const c = name.replace(/_bucket$/, "");
    if (itemSprites.has("bucket_" + c)) return { file: "bucket_" + c + ".png", type: "i" };
    // Generic bucket fallback for variants without a dedicated sprite.
    if (itemSprites.has("bucket")) return { file: "bucket.png", type: "i" };
  }

  // Boats: "acacia_boat" → "boat_acacia"
  if (name.endsWith("_boat") && !name.includes("chest")) {
    const w = name.replace(/_boat$/, "");
    if (itemSprites.has("boat_" + w)) return { file: "boat_" + w + ".png", type: "i" };
    if (itemSprites.has(w + "_boat")) return { file: w + "_boat.png", type: "i" };
  }

  // Signs: "acacia_sign" → "sign_acacia"
  if (name.endsWith("_sign") && !name.includes("hanging")) {
    const w = name.replace(/_sign$/, "");
    if (itemSprites.has("sign_" + w)) return { file: "sign_" + w + ".png", type: "i" };
    if (itemSprites.has(w + "_sign")) return { file: w + "_sign.png", type: "i" };
  }

  // Dye: "red_dye" → "dye_powder_red"
  if (name.endsWith("_dye")) {
    const color = name.replace(/_dye$/, "");
    if (itemSprites.has("dye_powder_" + color)) return { file: "dye_powder_" + color + ".png", type: "i" };
  }

  // Banner patterns: "*_banner_pattern" → "banner_pattern"
  if (name.endsWith("_banner_pattern") && itemSprites.has("banner_pattern"))
    return { file: "banner_pattern.png", type: "i" };

  // Music discs: "music_disc_13" → "record_13"
  if (name.startsWith("music_disc_")) {
    const d = name.replace(/^music_disc_/, "");
    if (itemSprites.has("record_" + d)) return { file: "record_" + d + ".png", type: "i" };
  }

  // --- BLOCK SPRITES ---

  // Block aliases (hand-curated)
  if (BLOCK_ALIASES[name]) {
    const a = BLOCK_ALIASES[name];
    if (blockSprites.has(a)) return { file: a + ".png", type: "b" };
    if (itemSprites.has(a)) return { file: a + ".png", type: "i" };
  }

  // Direct block match
  if (blockSprites.has(name)) return { file: name + ".png", type: "b" };

  // terrain_texture.json
  if (terrainMap.has(name)) {
    const base = terrainMap.get(name);
    if (blockSprites.has(base)) return { file: base + ".png", type: "b" };
  }

  // Doors in blocks: "acacia_door" → "door_acacia_upper"
  if (name.endsWith("_door")) {
    const m = name.replace(/_door$/, "");
    for (const s of ["door_" + m + "_upper", m + "_door_top", "door_" + m]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Trapdoors: "acacia_trapdoor" → "acacia_trapdoor" or "trapdoor_acacia"
  if (name.endsWith("_trapdoor")) {
    const m = name.replace(/_trapdoor$/, "");
    if (blockSprites.has(m + "_trapdoor")) return { file: m + "_trapdoor.png", type: "b" };
    if (blockSprites.has("trapdoor_" + m)) return { file: "trapdoor_" + m + ".png", type: "b" };
    // Wood trapdoors → planks texture
    if (blockSprites.has("planks_" + m)) return { file: "planks_" + m + ".png", type: "b" };
  }

  // Block variant suffixes → parent block texture
  for (const suffix of VARIANT_SUFFIXES) {
    if (name.endsWith(suffix)) {
      const base = name.slice(0, -suffix.length);
      const r = resolveBlockBase(base);
      if (r) return r;
      break;
    }
  }

  // Color+type blocks
  for (const color of MC_COLORS) {
    if (!name.startsWith(color + "_")) continue;
    const type = name.substring(color.length + 1);
    const r = resolveColorBlock(color, type, name);
    if (r) return r;
  }

  // Logs: "acacia_log" → "log_acacia"
  if (name.endsWith("_log")) {
    const w = name.replace(/_log$/, "");
    for (const s of ["log_" + w, w + "_log_side", w + "_log"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }
  // Stripped logs
  if (name.startsWith("stripped_") && name.endsWith("_log")) {
    if (blockSprites.has(name)) return { file: name + ".png", type: "b" };
    const w = name.replace(/^stripped_/, "").replace(/_log$/, "");
    for (const s of ["stripped_" + w + "_log", "stripped_" + w + "_log_side"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Wood/bark: "acacia_wood" → "log_acacia"
  if (name.endsWith("_wood")) {
    const w = name.replace(/_wood$/, "");
    for (const s of ["log_" + w, w + "_log_side"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }
  // Stripped wood
  if (name.startsWith("stripped_") && name.endsWith("_wood")) {
    const w = name.replace(/^stripped_/, "").replace(/_wood$/, "");
    for (const s of ["stripped_" + w + "_log", "stripped_" + w + "_log_side"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Hyphae: "warped_hyphae" → "warped_stem_side"
  if (name.endsWith("_hyphae")) {
    const t = name.replace(/_hyphae$/, "");
    for (const s of [t + "_stem_side", t + "_stem"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }
  if (name.startsWith("stripped_") && name.endsWith("_hyphae")) {
    const t = name.replace(/^stripped_/, "").replace(/_hyphae$/, "");
    for (const s of ["stripped_" + t + "_stem_side", "stripped_" + t + "_stem"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Stems
  if (name.endsWith("_stem") && !name.includes("mushroom")) {
    const t = name.replace(/_stem$/, "");
    for (const s of [t + "_stem_side", t + "_stem"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Leaves
  if (name.endsWith("_leaves")) {
    const t = name.replace(/_leaves$/, "");
    for (const s of ["leaves_" + t, t + "_leaves", "leaves_" + t + "_carried"]) {
      if (blockSprites.has(s)) return { file: s + ".png", type: "b" };
    }
  }

  // Saplings
  if (name.endsWith("_sapling")) {
    const t = name.replace(/_sapling$/, "");
    if (blockSprites.has("sapling_" + t)) return { file: "sapling_" + t + ".png", type: "b" };
  }

  // Ores
  if (name.endsWith("_ore")) {
    if (blockSprites.has(name)) return { file: name + ".png", type: "b" };
  }

  // Flowers: "allium" → "flower_allium"
  if (blockSprites.has("flower_" + name)) return { file: "flower_" + name + ".png", type: "b" };

  // Prefix-inverted: "acacia_planks" → "planks_acacia"
  const parts = name.split("_");
  if (parts.length >= 2) {
    const inv = parts.slice(1).join("_") + "_" + parts[0];
    if (blockSprites.has(inv)) return { file: inv + ".png", type: "b" };
    if (parts.length === 2) {
      const sw = parts[1] + "_" + parts[0];
      if (blockSprites.has(sw)) return { file: sw + ".png", type: "b" };
    }
  }

  // _side/_front/_top suffix probing
  for (const sfx of ["_side", "_front", "_top", "_front_off", "_bottom"]) {
    if (blockSprites.has(name + sfx)) return { file: name + sfx + ".png", type: "b" };
  }

  // _block suffix strip: "bone_block" → "bone_block_side"
  if (name.endsWith("_block")) {
    const base = name.replace(/_block$/, "");
    if (blockSprites.has(base)) return { file: base + ".png", type: "b" };
    for (const sfx of ["_block_side", "_block_top", "_block"]) {
      if (blockSprites.has(base + sfx)) return { file: base + sfx + ".png", type: "b" };
    }
  }

  // Coral
  if (name.includes("coral")) {
    const types = { tube: "blue", brain: "pink", bubble: "purple", fire: "red", horn: "yellow" };
    for (const [cn, cc] of Object.entries(types)) {
      if (name.includes(cn)) {
        const dead = name.includes("dead") ? "_dead" : "";
        const fan = name.includes("fan") ? "fan_" : "";
        const t = "coral_" + fan + cc + dead;
        if (blockSprites.has(t)) return { file: t + ".png", type: "b" };
      }
    }
  }

  // Mushrooms
  if (name === "brown_mushroom" && blockSprites.has("mushroom_brown")) return { file: "mushroom_brown.png", type: "b" };
  if (name === "red_mushroom" && blockSprites.has("mushroom_red")) return { file: "mushroom_red.png", type: "b" };

  // Anvil
  if (name.includes("anvil") && blockSprites.has("anvil_base")) return { file: "anvil_base.png", type: "b" };

  // Copper variants (try without waxed_)
  if (name.includes("copper")) {
    const uw = name.replace(/^waxed_/, "");
    if (blockSprites.has(uw)) return { file: uw + ".png", type: "b" };
    if (blockSprites.has(name)) return { file: name + ".png", type: "b" };
  }

  // Deepslate
  if (name.startsWith("deepslate")) {
    if (blockSprites.has(name)) return { file: name + ".png", type: "b" };
    if (blockSprites.has(name + "_top")) return { file: name + "_top.png", type: "b" };
  }

  return null;
}

function resolveBlockBase(base) {
  if (blockSprites.has(base)) return { file: base + ".png", type: "b" };
  if (terrainMap.has(base)) {
    const t = terrainMap.get(base);
    if (blockSprites.has(t)) return { file: t + ".png", type: "b" };
  }
  if (BLOCK_ALIASES[base]) {
    const a = BLOCK_ALIASES[base];
    if (blockSprites.has(a)) return { file: a + ".png", type: "b" };
  }
  if (blockSprites.has("planks_" + base)) return { file: "planks_" + base + ".png", type: "b" };
  if (blockSprites.has("stone_" + base)) return { file: "stone_" + base + ".png", type: "b" };
  // Wood type planks: "cherry" → "cherry_planks", "mangrove" → "mangrove_planks"
  if (blockSprites.has(base + "_planks")) return { file: base + "_planks.png", type: "b" };
  if (blockSprites.has(base + "_shelf")) return { file: base + "_shelf.png", type: "b" };
  // Nether wood special: "crimson" → "crimson_shelf"
  if (blockSprites.has(base + "_nylium_side")) return { file: base + "_nylium_side.png", type: "b" };
  // dark_oak → planks_big_oak
  if (base === "dark_oak" && blockSprites.has("planks_big_oak")) return { file: "planks_big_oak.png", type: "b" };
  // Prefix inversion
  const p = base.split("_");
  if (p.length === 2) {
    const sw = p[1] + "_" + p[0];
    if (blockSprites.has(sw)) return { file: sw + ".png", type: "b" };
  }
  // Color handling
  for (const color of MC_COLORS) {
    if (base.startsWith(color + "_")) {
      const type = base.substring(color.length + 1);
      const r = resolveColorBlock(color, type, base);
      if (r) return r;
    }
  }
  return null;
}

function resolveColorBlock(color, type, fullName) {
  const texColor = COLOR_TO_TEXTURE[color] || color;
  // Map of type → block sprite patterns (try texColor alias too)
  const tries = [color];
  if (texColor !== color) tries.push(texColor);

  for (const c of tries) {
    const patterns = [
      [type === "wool", "wool_colored_" + c],
      [type === "concrete", "concrete_" + c],
      [type === "concrete_powder", "concrete_powder_" + c],
      [type === "stained_glass" || type === "stained_glass_pane", "glass_" + c],
      [type === "glazed_terracotta", "glazed_terracotta_" + c],
      [type === "shulker_box", "shulker_top_" + c],
      [type === "carpet", "wool_colored_" + c],
      [type === "terracotta", "hardened_clay_stained_" + c],
      [type === "candle", c + "_candle"],
    ];
    for (const [cond, sprite] of patterns) {
      if (cond && sprite && blockSprites.has(sprite)) return { file: sprite + ".png", type: "b" };
    }
  }

  // Candles: no candle textures exist as block PNGs — use item torch as visual
  if (type === "candle") {
    if (blockSprites.has("torch_on")) return { file: "torch_on.png", type: "b" };
  }

  // Harness: use leather as placeholder
  if (type === "harness" && itemSprites.has("leather")) return { file: "leather.png", type: "i" };

  // Beds in items
  if (type === "bed" && itemSprites.has("bed_" + color)) return { file: "bed_" + color + ".png", type: "i" };

  // Banner
  if (type === "banner" && itemSprites.has("banner")) return { file: "banner.png", type: "i" };

  // Bundle
  if (type === "bundle") {
    if (itemSprites.has(color + "_bundle")) return { file: color + "_bundle.png", type: "i" };
    if (itemSprites.has("bundle")) return { file: "bundle.png", type: "i" };
  }

  // Colored variant with suffix (e.g., red_concrete_slab)
  for (const suffix of VARIANT_SUFFIXES) {
    if (type.endsWith(suffix.substring(1))) {
      const parentType = type.slice(0, -(suffix.length - 1)).replace(/_$/, "");
      const parentName = color + "_" + parentType;
      const r = resolveColorBlock(color, parentType, parentName);
      if (r) return r;
    }
  }

  return null;
}

// ── Build catalog ─────────────────────────────────────────────────────────
const catalog = [];
const seenIds = new Set();
let resolvedCount = 0;
const unresolved = [];

for (const item of items) {
  const fullId = item.name || item.command_name;
  if (!fullId || seenIds.has(fullId)) continue;
  seenIds.add(fullId);

  const shortName = fullId.replace(/^minecraft:/, "");
  const displayName = humanify(shortName);
  let category = categorise(shortName);

  const resolved = resolveSprite(shortName);
  let sprite = null;
  if (resolved) {
    sprite = (resolved.type === "b" ? "b:" : "") + resolved.file;
    resolvedCount++;
  } else {
    unresolved.push(shortName);
  }

  // Promote items whose sprite came from blocks/ into a "Blocks" category
  // (instead of dumping them all into Miscellaneous). Keep them in their
  // explicit category if categorise() already matched a keyword.
  if (category === "Miscellaneous" && resolved?.type === "b") {
    category = "Blocks";
  }

  catalog.push({ id: fullId, n: displayName, c: category, s: sprite });
}

catalog.sort((a, b) => a.n.localeCompare(b.n));

// ── Assign atlas positions ────────────────────────────────────────────────
// Only items with resolved sprites get a position in the atlas.
const atlasItems = catalog.filter((item) => item.s !== null);
const cols = Math.ceil(Math.sqrt(atlasItems.length));
const rows = Math.ceil(atlasItems.length / cols);

for (let i = 0; i < atlasItems.length; i++) {
  atlasItems[i].ax = (i % cols) * SPRITE_SIZE; // atlas x pixel
  atlasItems[i].ay = Math.floor(i / cols) * SPRITE_SIZE; // atlas y pixel
}

// NOTE: do not include any time-varying field (e.g. a `generated` date) here —
// the catalog is checked into source control, and a volatile field would cause
// it to show as modified after every dev-env build even when inputs are unchanged.
const output = {
  version: 3,
  atlas: { cols, rows, spriteSize: SPRITE_SIZE, file: "atlases/item-sprites.png" },
  items: catalog,
};
writeFileSync(OUTPUT, JSON.stringify(output));

const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
const pct = ((resolvedCount / catalog.length) * 100).toFixed(1);
console.log(`\nGenerated ${OUTPUT}`);
console.log(`  ${catalog.length} items, ${resolvedCount} with sprites (${pct}%)`);
console.log(`  File size: ${sizeKB} KB`);
console.log(`  Atlas: ${cols}×${rows} grid (${cols * SPRITE_SIZE}×${rows * SPRITE_SIZE}px)`);
console.log(`  Unresolved: ${unresolved.length}`);
if (unresolved.length > 0) {
  console.log(`  Missing:`, unresolved.slice(0, 80).join(", "));
}

// ── Generate sprite atlas PNG ─────────────────────────────────────────────
async function generateAtlas() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("\n⚠ sharp not installed — skipping atlas PNG generation.");
    console.log("  Run: npm install --save-dev sharp");
    return;
  }

  if (!existsSync(ATLAS_OUTPUT_DIR)) {
    mkdirSync(ATLAS_OUTPUT_DIR, { recursive: true });
  }

  const atlasWidth = cols * SPRITE_SIZE;
  const atlasHeight = rows * SPRITE_SIZE;

  // Build composite operations — one per sprite
  const composites = [];
  let skipped = 0;

  for (const item of atlasItems) {
    const spriteFile = item.s;
    const isBlock = spriteFile.startsWith("b:");
    const filename = isBlock ? spriteFile.substring(2) : spriteFile;
    const dir = isBlock ? BLOCK_SPRITE_DIR : ITEM_SPRITE_DIR;
    const fullPath = join(dir, filename);

    if (!existsSync(fullPath)) {
      skipped++;
      continue;
    }

    composites.push({
      input: fullPath,
      left: item.ax,
      top: item.ay,
    });
  }

  // Create transparent canvas and composite all sprites onto it
  const atlas = sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  // sharp needs all inputs resized to exactly SPRITE_SIZE×SPRITE_SIZE
  // since some Minecraft textures may be 32×32 or other sizes
  const resizedComposites = await Promise.all(
    composites.map(async (c) => {
      const resized = await sharp(c.input).resize(SPRITE_SIZE, SPRITE_SIZE, { kernel: "nearest" }).toBuffer();
      return { input: resized, left: c.left, top: c.top };
    })
  );

  await atlas.composite(resizedComposites).png({ compressionLevel: 9 }).toFile(ATLAS_PNG);

  const atlasSize = readFileSync(ATLAS_PNG).length;
  console.log(
    `  Atlas PNG: ${(atlasSize / 1024).toFixed(1)} KB (${atlasWidth}×${atlasHeight}px, ${composites.length} sprites, ${skipped} skipped)`
  );
}

generateAtlas().catch((err) => {
  console.error("Atlas generation failed:", err.message);
  process.exit(1);
});
