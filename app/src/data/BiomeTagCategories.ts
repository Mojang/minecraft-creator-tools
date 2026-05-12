// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IBiomeTag {
  id: string;
  label: string;
}

export interface IBiomeTagCategory {
  name: string;
  tags: IBiomeTag[];
}

/**
 * Common biome tags organized by category for easy selection.
 * These are the tags most commonly used in spawn rules and feature rules.
 */
const BIOME_TAG_CATEGORIES: IBiomeTagCategory[] = [
  {
    name: "Dimensions",
    tags: [
      { id: "overworld", label: "Overworld" },
      { id: "nether", label: "Nether" },
      { id: "the_end", label: "The End" },
    ],
  },
  {
    name: "Temperature",
    tags: [
      { id: "cold", label: "Cold" },
      { id: "frozen", label: "Frozen" },
      { id: "lukewarm", label: "Lukewarm" },
      { id: "warm", label: "Warm" },
      { id: "temperate", label: "Temperate" },
    ],
  },
  {
    name: "Biome Types",
    tags: [
      { id: "forest", label: "Forest" },
      { id: "plains", label: "Plains" },
      { id: "desert", label: "Desert" },
      { id: "jungle", label: "Jungle" },
      { id: "taiga", label: "Taiga" },
      { id: "savanna", label: "Savanna" },
      { id: "swamp", label: "Swamp" },
      { id: "mangrove_swamp", label: "Mangrove Swamp" },
      { id: "mountain", label: "Mountain" },
      { id: "extreme_hills", label: "Extreme Hills" },
      { id: "mesa", label: "Mesa/Badlands" },
      { id: "mushroom_island", label: "Mushroom Island" },
      { id: "beach", label: "Beach" },
      { id: "ocean", label: "Ocean" },
      { id: "deep", label: "Deep Ocean" },
      { id: "river", label: "River" },
    ],
  },
  {
    name: "Special",
    tags: [
      { id: "ice", label: "Ice" },
      { id: "ice_plains", label: "Ice Plains" },
      { id: "flower_forest", label: "Flower Forest" },
      { id: "birch", label: "Birch" },
      { id: "roofed", label: "Dark Forest" },
      { id: "mega", label: "Mega" },
      { id: "mutated", label: "Mutated" },
      { id: "rare", label: "Rare" },
      { id: "hills", label: "Hills" },
      { id: "edge", label: "Edge" },
      { id: "shore", label: "Shore" },
    ],
  },
  {
    name: "Caves",
    tags: [
      { id: "caves", label: "Caves" },
      { id: "dripstone_caves", label: "Dripstone Caves" },
      { id: "lush_caves", label: "Lush Caves" },
      { id: "deep_dark", label: "Deep Dark" },
    ],
  },
  {
    name: "Nether Biomes",
    tags: [
      { id: "nether_wastes", label: "Nether Wastes" },
      { id: "crimson_forest", label: "Crimson Forest" },
      { id: "warped_forest", label: "Warped Forest" },
      { id: "soul_sand_valley", label: "Soul Sand Valley" },
      { id: "basalt_deltas", label: "Basalt Deltas" },
    ],
  },
];

export default BIOME_TAG_CATEGORIES;
