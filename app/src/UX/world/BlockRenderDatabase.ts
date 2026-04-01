/**
 * ARCHITECTURE: BlockRenderDatabase
 *
 * Shared lookup providing block rendering data (colors, shapes, transparency) for both
 * the VolumeEditor pipeline and browser-based world rendering. This ensures all Minecraft
 * rendering goes through a single source of truth.
 *
 * DATA SOURCES:
 *   - mccat.json (blockBaseTypes array): shapes (`sh`) and map colors (`mc`)
 *   - blocks.json: per-face texture assignments
 *   - terrain_texture.json: texture name → file path
 *
 * USAGE:
 *   - ChunkMeshBuilder uses getBlockColor() and isTransparent() for chunk rendering
 *   - BlockMeshFactory uses shapes and textures for per-block editor rendering
 *   - WorldRenderer uses this for entity colors and sky rendering
 *   - Both VolumeEditor and world-view render paths share this database
 *
 * COORDINATE SYSTEM NOTES:
 *   - VolumeEditor flips X axis: visualX = maxX - (dataX + 0.5)
 *   - World renderers do NOT flip X — use world coords directly
 *   - Both share +Y up, same block size (1 unit = 1 block)
 *
 * RELATED FILES:
 *   - BlockMeshFactory.ts — per-block mesh creation (uses shapes/textures from here)
 *   - ChunkMeshBuilder.ts — chunk mesh generation (uses colors/transparency from here)
 *   - WorldRenderer.ts — scene management (uses this for shared rendering config)
 *   - VolumeEditor.tsx — editor component (uses BlockMeshFactory which uses this)
 *   - mccat.json — block catalog with shapes and map colors
 */

import Log from "../../core/Log";

export interface IBlockRenderInfo {
  name: string;
  color: [number, number, number]; // RGB 0-1
  shape: number; // BlockShape enum from mccat.json
  transparent: boolean;
  alpha: number; // 1.0 = opaque, <1.0 = translucent
}

// Blocks that don't occlude neighbor faces
const TRANSPARENT_BLOCK_NAMES = new Set([
  "air",
  "water",
  "flowing_water",
  "glass",
  "glass_pane",
  "stained_glass",
  "stained_glass_pane",
  "torch",
  "wall_torch",
  "soul_torch",
  "soul_wall_torch",
  "redstone_torch",
  "redstone_wall_torch",
  "short_grass",
  "tall_grass",
  "tallgrass",
  "flower",
  "red_flower",
  "yellow_flower",
  "sapling",
  "oak_sapling",
  "spruce_sapling",
  "birch_sapling",
  "jungle_sapling",
  "acacia_sapling",
  "dark_oak_sapling",
  "snow_layer",
  "vine",
  "ladder",
  "web",
  "deadbush",
  "fern",
  "large_fern",
  "seagrass",
  "kelp",
  "lily_pad",
  "sugar_cane",
  "bamboo",
  "azalea",
  "flowering_azalea",
  "hanging_roots",
  "spore_blossom",
  "cave_vines",
  "cave_vines_body_with_berries",
  "cave_vines_head_with_berries",
  "glow_lichen",
  "sculk_vein",
  "lava",
  "flowing_lava",
  "fire",
  "soul_fire",
  "barrier",
  "structure_void",
  "light_block",
  "rail",
  "golden_rail",
  "detector_rail",
  "activator_rail",
  "powered_rail",
  "lever",
  "redstone_wire",
  "tripwire",
  "tripwire_hook",
  "repeater",
  "comparator",
  "daylight_detector",
  "flower_pot",
  "frame",
  "glow_frame",
  "painting",
  "item_frame",
  "glow_item_frame",
  "carpet",
  "moss_carpet",
  "end_rod",
  "chain",
  "candle",
  "lantern",
  "soul_lantern",
  "bell",
  "pressure_plate",
  "stone_pressure_plate",
  "light_weighted_pressure_plate",
  "heavy_weighted_pressure_plate",
  "polished_blackstone_pressure_plate",
  "wooden_pressure_plate",
  "button",
  "stone_button",
  "wooden_button",
  "sign",
  "hanging_sign",
  "wall_sign",
  "standing_sign",
  "pointed_dripstone",
  "amethyst_cluster",
  "large_amethyst_bud",
  "medium_amethyst_bud",
  "small_amethyst_bud",
]);

// Translucent blocks (render but with alpha < 1)
const TRANSLUCENT_BLOCKS = new Set([
  "water",
  "flowing_water",
  "ice",
  "frosted_ice",
  "glass",
  "glass_pane",
  "stained_glass",
  "stained_glass_pane",
  "tinted_glass",
  "slime",
  "honey_block",
]);

export default class BlockRenderDatabase {
  private _blockInfo: Map<string, IBlockRenderInfo> = new Map();
  private _loaded: boolean = false;

  /**
   * Load block data from mccat.json catalog.
   * Call this once at startup with the parsed mccat.json data.
   */
  loadFromCatalog(catalogData: any): void {
    if (!catalogData) return;

    const blockTypes = catalogData.blockBaseTypes;
    if (!Array.isArray(blockTypes)) {
      Log.debug("BlockRenderDatabase: no blockBaseTypes array in catalog");
      return;
    }

    for (const entry of blockTypes) {
      if (!entry.n) continue;

      const name = entry.n;
      const fullName = name.startsWith("minecraft:") ? name : "minecraft:" + name;
      const shortName = name.startsWith("minecraft:") ? name.substring(10) : name;

      const color = this._parseHexColor(entry.mc);
      const shape = entry.sh ?? 0;
      const transparent = TRANSPARENT_BLOCK_NAMES.has(shortName);
      const alpha = TRANSLUCENT_BLOCKS.has(shortName) ? 0.6 : 1.0;

      const info: IBlockRenderInfo = { name: fullName, color, shape, transparent, alpha };

      // Store under both full and short names for flexible lookup
      this._blockInfo.set(fullName, info);
      this._blockInfo.set(shortName, info);
    }

    this._loaded = true;
    Log.debug(`BlockRenderDatabase: loaded ${blockTypes.length} block types`);
  }

