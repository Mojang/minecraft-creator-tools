/**
 * Utility class for block type operations.
 */
export default class BlockTypeUtilities {
  // Keyword hints map - Minecraft-inspired color associations
  // Check in order of specificity (more specific keywords first)
  private static keywordColorHints: [string[], string][] = [
    // Metals and ores
    [["gold", "gilded"], "#f9d849"],
    [["iron", "metal", "steel"], "#c8c8c8"],
    [["copper"], "#bf6b4d"],
    [["diamond"], "#62e2e2"],
    [["emerald"], "#41f384"],
    [["amethyst", "purple"], "#9a5cc6"],
    [["lapis"], "#345ec3"],
    [["redstone", "red"], "#d03c3c"],
    [["netherite"], "#443a3b"],
    [["quartz"], "#ece9e2"],
    [["coal", "charcoal"], "#2d2d2d"],

    // Natural materials
    [["grass", "fern", "moss", "vine", "seagrass"], "#7cbd6b"],
    [["leaves", "leaf", "foliage", "hedge", "bush", "shrub"], "#4d8c3a"],
    [["flower", "petal", "rose", "tulip", "orchid", "daisy", "poppy"], "#e85d8c"],
    [["log", "wood", "plank", "timber", "bark"], "#8b6342"],
    [["oak"], "#b8945f"],
    [["birch"], "#d5c98c"],
    [["spruce", "pine"], "#4a3520"],
    [["jungle"], "#9e7d4d"],
    [["acacia"], "#ad5d32"],
    [["dark_oak", "darkoak"], "#3e2912"],
    [["cherry", "pink"], "#e8b4c8"],
    [["mangrove"], "#773e30"],
    [["bamboo", "cane"], "#7ea843"],
    [["crimson"], "#7b2735"],
    [["warped"], "#167e7e"],

    // Stone and earth
    [["stone", "rock", "cobble", "andesite", "diorite", "granite", "basalt"], "#7d7d7d"],
    [["deepslate"], "#4a4a4f"],
    [["tuff"], "#6c6c60"],
    [["calcite"], "#dfd9cf"],
    [["dripstone"], "#a17d60"],
    [["dirt", "mud", "soil", "earth", "ground", "podzol", "rooted"], "#866043"],
    [["clay"], "#9fa4b1"],
    [["gravel"], "#8a8275"],
    [["sand"], "#dbd3a0"],
    [["red_sand", "redsand"], "#b5622a"],
    [["terracotta", "hardened_clay"], "#985e43"],
    [["concrete"], "#8f8f8f"],
    [["powder"], "#e0dfd8"],

    // Ice and snow
    [["ice", "frozen", "frost", "packed"], "#a5d3e8"],
    [["snow"], "#f0fafa"],

    // Nether materials
    [["nether", "hell", "infernal"], "#5c2020"],
    [["soul"], "#51413b"],
    [["magma"], "#9f3c0c"],
    [["glowstone", "glow", "lantern", "light", "lamp", "torch", "lit"], "#e8c94c"],
    [["shroomlight"], "#f09c5c"],

    // End materials
    [["end", "chorus"], "#d8d8b0"],
    [["purpur"], "#a77ba7"],
    [["obsidian"], "#151019"],

    // Building materials
    [["brick"], "#8b4d4d"],
    [["nether_brick", "netherbrick"], "#2d1418"],
    [["prismarine"], "#5b9b8b"],
    [["glass", "pane"], "#b5c9cb"],
    [["wool", "carpet", "cloth", "fabric", "banner"], "#e8e8e8"],

    // Colors (for blocks that might specify color in name)
    [["orange"], "#d87e33"],
    [["yellow"], "#e5c739"],
    [["lime", "bright_green", "brightgreen"], "#80c71f"],
    [["green"], "#5e7c16"],
    [["cyan", "teal"], "#169c9c"],
    [["blue"], "#3c44aa"],
    [["light_blue", "lightblue"], "#3ab3da"],
    [["magenta"], "#c74ebd"],
    [["brown"], "#835432"],
    [["black"], "#1d1d21"],
    [["gray", "grey"], "#474f52"],
    [["light_gray", "lightgray", "light_grey", "lightgrey", "silver"], "#9d9d97"],
    [["white"], "#f0f0f0"],

    // Special/magical
    [["enchant", "magic", "spell", "rune", "ancient", "mystic"], "#8a4bd6"],
    [["crystal"], "#a0e0e8"],
    [["slime"], "#7eba2c"],
    [["honey"], "#eb9a27"],
    [["coral"], "#d85db5"],
    [["sponge"], "#c8bc4c"],
    [["bone", "skeleton", "skull"], "#e5e0d0"],
    [["wither"], "#141414"],
  ];

  /**
   * Convert HSL color values to hex color string.
   * @param h Hue (0-360)
   * @param s Saturation (0-100)
   * @param l Lightness (0-100)
   */
  private static hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    const toHex = (n: number) =>
      Math.round((n + m) * 255)
        .toString(16)
        .padStart(2, "0");

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Generate a fallback color for custom blocks without a defined map_color.
   * Uses two strategies:
   * 1. Keyword hints: If the block ID contains certain Minecraft-related keywords,
   *    use a color associated with that material/concept.
   * 2. Hash-based: If no keywords match, generate a consistent color from the block ID hash.
   *    This ensures the same block always gets the same color, but different blocks get distinct colors.
   *
   * @param blockTypeId The full block type identifier (e.g., "mymod:custom_stone_brick")
   * @returns A hex color string (e.g., "#7d7d7d")
   */
  public static getCustomBlockFallbackColor(blockTypeId: string): string {
    const id = blockTypeId.toLowerCase();

    // Check each keyword group
    for (const [keywords, color] of BlockTypeUtilities.keywordColorHints) {
      for (const keyword of keywords) {
        if (id.includes(keyword)) {
          return color;
        }
      }
    }

    // No keyword match - generate a hash-based color
    // Use a simple hash function to generate a consistent value from the block ID
    let hash = 0;
    for (let i = 0; i < blockTypeId.length; i++) {
      const char = blockTypeId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Generate HSL color with:
    // - Hue: Full range (0-360) for variety
    // - Saturation: 40-70% for pleasant, not too garish colors
    // - Lightness: 35-60% for visible but not too bright/dark colors
    const hue = Math.abs(hash) % 360;
    const saturation = 40 + (Math.abs(hash >> 8) % 31); // 40-70
    const lightness = 35 + (Math.abs(hash >> 16) % 26); // 35-60

    // Convert HSL to hex
    return BlockTypeUtilities.hslToHex(hue, saturation, lightness);
  }
}