  get isLoaded(): boolean {
    return this._loaded;
  }

  get blockCount(): number {
    // Divide by 2 since each block is stored under both full and short name
    return Math.floor(this._blockInfo.size / 2);
  }

  /**
   * Get render info for a block by name.
   * Accepts "minecraft:stone", "stone", or any block ID format.
   */
  getBlockInfo(blockName: string): IBlockRenderInfo | undefined {
    // Direct lookup
    let info = this._blockInfo.get(blockName);
    if (info) return info;

    // Try with/without namespace
    if (blockName.startsWith("minecraft:")) {
      info = this._blockInfo.get(blockName.substring(10));
    } else {
      info = this._blockInfo.get("minecraft:" + blockName);
    }

    return info;
  }

  /**
   * Get the RGB color for a block (0-1 range).
   * Returns a default gray if block is unknown.
   */
  getBlockColor(blockName: string): [number, number, number] {
    const info = this.getBlockInfo(blockName);
    return info?.color ?? [0.5, 0.45, 0.5]; // Default: grayish purple for unknown
  }

  /**
   * Check if a block is transparent (doesn't occlude neighbor faces).
   */
  isTransparent(blockName: string): boolean {
    if (!blockName || blockName === "minecraft:air" || blockName === "") return true;

    const info = this.getBlockInfo(blockName);
    if (info) return info.transparent;

    // Fallback: check by short name
    const short = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
    return TRANSPARENT_BLOCK_NAMES.has(short);
  }

  /**
   * Get the alpha value for a block (1.0 = opaque, 0.6 = translucent).
   */
  getBlockAlpha(blockName: string): number {
    const info = this.getBlockInfo(blockName);
    return info?.alpha ?? 1.0;
  }

  /**
   * Get the shape enum for a block (from mccat.json `sh` property).
   * 0 = custom, 1 = unitCube, 2 = stairs, 3 = slab, etc.
   */
  getBlockShape(blockName: string): number {
    const info = this.getBlockInfo(blockName);
    return info?.shape ?? 0;
  }

  /**
   * Convert hex color string to RGB tuple (0-1 range).
   */
  private _parseHexColor(hex: string | undefined): [number, number, number] {
    if (!hex || hex.length < 7) return [0.5, 0.5, 0.5];

    try {
      const r = parseInt(hex.substring(1, 3), 16) / 255;
      const g = parseInt(hex.substring(3, 5), 16) / 255;
      const b = parseInt(hex.substring(5, 7), 16) / 255;
      return [r, g, b];
    } catch {
      return [0.5, 0.5, 0.5];
    }
  }

  /**
   * Create a Babylon.js material for a block using its catalog color.
   * Caches materials by block name for reuse.
   */
  createBlockMaterial(
    blockName: string,
    scene: any, // BABYLON.Scene
    materialsCache?: Map<string, any>
  ): any {
    if (materialsCache) {
      const cached = materialsCache.get(blockName);
      if (cached) return cached;
    }

    const BABYLON = (globalThis as any).BABYLON ?? require("babylonjs");
    const color = this.getBlockColor(blockName);
    const alpha = this.getBlockAlpha(blockName);

    const mat = new BABYLON.StandardMaterial("brdb_" + blockName, scene);
    mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
    mat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    if (alpha < 1.0) mat.alpha = alpha;

    if (materialsCache) {
      materialsCache.set(blockName, mat);
    }

    return mat;
  }

  /**
   * Shared scene configuration matching Minecraft's visual style.
   * Used by both VolumeEditor and WorldRenderer to ensure consistent lighting/fog.
   */
  static configureScene(scene: any, options?: { fogStart?: number; fogEnd?: number }): void {
    const BABYLON = (globalThis as any).BABYLON ?? require("babylonjs");

    // Sky blue clear color
    scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.92, 1.0);

    // Linear fog
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = new BABYLON.Color3(0.53, 0.81, 0.92);
    scene.fogStart = options?.fogStart ?? 60;
    scene.fogEnd = options?.fogEnd ?? 120;
  }

  /**
   * Shared lighting setup matching Minecraft's visual style.
   * Uses strong hemispheric ambient for base brightness plus a directional sun
   * for face definition. The directional light creates shadow-like contrast
   * that works with per-face vertex color shading for depth perception.
   */
  static configureLighting(scene: any): { ambient: any; sun: any } {
    const BABYLON = (globalThis as any).BABYLON ?? require("babylonjs");

    // Hemispheric ambient: bright top, moderately bright ground.
    // Ground color raised from 0.60 to 0.80 to improve interior ceiling visibility
    // and overall brightness for faces not directly lit by sun.
    // Intensity raised from 0.95 to 1.15 to brighten all faces, compensating for
    // the multiplicative darkening of face shading vertex colors × lighting.
    const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene);
    ambient.intensity = 1.15;
    ambient.groundColor = new BABYLON.Color3(0.8, 0.8, 0.82);

    // Directional sun: slightly warm, angled from above-left for shadow definition
    const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.4, -0.9, 0.3), scene);
    sun.intensity = 1.05;
    sun.diffuse = new BABYLON.Color3(1.0, 0.98, 0.94);

    return { ambient, sun };
  }
}
