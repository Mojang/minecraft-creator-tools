/**
 * ARCHITECTURE: ChunkMeshBuilder
 *
 * Converts chunk data (IChunkColumn from LiveWorldState) into Babylon.js meshes.
 *
 * RENDERING STRATEGY:
 *   Uses BlockMeshFactory.createTexturedBlockMesh() for template meshes per block type,
 *   then Babylon.js thin instances for efficient positioning. This ensures the same
 *   texture resolution pipeline used by VolumeEditor (blocks.json → terrain_texture.json
 *   → PNG) is shared, not duplicated.
 *
 *   Fallback: when BlockMeshFactory/Database catalogs aren't loaded, falls back to
 *   BlockRenderDatabase vertex colors (mccat.json map colors).
 *
 * FACE CULLING:
 *   For each block, check 6 neighbors. Only render blocks with at least one exposed face.
 *   Full per-face culling is handled by BlockMeshFactory's _createBlockMesh internally.
 *
 * COORDINATE SYSTEM:
 *   Block at local (x, y, z) within subchunk maps to world:
 *     worldX = chunkX * 16 + localX
 *     worldY = minY + subchunkIndex * 16 + localY
 *     worldZ = chunkZ * 16 + localZ
 *
 * RELATED FILES:
 *   - BlockMeshFactory.ts — creates textured block meshes (shared with VolumeEditor)
 *   - BlockRenderDatabase.ts — fallback block data (colors, shapes, transparency)
 *   - LiveWorldState.ts — source chunk data
 *   - WorldRenderer.ts — manages chunk mesh lifecycle
 *   - VolumeEditor.tsx — editor rendering (shares BlockMeshFactory)
 */

import * as BABYLON from "babylonjs";
import type { IChunkColumn } from "../../minecraft/client/LiveWorldState";
import type LiveWorldState from "../../minecraft/client/LiveWorldState";
import BlockRenderDatabase from "./BlockRenderDatabase";
import BlockMeshFactory from "./BlockMeshFactory";
import { BlockShape } from "../../minecraft/IBlockBaseTypeData";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";

export interface IChunkMeshResult {
  chunkX: number;
  chunkZ: number;
  meshes: BABYLON.Mesh[];
  blockCount: number;
}

/**
 * Build Babylon.js meshes from chunk column data.
 * Primary path: uses BlockMeshFactory for textured block meshes (same as VolumeEditor).
 * Fallback path: uses BlockRenderDatabase for vertex-colored meshes when Database not loaded.
 */
export default class ChunkMeshBuilder {
  private _scene: BABYLON.Scene;
  private _renderDb: BlockRenderDatabase | undefined;
  private _meshFactory: BlockMeshFactory | undefined;
  private _worldState: LiveWorldState | undefined;
  private _templateMeshes: Map<string, BABYLON.Mesh> = new Map();
  // Billboard templates have child planes (no geometry on parent) — can't use thin instances
  private _billboardTemplates: Set<string> = new Set();
  // Per-face atlas faceUV arrays — stored so fresh CreateBox meshes can replicate atlas UV mapping
  private _atlasFaceUVs: Map<string, BABYLON.Vector4[]> = new Map();
  private _buildCount: number = 0;
  private _loggedFirstBlockBuild: boolean = false;

  /**
   * Maximum Y coordinate to render. Blocks above this Y are skipped entirely.
   * Set to Infinity (default) to render all blocks. Useful for hiding natural terrain
   * above a cleared area (e.g., snow/ice at high altitudes) without racing SubChunk
   * data arrivals from BDS.
   */
  maxRenderY: number = Infinity;

  /**
   * Render center and maximum radius for radial culling.
   * Blocks whose horizontal (X/Z) distance from (renderCenterX, renderCenterZ) exceeds
   * maxRenderRadius are skipped entirely. This eliminates terrain walls at the edges of
   * a cleared area regardless of SubChunk data race timing. Set maxRenderRadius to
   * slightly below fogEnd so culled edges are fully fog-hidden.
   */
  renderCenterX: number = 0;
  renderCenterZ: number = 0;
  maxRenderRadius: number = Infinity;

  /**
   * Graduated distance-dependent Y culling: blocks beyond nearRenderRadius have
   * their effective maxY smoothly interpolated down toward groundRenderY as
   * distance approaches maxRenderRadius. This prevents distant terrain from
   * forming visible rectangular walls against the sky gradient (fog uses a single
   * color that can't match the sky gradient at all elevations).
   *
   * Within nearRenderRadius: full height (maxRenderY) for buildings/trees.
   * At maxRenderRadius: only ground-level blocks (groundRenderY).
   * Between: smooth interpolation eliminates staircase artifacts.
   */
  nearRenderRadius: number = 20;
  groundRenderY: number = 56;

  /**
   * Hard fog-cull distance squared: blocks beyond this distance are NOT rendered at all,
   * regardless of Y or block type. Set to the distance where fog reaches ~85%.
   *
   * WHY: Even at 100% fog, blocks are opaque (fog-colored). Since fog uses a single color
   * (#87CEEB) that matches the sky at the horizon but NOT above it, fogged blocks at any
   * elevation above the mathematical horizon appear as light rectangles against the darker
   * sky — the "terrain wall" artifact. By not rendering them at all, the sky dome and
   * ground plane fill in seamlessly.
   *
   * Computed automatically from scene fog parameters: fogStart + 0.85*(fogEnd-fogStart).
   */
  fogCullDistSq: number = Infinity;

  // Block simplification map: reduces unique block types to minimize mesh/draw call count.
  // Underground variants and similar blocks render as their base type.
  // Keep visually distinct blocks separate for texture variety.
  private static _BLOCK_SIMPLIFY: Record<string, string> = {
    "minecraft:polished_granite": "minecraft:granite",
    "minecraft:polished_diorite": "minecraft:diorite",
    "minecraft:polished_andesite": "minecraft:andesite",
    "minecraft:tuff": "minecraft:tuff",
    "minecraft:deepslate": "minecraft:deepslate",
    "minecraft:cobbled_deepslate": "minecraft:cobblestone",
    // Keep iron_ore, coal_ore, gold_ore distinct — they have unique textures
    "minecraft:copper_ore": "minecraft:iron_ore",
    "minecraft:deepslate_coal_ore": "minecraft:coal_ore",
    "minecraft:deepslate_iron_ore": "minecraft:iron_ore",
    "minecraft:deepslate_copper_ore": "minecraft:iron_ore",
    "minecraft:deepslate_gold_ore": "minecraft:gold_ore",
    "minecraft:deepslate_diamond_ore": "minecraft:diamond_ore",
    "minecraft:deepslate_lapis_ore": "minecraft:lapis_ore",
    "minecraft:deepslate_redstone_ore": "minecraft:redstone_ore",
    "minecraft:deepslate_emerald_ore": "minecraft:emerald_ore",
    "minecraft:coarse_dirt": "minecraft:dirt",
    "minecraft:rooted_dirt": "minecraft:dirt",
    // Consolidate wood types to reduce unique meshes
    // Spruce and birch now have their own atlases; consolidate remaining variants
    "minecraft:jungle_log": "minecraft:oak_log",
    "minecraft:acacia_log": "minecraft:oak_log",
    "minecraft:dark_oak_log": "minecraft:spruce_log",
    "minecraft:cherry_log": "minecraft:birch_log",
    "minecraft:mangrove_log": "minecraft:spruce_log",
    "minecraft:jungle_planks": "minecraft:oak_planks",
    "minecraft:acacia_planks": "minecraft:oak_planks",
    "minecraft:dark_oak_planks": "minecraft:spruce_planks",
    "minecraft:cherry_planks": "minecraft:birch_planks",
    "minecraft:mangrove_planks": "minecraft:spruce_planks",
    // Consolidate leaf types — spruce and birch now have own atlases
    "minecraft:jungle_leaves": "minecraft:oak_leaves",
    "minecraft:acacia_leaves": "minecraft:oak_leaves",
    "minecraft:dark_oak_leaves": "minecraft:spruce_leaves",
    "minecraft:cherry_leaves": "minecraft:birch_leaves",
    "minecraft:mangrove_leaves": "minecraft:spruce_leaves",
    "minecraft:azalea_leaves": "minecraft:oak_leaves",
    "minecraft:azalea_leaves_flowered": "minecraft:oak_leaves",
    // Sand variants
    "minecraft:red_sand": "minecraft:sand",
    "minecraft:soul_sand": "minecraft:soul_sand",
    "minecraft:suspicious_sand": "minecraft:sand",
    // Sandstone variants
    "minecraft:smooth_sandstone": "minecraft:sandstone",
    "minecraft:chiseled_sandstone": "minecraft:sandstone",
    "minecraft:red_sandstone": "minecraft:red_sandstone",
    // Brick/stone brick variants
    "minecraft:stone_bricks": "minecraft:stonebrick",
    "minecraft:mossy_stone_bricks": "minecraft:mossy_cobblestone",
    "minecraft:cracked_stone_bricks": "minecraft:stonebrick",
    "minecraft:chiseled_stone_bricks": "minecraft:stonebrick",
    // Gravel-like
    "minecraft:suspicious_gravel": "minecraft:gravel",
    // Snow/ice: map to existing atlas types for clean rendering
    "minecraft:snow": "minecraft:snow_block",
    "minecraft:powder_snow": "minecraft:snow_block",
    "minecraft:packed_ice": "minecraft:snow_block",
    "minecraft:blue_ice": "minecraft:diamond_block",
    "minecraft:ice": "minecraft:glass",
    // Terracotta variants → terracotta (now has own atlas)
    "minecraft:hardened_clay": "minecraft:terracotta",
    "minecraft:white_terracotta": "minecraft:terracotta",
    "minecraft:orange_terracotta": "minecraft:terracotta",
    "minecraft:red_terracotta": "minecraft:terracotta",
    "minecraft:brown_terracotta": "minecraft:terracotta",
    "minecraft:yellow_terracotta": "minecraft:terracotta",
    // Wool variants → white_wool
    "minecraft:wool": "minecraft:white_wool",
    "minecraft:orange_wool": "minecraft:white_wool",
    "minecraft:red_wool": "minecraft:white_wool",
    "minecraft:blue_wool": "minecraft:white_wool",
    "minecraft:yellow_wool": "minecraft:white_wool",
    "minecraft:lime_wool": "minecraft:white_wool",
    "minecraft:pink_wool": "minecraft:white_wool",
    "minecraft:gray_wool": "minecraft:white_wool",
    "minecraft:light_gray_wool": "minecraft:white_wool",
    "minecraft:cyan_wool": "minecraft:white_wool",
    "minecraft:purple_wool": "minecraft:white_wool",
    "minecraft:green_wool": "minecraft:white_wool",
    "minecraft:brown_wool": "minecraft:white_wool",
    "minecraft:black_wool": "minecraft:white_wool",
    "minecraft:light_blue_wool": "minecraft:white_wool",
    "minecraft:magenta_wool": "minecraft:white_wool",
    // Bedrock and end stone
    "minecraft:end_stone_bricks": "minecraft:end_stone",
    // Purpur variants
    "minecraft:purpur_pillar": "minecraft:purpur_block",
    "minecraft:purpur_stairs": "minecraft:purpur_block",
    "minecraft:purpur_slab": "minecraft:purpur_block",
    // Glass variants → glass (now has its own atlas template)
    "minecraft:glass_pane": "minecraft:glass",
    "minecraft:stained_glass": "minecraft:glass",
    "minecraft:stained_glass_pane": "minecraft:glass",
    "minecraft:tinted_glass": "minecraft:glass",
    // Prismarine variants
    "minecraft:prismarine_bricks": "minecraft:prismarine",
    "minecraft:dark_prismarine": "minecraft:dark_prismarine",
    // Calcite and dripstone
    "minecraft:calcite": "minecraft:diorite",
    "minecraft:dripstone_block": "minecraft:granite",
    // Mud
    "minecraft:mud": "minecraft:mud",
    "minecraft:soul_soil": "minecraft:soul_sand",
    // Blackstone → cobblestone
    "minecraft:blackstone": "minecraft:cobblestone",
    "minecraft:polished_blackstone": "minecraft:cobblestone",
    "minecraft:polished_blackstone_bricks": "minecraft:stonebrick",
    // Concrete → wool (similar solid-color blocks)
    "minecraft:white_concrete": "minecraft:white_wool",
    "minecraft:gray_concrete": "minecraft:stone",
    "minecraft:black_concrete": "minecraft:obsidian",
    "minecraft:brown_concrete": "minecraft:dirt",
    "minecraft:red_concrete": "minecraft:bricks",
    "minecraft:blue_concrete": "minecraft:lapis_block",
    "minecraft:green_concrete": "minecraft:emerald_block",
    "minecraft:yellow_concrete": "minecraft:gold_block",
    "minecraft:orange_concrete": "minecraft:terracotta",
    "minecraft:pink_concrete": "minecraft:white_wool",
    "minecraft:lime_concrete": "minecraft:white_wool",
    "minecraft:cyan_concrete": "minecraft:prismarine",
    "minecraft:light_blue_concrete": "minecraft:diamond_block",
    "minecraft:purple_concrete": "minecraft:purpur_block",
    "minecraft:magenta_concrete": "minecraft:purpur_block",
    // Copper variants → iron_block
    "minecraft:copper_block": "minecraft:iron_block",
    "minecraft:exposed_copper": "minecraft:iron_block",
    "minecraft:weathered_copper": "minecraft:iron_block",
    "minecraft:oxidized_copper": "minecraft:diamond_block",
    "minecraft:waxed_copper": "minecraft:iron_block",
    // Nether blocks
    "minecraft:nether_bricks": "minecraft:stonebrick",
    "minecraft:red_nether_bricks": "minecraft:bricks",
    "minecraft:basalt": "minecraft:stone",
    "minecraft:polished_basalt": "minecraft:stone",
    "minecraft:warped_nylium": "minecraft:grass_block",
    "minecraft:crimson_nylium": "minecraft:grass_block",
    // Amethyst/sculk
    "minecraft:amethyst_block": "minecraft:purpur_block",
    "minecraft:sculk": "minecraft:obsidian",
    // Slabs/stairs → base block (render as full cubes for simplicity)
    "minecraft:stone_brick_slab": "minecraft:stonebrick",
    "minecraft:oak_slab": "minecraft:oak_planks",
    "minecraft:cobblestone_slab": "minecraft:cobblestone",
    "minecraft:stone_slab": "minecraft:smooth_stone",
    "minecraft:brick_slab": "minecraft:brick_block",
    "minecraft:stone_brick_stairs": "minecraft:stonebrick",
    "minecraft:oak_stairs": "minecraft:oak_planks",
    "minecraft:cobblestone_stairs": "minecraft:cobblestone",
    "minecraft:spruce_stairs": "minecraft:spruce_planks",
    "minecraft:birch_stairs": "minecraft:birch_planks",
    // Farmland/path → dirt
    "minecraft:farmland": "minecraft:dirt",
    "minecraft:grass_path": "minecraft:dirt",
    "minecraft:dirt_path": "minecraft:dirt",
  };

  constructor(scene: BABYLON.Scene, renderDb?: BlockRenderDatabase, meshFactory?: BlockMeshFactory) {
    this._scene = scene;
    this._renderDb = renderDb;
    this._meshFactory = meshFactory;
  }

  setRenderDatabase(renderDb: BlockRenderDatabase): void {
    this._renderDb = renderDb;
  }

  setMeshFactory(meshFactory: BlockMeshFactory): void {
    this._meshFactory = meshFactory;
    // Use world textures (non-carried) for in-world rendering.
    // Carried textures lack alpha cutout for leaves/vines.
    meshFactory.useWorldTextures = true;
  }

  setWorldState(worldState: LiveWorldState): void {
    this._worldState = worldState;
  }

  /**
   * Create per-face atlas templates for blocks with distinct top/side/bottom textures.
   * This composites multiple textures into a single atlas and uses faceUV to map each
   * face of a CreateBox to its correct texture region. This is compatible with thin
   * instances (single material per mesh) and gives grass blocks their iconic look:
   * green top, grass_side (dirt+strip) sides, dirt bottom.
   *
   * Must be called AFTER setMeshFactory() — depends on vanilla texture paths being available.
   */
  async createAtlasTemplates(): Promise<void> {
    const baseUrl = CreatorToolsHost.getVanillaContentRoot() + "res/latest/van/serve/resource_pack/";

    // Grass block: green top, grass_side sides, dirt bottom
    await this._createPerFaceAtlasTemplate(
      "minecraft:grass_block",
      {
        top: baseUrl + "textures/blocks/grass_carried.png",
        side: baseUrl + "textures/blocks/grass_side.png",
        bottom: baseUrl + "textures/blocks/dirt.png",
      },
      new BABYLON.Color3(0.47, 0.66, 0.28) // Plains biome tint for top face (natural green)
    );

    // Oak log: wood grain top/bottom, bark sides
    await this._createPerFaceAtlasTemplate("minecraft:oak_log", {
      top: baseUrl + "textures/blocks/log_oak_top.png",
      side: baseUrl + "textures/blocks/log_oak.png",
      bottom: baseUrl + "textures/blocks/log_oak_top.png",
    });

    // Crafting table: distinct top (grid), sides (tools), bottom (oak planks)
    await this._createPerFaceAtlasTemplate("minecraft:crafting_table", {
      top: baseUrl + "textures/blocks/crafting_table_top.png",
      side: baseUrl + "textures/blocks/crafting_table_side.png",
      bottom: baseUrl + "textures/blocks/planks_oak.png",
    });

    // Furnace: distinct front (dark mouth), sides (cobblestone)
    await this._createPerFaceAtlasTemplate("minecraft:furnace", {
      top: baseUrl + "textures/blocks/furnace_top.png",
      side: baseUrl + "textures/blocks/furnace_side.png",
      bottom: baseUrl + "textures/blocks/furnace_top.png",
    });

    // Bookshelf: shelves on sides, oak planks top/bottom
    await this._createPerFaceAtlasTemplate("minecraft:bookshelf", {
      top: baseUrl + "textures/blocks/planks_oak.png",
      side: baseUrl + "textures/blocks/bookshelf.png",
      bottom: baseUrl + "textures/blocks/planks_oak.png",
    });

    // Snowy grass: snow on top, grass_side_snowed sides, dirt bottom
    await this._createPerFaceAtlasTemplate("minecraft:grass_block_snow", {
      top: baseUrl + "textures/blocks/snow.png",
      side: baseUrl + "textures/blocks/grass_side_snowed.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });

    // Podzol: dark top, podzol_side sides, dirt bottom
    await this._createPerFaceAtlasTemplate("minecraft:podzol", {
      top: baseUrl + "textures/blocks/podzol_top.png",
      side: baseUrl + "textures/blocks/podzol_side.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });

    // Mycelium: purple-grey top, mycelium_side sides, dirt bottom
    await this._createPerFaceAtlasTemplate("minecraft:mycelium", {
      top: baseUrl + "textures/blocks/mycelium_top.png",
      side: baseUrl + "textures/blocks/mycelium_side.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });

    // TNT: unique top/side/bottom textures
    await this._createPerFaceAtlasTemplate("minecraft:tnt", {
      top: baseUrl + "textures/blocks/tnt_top.png",
      side: baseUrl + "textures/blocks/tnt_side.png",
      bottom: baseUrl + "textures/blocks/tnt_bottom.png",
    });

    // Stone variants: same texture all faces, but edge darkening gives them visual definition
    // without edge darkening, large stone surfaces look like flat, featureless walls
    await this._createPerFaceAtlasTemplate("minecraft:stone", {
      top: baseUrl + "textures/blocks/stone.png",
      side: baseUrl + "textures/blocks/stone.png",
      bottom: baseUrl + "textures/blocks/stone.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:granite", {
      top: baseUrl + "textures/blocks/stone_granite.png",
      side: baseUrl + "textures/blocks/stone_granite.png",
      bottom: baseUrl + "textures/blocks/stone_granite.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:diorite", {
      top: baseUrl + "textures/blocks/stone_diorite.png",
      side: baseUrl + "textures/blocks/stone_diorite.png",
      bottom: baseUrl + "textures/blocks/stone_diorite.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:andesite", {
      top: baseUrl + "textures/blocks/stone_andesite.png",
      side: baseUrl + "textures/blocks/stone_andesite.png",
      bottom: baseUrl + "textures/blocks/stone_andesite.png",
    });
    // Dirt also benefits from edge darkening for visual definition
    await this._createPerFaceAtlasTemplate("minecraft:dirt", {
      top: baseUrl + "textures/blocks/dirt.png",
      side: baseUrl + "textures/blocks/dirt.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });
    // Sand
    await this._createPerFaceAtlasTemplate("minecraft:sand", {
      top: baseUrl + "textures/blocks/sand.png",
      side: baseUrl + "textures/blocks/sand.png",
      bottom: baseUrl + "textures/blocks/sand.png",
    });
    // Cobblestone
    await this._createPerFaceAtlasTemplate("minecraft:cobblestone", {
      top: baseUrl + "textures/blocks/cobblestone.png",
      side: baseUrl + "textures/blocks/cobblestone.png",
      bottom: baseUrl + "textures/blocks/cobblestone.png",
    });
    // Oak planks
    await this._createPerFaceAtlasTemplate("minecraft:oak_planks", {
      top: baseUrl + "textures/blocks/planks_oak.png",
      side: baseUrl + "textures/blocks/planks_oak.png",
      bottom: baseUrl + "textures/blocks/planks_oak.png",
    });
    // Stone bricks
    await this._createPerFaceAtlasTemplate("minecraft:stonebrick", {
      top: baseUrl + "textures/blocks/stonebrick.png",
      side: baseUrl + "textures/blocks/stonebrick.png",
      bottom: baseUrl + "textures/blocks/stonebrick.png",
    });

    // Coal ore — dark veins in stone
    await this._createPerFaceAtlasTemplate("minecraft:coal_ore", {
      top: baseUrl + "textures/blocks/coal_ore.png",
      side: baseUrl + "textures/blocks/coal_ore.png",
      bottom: baseUrl + "textures/blocks/coal_ore.png",
    });
    // Iron ore — tan/brown spots in stone
    await this._createPerFaceAtlasTemplate("minecraft:iron_ore", {
      top: baseUrl + "textures/blocks/iron_ore.png",
      side: baseUrl + "textures/blocks/iron_ore.png",
      bottom: baseUrl + "textures/blocks/iron_ore.png",
    });
    // Gold ore — yellow spots in stone
    await this._createPerFaceAtlasTemplate("minecraft:gold_ore", {
      top: baseUrl + "textures/blocks/gold_ore.png",
      side: baseUrl + "textures/blocks/gold_ore.png",
      bottom: baseUrl + "textures/blocks/gold_ore.png",
    });
    // Diamond ore — blue gems in stone
    await this._createPerFaceAtlasTemplate("minecraft:diamond_ore", {
      top: baseUrl + "textures/blocks/diamond_ore.png",
      side: baseUrl + "textures/blocks/diamond_ore.png",
      bottom: baseUrl + "textures/blocks/diamond_ore.png",
    });
    // Gravel — gray pebbly texture
    await this._createPerFaceAtlasTemplate("minecraft:gravel", {
      top: baseUrl + "textures/blocks/gravel.png",
      side: baseUrl + "textures/blocks/gravel.png",
      bottom: baseUrl + "textures/blocks/gravel.png",
    });
    // Bricks — red brick pattern
    await this._createPerFaceAtlasTemplate("minecraft:brick_block", {
      top: baseUrl + "textures/blocks/brick.png",
      side: baseUrl + "textures/blocks/brick.png",
      bottom: baseUrl + "textures/blocks/brick.png",
    });
    // Mossy cobblestone — green-tinged cobblestone
    await this._createPerFaceAtlasTemplate("minecraft:mossy_cobblestone", {
      top: baseUrl + "textures/blocks/cobblestone_mossy.png",
      side: baseUrl + "textures/blocks/cobblestone_mossy.png",
      bottom: baseUrl + "textures/blocks/cobblestone_mossy.png",
    });
    // Sandstone — layered top/side/bottom
    await this._createPerFaceAtlasTemplate("minecraft:sandstone", {
      top: baseUrl + "textures/blocks/sandstone_top.png",
      side: baseUrl + "textures/blocks/sandstone_normal.png",
      bottom: baseUrl + "textures/blocks/sandstone_bottom.png",
    });
    // Lapis ore — blue spots in stone
    await this._createPerFaceAtlasTemplate("minecraft:lapis_ore", {
      top: baseUrl + "textures/blocks/lapis_ore.png",
      side: baseUrl + "textures/blocks/lapis_ore.png",
      bottom: baseUrl + "textures/blocks/lapis_ore.png",
    });
    // Redstone ore — red spots in stone
    await this._createPerFaceAtlasTemplate("minecraft:redstone_ore", {
      top: baseUrl + "textures/blocks/redstone_ore.png",
      side: baseUrl + "textures/blocks/redstone_ore.png",
      bottom: baseUrl + "textures/blocks/redstone_ore.png",
    });
    // Emerald ore — green gem in stone
    await this._createPerFaceAtlasTemplate("minecraft:emerald_ore", {
      top: baseUrl + "textures/blocks/emerald_ore.png",
      side: baseUrl + "textures/blocks/emerald_ore.png",
      bottom: baseUrl + "textures/blocks/emerald_ore.png",
    });

    // Glass — procedural semi-transparent texture.
    // The vanilla glass.png is almost entirely transparent, which causes black rendering
    // with thin instances (needDepthPrePass blocks geometry behind it, transparent pixels
    // composite as black). Instead, we create a procedural glass: light blue fill with
    // white grid lines, rendered as a semi-opaque surface via mat.alpha.
    await this._createGlassAtlasTemplate();

    // Oak leaves — green foliage with alpha cutout for natural look.
    // IMPORTANT: Use leaves_oak.png (has alpha holes), NOT leaves_oak_carried.png (fully opaque inventory icon).
    await this._createPerFaceAtlasTemplate(
      "minecraft:oak_leaves",
      {
        top: baseUrl + "textures/blocks/leaves_oak.png",
        side: baseUrl + "textures/blocks/leaves_oak.png",
        bottom: baseUrl + "textures/blocks/leaves_oak.png",
      },
      new BABYLON.Color3(0.58, 0.82, 0.38) // Plains biome leaf tint (brightened for grayscale texture)
    );

    // Water — translucent blue
    await this._createPerFaceAtlasTemplate(
      "minecraft:water",
      {
        top: baseUrl + "textures/blocks/water_placeholder.png",
        side: baseUrl + "textures/blocks/water_placeholder.png",
        bottom: baseUrl + "textures/blocks/water_placeholder.png",
      },
      new BABYLON.Color3(0.24, 0.45, 0.85) // Water tint
    );

    // Obsidian — dark purple-black
    await this._createPerFaceAtlasTemplate("minecraft:obsidian", {
      top: baseUrl + "textures/blocks/obsidian.png",
      side: baseUrl + "textures/blocks/obsidian.png",
      bottom: baseUrl + "textures/blocks/obsidian.png",
    });

    // Glowstone — yellow luminous
    await this._createPerFaceAtlasTemplate("minecraft:glowstone", {
      top: baseUrl + "textures/blocks/glowstone.png",
      side: baseUrl + "textures/blocks/glowstone.png",
      bottom: baseUrl + "textures/blocks/glowstone.png",
    });

    // Netherrack (mapped from granite)
    await this._createPerFaceAtlasTemplate("minecraft:netherrack", {
      top: baseUrl + "textures/blocks/netherrack.png",
      side: baseUrl + "textures/blocks/netherrack.png",
      bottom: baseUrl + "textures/blocks/netherrack.png",
    });

    // Bedrock — dark with irregular pattern
    await this._createPerFaceAtlasTemplate("minecraft:bedrock", {
      top: baseUrl + "textures/blocks/bedrock.png",
      side: baseUrl + "textures/blocks/bedrock.png",
      bottom: baseUrl + "textures/blocks/bedrock.png",
    });

    // Torch: NOT rendered as a full cube atlas — handled by _getOrCreateTemplateMesh
    // as a small billboard box (0.125 x 0.625). Creating a full-cube atlas template here
    // would pre-populate _templateMeshes, causing the billboard check in buildChunkMesh
    // to miss the torch, rendering it as a 1x1x1 opaque cube that blocks the view
    // (the "black ceiling" bug when torches are inside a building).

    // === Additional block types for terrain variety ===

    // Snow — pure white
    await this._createPerFaceAtlasTemplate("minecraft:snow_layer", {
      top: baseUrl + "textures/blocks/snow.png",
      side: baseUrl + "textures/blocks/snow.png",
      bottom: baseUrl + "textures/blocks/snow.png",
    });
    // Spruce log — darker bark than oak
    await this._createPerFaceAtlasTemplate("minecraft:spruce_log", {
      top: baseUrl + "textures/blocks/log_spruce_top.png",
      side: baseUrl + "textures/blocks/log_spruce.png",
      bottom: baseUrl + "textures/blocks/log_spruce_top.png",
    });
    // Birch log — white bark with dark patches
    await this._createPerFaceAtlasTemplate("minecraft:birch_log", {
      top: baseUrl + "textures/blocks/log_birch_top.png",
      side: baseUrl + "textures/blocks/log_birch.png",
      bottom: baseUrl + "textures/blocks/log_birch_top.png",
    });
    // Spruce leaves — darker green than oak. Fixed tint #619961.
    await this._createPerFaceAtlasTemplate(
      "minecraft:spruce_leaves",
      {
        top: baseUrl + "textures/blocks/leaves_spruce.png",
        side: baseUrl + "textures/blocks/leaves_spruce.png",
        bottom: baseUrl + "textures/blocks/leaves_spruce.png",
      },
      new BABYLON.Color3(0.46, 0.7, 0.46) // Spruce foliage tint (brightened)
    );
    // Birch leaves — lighter yellow-green. Fixed tint #80A755.
    await this._createPerFaceAtlasTemplate(
      "minecraft:birch_leaves",
      {
        top: baseUrl + "textures/blocks/leaves_birch.png",
        side: baseUrl + "textures/blocks/leaves_birch.png",
        bottom: baseUrl + "textures/blocks/leaves_birch.png",
      },
      new BABYLON.Color3(0.58, 0.75, 0.4) // Birch foliage tint (brightened)
    );
    // Spruce/birch planks
    await this._createPerFaceAtlasTemplate("minecraft:spruce_planks", {
      top: baseUrl + "textures/blocks/planks_spruce.png",
      side: baseUrl + "textures/blocks/planks_spruce.png",
      bottom: baseUrl + "textures/blocks/planks_spruce.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:birch_planks", {
      top: baseUrl + "textures/blocks/planks_birch.png",
      side: baseUrl + "textures/blocks/planks_birch.png",
      bottom: baseUrl + "textures/blocks/planks_birch.png",
    });
    // Wool — white (most common)
    await this._createPerFaceAtlasTemplate("minecraft:white_wool", {
      top: baseUrl + "textures/blocks/wool_colored_white.png",
      side: baseUrl + "textures/blocks/wool_colored_white.png",
      bottom: baseUrl + "textures/blocks/wool_colored_white.png",
    });
    // Terracotta — orange-brown clay
    await this._createPerFaceAtlasTemplate("minecraft:terracotta", {
      top: baseUrl + "textures/blocks/hardened_clay.png",
      side: baseUrl + "textures/blocks/hardened_clay.png",
      bottom: baseUrl + "textures/blocks/hardened_clay.png",
    });
    // Smooth stone — polished surface
    await this._createPerFaceAtlasTemplate("minecraft:smooth_stone", {
      top: baseUrl + "textures/blocks/stone_slab_top.png",
      side: baseUrl + "textures/blocks/stone_slab_side.png",
      bottom: baseUrl + "textures/blocks/stone_slab_top.png",
    });
    // Lapis block — deep blue
    await this._createPerFaceAtlasTemplate("minecraft:lapis_block", {
      top: baseUrl + "textures/blocks/lapis_block.png",
      side: baseUrl + "textures/blocks/lapis_block.png",
      bottom: baseUrl + "textures/blocks/lapis_block.png",
    });
    // Iron block — shiny silver
    await this._createPerFaceAtlasTemplate("minecraft:iron_block", {
      top: baseUrl + "textures/blocks/iron_block.png",
      side: baseUrl + "textures/blocks/iron_block.png",
      bottom: baseUrl + "textures/blocks/iron_block.png",
    });
    // Gold block — shiny gold
    await this._createPerFaceAtlasTemplate("minecraft:gold_block", {
      top: baseUrl + "textures/blocks/gold_block.png",
      side: baseUrl + "textures/blocks/gold_block.png",
      bottom: baseUrl + "textures/blocks/gold_block.png",
    });
    // Diamond block — teal-blue gems
    await this._createPerFaceAtlasTemplate("minecraft:diamond_block", {
      top: baseUrl + "textures/blocks/diamond_block.png",
      side: baseUrl + "textures/blocks/diamond_block.png",
      bottom: baseUrl + "textures/blocks/diamond_block.png",
    });
    // Bricks — classic red brick pattern
    await this._createPerFaceAtlasTemplate("minecraft:bricks", {
      top: baseUrl + "textures/blocks/brick.png",
      side: baseUrl + "textures/blocks/brick.png",
      bottom: baseUrl + "textures/blocks/brick.png",
    });
    // Mossy cobblestone
    await this._createPerFaceAtlasTemplate("minecraft:mossy_cobblestone", {
      top: baseUrl + "textures/blocks/cobblestone_mossy.png",
      side: baseUrl + "textures/blocks/cobblestone_mossy.png",
      bottom: baseUrl + "textures/blocks/cobblestone_mossy.png",
    });
    // Clay block
    await this._createPerFaceAtlasTemplate("minecraft:clay", {
      top: baseUrl + "textures/blocks/clay.png",
      side: baseUrl + "textures/blocks/clay.png",
      bottom: baseUrl + "textures/blocks/clay.png",
    });
    // Snow block
    await this._createPerFaceAtlasTemplate("minecraft:snow_block", {
      top: baseUrl + "textures/blocks/snow.png",
      side: baseUrl + "textures/blocks/snow.png",
      bottom: baseUrl + "textures/blocks/snow.png",
    });
    // Netherrack
    await this._createPerFaceAtlasTemplate("minecraft:netherrack", {
      top: baseUrl + "textures/blocks/netherrack.png",
      side: baseUrl + "textures/blocks/netherrack.png",
      bottom: baseUrl + "textures/blocks/netherrack.png",
    });
    // End stone
    await this._createPerFaceAtlasTemplate("minecraft:end_stone", {
      top: baseUrl + "textures/blocks/end_stone.png",
      side: baseUrl + "textures/blocks/end_stone.png",
      bottom: baseUrl + "textures/blocks/end_stone.png",
    });
    // Quartz block
    await this._createPerFaceAtlasTemplate("minecraft:quartz_block", {
      top: baseUrl + "textures/blocks/quartz_block_top.png",
      side: baseUrl + "textures/blocks/quartz_block_side.png",
      bottom: baseUrl + "textures/blocks/quartz_block_bottom.png",
    });
    // Prismarine — ocean monument block
    await this._createPerFaceAtlasTemplate("minecraft:prismarine", {
      top: baseUrl + "textures/blocks/prismarine_rough.png",
      side: baseUrl + "textures/blocks/prismarine_rough.png",
      bottom: baseUrl + "textures/blocks/prismarine_rough.png",
    });
    // Emerald block
    await this._createPerFaceAtlasTemplate("minecraft:emerald_block", {
      top: baseUrl + "textures/blocks/emerald_block.png",
      side: baseUrl + "textures/blocks/emerald_block.png",
      bottom: baseUrl + "textures/blocks/emerald_block.png",
    });
    // Redstone block
    await this._createPerFaceAtlasTemplate("minecraft:redstone_block", {
      top: baseUrl + "textures/blocks/redstone_block.png",
      side: baseUrl + "textures/blocks/redstone_block.png",
      bottom: baseUrl + "textures/blocks/redstone_block.png",
    });

    // White wool (all wool colors simplify to this)
    await this._createPerFaceAtlasTemplate("minecraft:white_wool", {
      top: baseUrl + "textures/blocks/wool_colored_white.png",
      side: baseUrl + "textures/blocks/wool_colored_white.png",
      bottom: baseUrl + "textures/blocks/wool_colored_white.png",
    });
    // Iron block
    await this._createPerFaceAtlasTemplate("minecraft:iron_block", {
      top: baseUrl + "textures/blocks/iron_block.png",
      side: baseUrl + "textures/blocks/iron_block.png",
      bottom: baseUrl + "textures/blocks/iron_block.png",
    });
    // Gold block
    await this._createPerFaceAtlasTemplate("minecraft:gold_block", {
      top: baseUrl + "textures/blocks/gold_block.png",
      side: baseUrl + "textures/blocks/gold_block.png",
      bottom: baseUrl + "textures/blocks/gold_block.png",
    });
    // Lapis block
    await this._createPerFaceAtlasTemplate("minecraft:lapis_block", {
      top: baseUrl + "textures/blocks/lapis_block.png",
      side: baseUrl + "textures/blocks/lapis_block.png",
      bottom: baseUrl + "textures/blocks/lapis_block.png",
    });
    // Obsidian
    await this._createPerFaceAtlasTemplate("minecraft:obsidian", {
      top: baseUrl + "textures/blocks/obsidian.png",
      side: baseUrl + "textures/blocks/obsidian.png",
      bottom: baseUrl + "textures/blocks/obsidian.png",
    });
    // Bookshelf — side has book spines, top/bottom are oak planks
    await this._createPerFaceAtlasTemplate("minecraft:bookshelf", {
      top: baseUrl + "textures/blocks/planks_oak.png",
      side: baseUrl + "textures/blocks/bookshelf.png",
      bottom: baseUrl + "textures/blocks/planks_oak.png",
    });
    // Crafting table — distinct top, front, and side textures
    await this._createPerFaceAtlasTemplate("minecraft:crafting_table", {
      top: baseUrl + "textures/blocks/crafting_table_top.png",
      side: baseUrl + "textures/blocks/crafting_table_front.png",
      bottom: baseUrl + "textures/blocks/planks_oak.png",
    });
    // Furnace — front face with oven door, side/top are stone-like
    await this._createPerFaceAtlasTemplate("minecraft:furnace", {
      top: baseUrl + "textures/blocks/furnace_top.png",
      side: baseUrl + "textures/blocks/furnace_front_off.png",
      bottom: baseUrl + "textures/blocks/furnace_top.png",
    });
    // Bedrock
    await this._createPerFaceAtlasTemplate("minecraft:bedrock", {
      top: baseUrl + "textures/blocks/bedrock.png",
      side: baseUrl + "textures/blocks/bedrock.png",
      bottom: baseUrl + "textures/blocks/bedrock.png",
    });
    // Terracotta (hardened clay)
    await this._createPerFaceAtlasTemplate("minecraft:terracotta", {
      top: baseUrl + "textures/blocks/hardened_clay.png",
      side: baseUrl + "textures/blocks/hardened_clay.png",
      bottom: baseUrl + "textures/blocks/hardened_clay.png",
    });
    // Smooth stone
    await this._createPerFaceAtlasTemplate("minecraft:smooth_stone", {
      top: baseUrl + "textures/blocks/stone_slab_top.png",
      side: baseUrl + "textures/blocks/stone_slab_top.png",
      bottom: baseUrl + "textures/blocks/stone_slab_top.png",
    });
    // Diamond block
    await this._createPerFaceAtlasTemplate("minecraft:diamond_block", {
      top: baseUrl + "textures/blocks/diamond_block.png",
      side: baseUrl + "textures/blocks/diamond_block.png",
      bottom: baseUrl + "textures/blocks/diamond_block.png",
    });
    // Podzol (forest biome)
    await this._createPerFaceAtlasTemplate("minecraft:podzol", {
      top: baseUrl + "textures/blocks/dirt_podzol_top.png",
      side: baseUrl + "textures/blocks/dirt_podzol_side.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });
    // Mycelium
    await this._createPerFaceAtlasTemplate("minecraft:mycelium", {
      top: baseUrl + "textures/blocks/mycelium_top.png",
      side: baseUrl + "textures/blocks/mycelium_side.png",
      bottom: baseUrl + "textures/blocks/dirt.png",
    });
    // Purpur block
    await this._createPerFaceAtlasTemplate("minecraft:purpur_block", {
      top: baseUrl + "textures/blocks/purpur_block.png",
      side: baseUrl + "textures/blocks/purpur_block.png",
      bottom: baseUrl + "textures/blocks/purpur_block.png",
    });

    // --- Stone variants ---
    await this._createPerFaceAtlasTemplate("minecraft:granite", {
      top: baseUrl + "textures/blocks/stone_granite.png",
      side: baseUrl + "textures/blocks/stone_granite.png",
      bottom: baseUrl + "textures/blocks/stone_granite.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:diorite", {
      top: baseUrl + "textures/blocks/stone_diorite.png",
      side: baseUrl + "textures/blocks/stone_diorite.png",
      bottom: baseUrl + "textures/blocks/stone_diorite.png",
    });
    await this._createPerFaceAtlasTemplate("minecraft:andesite", {
      top: baseUrl + "textures/blocks/stone_andesite.png",
      side: baseUrl + "textures/blocks/stone_andesite.png",
      bottom: baseUrl + "textures/blocks/stone_andesite.png",
    });

    // --- Additional wood variants ---
    // Spruce log
    await this._createPerFaceAtlasTemplate("minecraft:spruce_log", {
      top: baseUrl + "textures/blocks/log_spruce_top.png",
      side: baseUrl + "textures/blocks/log_spruce.png",
      bottom: baseUrl + "textures/blocks/log_spruce_top.png",
    });
    // Birch log
    await this._createPerFaceAtlasTemplate("minecraft:birch_log", {
      top: baseUrl + "textures/blocks/log_birch_top.png",
      side: baseUrl + "textures/blocks/log_birch.png",
      bottom: baseUrl + "textures/blocks/log_birch_top.png",
    });
    // Spruce planks
    await this._createPerFaceAtlasTemplate("minecraft:spruce_planks", {
      top: baseUrl + "textures/blocks/planks_spruce.png",
      side: baseUrl + "textures/blocks/planks_spruce.png",
      bottom: baseUrl + "textures/blocks/planks_spruce.png",
    });
    // Birch planks
    await this._createPerFaceAtlasTemplate("minecraft:birch_planks", {
      top: baseUrl + "textures/blocks/planks_birch.png",
      side: baseUrl + "textures/blocks/planks_birch.png",
      bottom: baseUrl + "textures/blocks/planks_birch.png",
    });
    // Spruce leaves — fixed tint #619961
    await this._createPerFaceAtlasTemplate(
      "minecraft:spruce_leaves",
      {
        top: baseUrl + "textures/blocks/leaves_spruce.png",
        side: baseUrl + "textures/blocks/leaves_spruce.png",
        bottom: baseUrl + "textures/blocks/leaves_spruce.png",
      },
      new BABYLON.Color3(0.46, 0.7, 0.46) // Spruce foliage tint (brightened)
    );
    // Birch leaves — fixed tint #80A755
    await this._createPerFaceAtlasTemplate(
      "minecraft:birch_leaves",
      {
        top: baseUrl + "textures/blocks/leaves_birch.png",
        side: baseUrl + "textures/blocks/leaves_birch.png",
        bottom: baseUrl + "textures/blocks/leaves_birch.png",
      },
      new BABYLON.Color3(0.58, 0.75, 0.4) // Birch foliage tint (brightened)
    );

    // --- Common blocks ---
    // Clay
    await this._createPerFaceAtlasTemplate("minecraft:clay", {
      top: baseUrl + "textures/blocks/clay.png",
      side: baseUrl + "textures/blocks/clay.png",
      bottom: baseUrl + "textures/blocks/clay.png",
    });
    // Soul sand
    await this._createPerFaceAtlasTemplate("minecraft:soul_sand", {
      top: baseUrl + "textures/blocks/soul_sand.png",
      side: baseUrl + "textures/blocks/soul_sand.png",
      bottom: baseUrl + "textures/blocks/soul_sand.png",
    });
    // Emerald block
    await this._createPerFaceAtlasTemplate("minecraft:emerald_block", {
      top: baseUrl + "textures/blocks/emerald_block.png",
      side: baseUrl + "textures/blocks/emerald_block.png",
      bottom: baseUrl + "textures/blocks/emerald_block.png",
    });
    // Mossy cobblestone
    await this._createPerFaceAtlasTemplate("minecraft:mossy_cobblestone", {
      top: baseUrl + "textures/blocks/cobblestone_mossy.png",
      side: baseUrl + "textures/blocks/cobblestone_mossy.png",
      bottom: baseUrl + "textures/blocks/cobblestone_mossy.png",
    });

    // --- Decorative/special blocks ---
    // TNT (multi-face)
    await this._createPerFaceAtlasTemplate("minecraft:tnt", {
      top: baseUrl + "textures/blocks/tnt_top.png",
      side: baseUrl + "textures/blocks/tnt_side.png",
      bottom: baseUrl + "textures/blocks/tnt_bottom.png",
    });
    // Pumpkin (multi-face)
    await this._createPerFaceAtlasTemplate("minecraft:pumpkin", {
      top: baseUrl + "textures/blocks/pumpkin_top.png",
      side: baseUrl + "textures/blocks/pumpkin_side.png",
      bottom: baseUrl + "textures/blocks/pumpkin_top.png",
    });
    // Melon (multi-face)
    await this._createPerFaceAtlasTemplate("minecraft:melon_block", {
      top: baseUrl + "textures/blocks/melon_top.png",
      side: baseUrl + "textures/blocks/melon_side.png",
      bottom: baseUrl + "textures/blocks/melon_top.png",
    });
    // Hay block (multi-face)
    await this._createPerFaceAtlasTemplate("minecraft:hay_block", {
      top: baseUrl + "textures/blocks/hay_block_top.png",
      side: baseUrl + "textures/blocks/hay_block_side.png",
      bottom: baseUrl + "textures/blocks/hay_block_top.png",
    });
    // Sponge
    await this._createPerFaceAtlasTemplate("minecraft:sponge", {
      top: baseUrl + "textures/blocks/sponge.png",
      side: baseUrl + "textures/blocks/sponge.png",
      bottom: baseUrl + "textures/blocks/sponge.png",
    });
    // Moss block
    await this._createPerFaceAtlasTemplate("minecraft:moss_block", {
      top: baseUrl + "textures/blocks/moss_block.png",
      side: baseUrl + "textures/blocks/moss_block.png",
      bottom: baseUrl + "textures/blocks/moss_block.png",
    });
    // Mud
    await this._createPerFaceAtlasTemplate("minecraft:mud", {
      top: baseUrl + "textures/blocks/mud.png",
      side: baseUrl + "textures/blocks/mud.png",
      bottom: baseUrl + "textures/blocks/mud.png",
    });
    // Tuff
    await this._createPerFaceAtlasTemplate("minecraft:tuff", {
      top: baseUrl + "textures/blocks/tuff.png",
      side: baseUrl + "textures/blocks/tuff.png",
      bottom: baseUrl + "textures/blocks/tuff.png",
    });
    // Deepslate (multi-face, in subfolder)
    await this._createPerFaceAtlasTemplate("minecraft:deepslate", {
      top: baseUrl + "textures/blocks/deepslate/deepslate_top.png",
      side: baseUrl + "textures/blocks/deepslate/deepslate.png",
      bottom: baseUrl + "textures/blocks/deepslate/deepslate_top.png",
    });
    // Red sandstone (multi-face)
    await this._createPerFaceAtlasTemplate("minecraft:red_sandstone", {
      top: baseUrl + "textures/blocks/red_sandstone_top.png",
      side: baseUrl + "textures/blocks/red_sandstone_normal.png",
      bottom: baseUrl + "textures/blocks/red_sandstone_bottom.png",
    });
    // Dark prismarine
    await this._createPerFaceAtlasTemplate("minecraft:dark_prismarine", {
      top: baseUrl + "textures/blocks/prismarine_dark.png",
      side: baseUrl + "textures/blocks/prismarine_dark.png",
      bottom: baseUrl + "textures/blocks/prismarine_dark.png",
    });

    Log.debug("ChunkMeshBuilder: Atlas templates created for 101 block types");
  }

  /**
   * Load an image from URL. Returns a Promise that resolves with the loaded HTMLImageElement.
   */
  private _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image: " + url));
      img.src = url;
    });
  }

  /**
   * Create a per-face atlas template mesh for a block type.
   * Composites top, side, and bottom textures into a 3-column atlas (48×16 pixels),
   * applies biome tint to the top region if provided, and creates a CreateBox with
   * faceUV mapping each face to its correct atlas region.
   *
   * For grass blocks: grass_side.png has ALPHA TRANSPARENCY in the green overlay strip.
   * We must first draw dirt.png as the side face background, then composite grass_side
   * on top. Otherwise, semi-transparent green pixels render as dark/black.
   *
   * Babylon.js CreateBox face indices: 0=back(-Z), 1=front(+Z), 2=right(+X), 3=left(-X), 4=top(+Y), 5=bottom(-Y)
   */
  private async _createPerFaceAtlasTemplate(
    blockName: string,
    texUrls: { top: string; side: string; bottom: string },
    topBiomeTint?: BABYLON.Color3
  ): Promise<void> {
    try {
      const [topImg, sideImg, bottomImg] = await Promise.all([
        this._loadImage(texUrls.top),
        this._loadImage(texUrls.side),
        this._loadImage(texUrls.bottom),
      ]);

      // Create atlas canvas: 3 columns, each 16×16 pixels
      const cellSize = 16;
      const canvas = document.createElement("canvas");
      canvas.width = cellSize * 3;
      canvas.height = cellSize;
      const ctx = canvas.getContext("2d")!;

      // Determine if all faces use the same texture (e.g., leaves, ores, stone).
      // When they differ (grass_block), column 1 uses dirt as opaque background
      // with the side texture composited on top (fixes green overlay alpha issue).
      const allFacesSameTexture = texUrls.top === texUrls.side && texUrls.side === texUrls.bottom;

      // Column 0: Top face texture
      ctx.drawImage(topImg, 0, 0, cellSize, cellSize);

      // Column 1: Side face
      if (allFacesSameTexture) {
        // Same texture on all faces (leaves, uniform blocks): draw once to preserve alpha
        ctx.drawImage(sideImg, cellSize, 0, cellSize, cellSize);
      } else {
        // Different textures (grass_block): grass_side.png has a semi-transparent grayscale
        // overlay strip. In Minecraft, this overlay is tinted with the biome color BEFORE
        // compositing onto dirt. We replicate that by tinting the overlay on a temp canvas
        // first, then compositing onto the dirt background. Without this, the grayscale
        // overlay blends into brownish-gray and never receives biome tinting.
        ctx.drawImage(bottomImg, cellSize, 0, cellSize, cellSize); // dirt background

        if (topBiomeTint) {
          // Tint the side overlay before compositing: draw grass_side.png to a temp canvas,
          // multiply its RGB by the biome tint (preserving alpha), then composite onto dirt.
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = cellSize;
          tmpCanvas.height = cellSize;
          const tmpCtx = tmpCanvas.getContext("2d")!;
          tmpCtx.drawImage(sideImg, 0, 0, cellSize, cellSize);

          const overlayData = tmpCtx.getImageData(0, 0, cellSize, cellSize);
          const od = overlayData.data;
          for (let i = 0; i < od.length; i += 4) {
            if (od[i + 3] > 0) {
              // Only tint pixels that have some alpha (the grass overlay portion).
              // Fully transparent pixels are the dirt-show-through areas.
              od[i] = Math.min(255, Math.round(od[i] * topBiomeTint.r));
              od[i + 1] = Math.min(255, Math.round(od[i + 1] * topBiomeTint.g));
              od[i + 2] = Math.min(255, Math.round(od[i + 2] * topBiomeTint.b));
            }
          }
          tmpCtx.putImageData(overlayData, 0, 0);

          ctx.drawImage(tmpCanvas, cellSize, 0, cellSize, cellSize); // tinted overlay
        } else {
          ctx.drawImage(sideImg, cellSize, 0, cellSize, cellSize); // untinted overlay
        }
      }

      // Column 2: Bottom face
      ctx.drawImage(bottomImg, cellSize * 2, 0, cellSize, cellSize);

      // Apply biome tint
      if (topBiomeTint) {
        // When all faces are the same grayscale texture (leaves), we tint ALL columns uniformly.
        // When faces differ (grass_block), sides are already tinted above during compositing.

        // Tint top face (column 0): always apply full biome tint
        const topData = ctx.getImageData(0, 0, cellSize, cellSize);
        const td = topData.data;
        for (let i = 0; i < td.length; i += 4) {
          td[i] = Math.min(255, Math.round(td[i] * topBiomeTint.r));
          td[i + 1] = Math.min(255, Math.round(td[i + 1] * topBiomeTint.g));
          td[i + 2] = Math.min(255, Math.round(td[i + 2] * topBiomeTint.b));
        }
        ctx.putImageData(topData, 0, 0);

        if (allFacesSameTexture) {
          // Leaves / uniform blocks: tint side and bottom columns identically
          const sideData = ctx.getImageData(cellSize, 0, cellSize, cellSize);
          const sd = sideData.data;
          for (let i = 0; i < sd.length; i += 4) {
            sd[i] = Math.min(255, Math.round(sd[i] * topBiomeTint.r));
            sd[i + 1] = Math.min(255, Math.round(sd[i + 1] * topBiomeTint.g));
            sd[i + 2] = Math.min(255, Math.round(sd[i + 2] * topBiomeTint.b));
          }
          ctx.putImageData(sideData, cellSize, 0);

          const bottomData = ctx.getImageData(cellSize * 2, 0, cellSize, cellSize);
          const bd = bottomData.data;
          for (let i = 0; i < bd.length; i += 4) {
            bd[i] = Math.min(255, Math.round(bd[i] * topBiomeTint.r));
            bd[i + 1] = Math.min(255, Math.round(bd[i + 1] * topBiomeTint.g));
            bd[i + 2] = Math.min(255, Math.round(bd[i + 2] * topBiomeTint.b));
          }
          ctx.putImageData(bottomData, cellSize * 2, 0);
        }
        // Note: grass_block sides are already tinted above during the compositing step.
      }

      // NOTE: Edge darkening removed — it created visible dark grid lines between
      // adjacent same-type blocks (especially visible on grass terrain from above).
      // Minecraft achieves block definition through ambient occlusion per-vertex,
      // not through texture edge darkening. The face shading (_applyFaceShading)
      // already provides directional depth cues.

      // Detect if this atlas needs alpha (leaves, glass-like blocks)
      const needsAlpha = blockName.includes("leaves");

      // Create Babylon.js texture from canvas.
      // For blocks with alpha (leaves), use RawTexture.CreateRGBATexture which uploads
      // raw pixel bytes directly to the GPU — this is the most direct pipeline and
      // guarantees alpha channel preservation (no data URL encode/decode, no intermediate
      // canvas operations). For opaque blocks, use data URL for simplicity.
      let texture: BABYLON.Texture;
      if (needsAlpha) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const rawBytes = new Uint8Array(imageData.data.buffer);
        texture = BABYLON.RawTexture.CreateRGBATexture(
          rawBytes,
          canvas.width,
          canvas.height,
          this._scene,
          false, // generateMipMaps
          false, // invertY
          BABYLON.Texture.NEAREST_SAMPLINGMODE
        );
        texture.hasAlpha = true;
        texture.anisotropicFilteringLevel = 1;
      } else {
        const dataUrl = canvas.toDataURL("image/png");
        texture = new BABYLON.Texture(dataUrl, this._scene, true, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
        texture.hasAlpha = false;
        texture.anisotropicFilteringLevel = 1;
      }

      // Debug: verify alpha channel in the atlas canvas for leaves
      if (blockName.includes("leaves")) {
        const debugData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dd = debugData.data;
        let transparentCount = 0;
        let opaqueCount = 0;
        for (let i = 3; i < dd.length; i += 4) {
          if (dd[i] < 128) transparentCount++;
          else opaqueCount++;
        }
        Log.verbose(
          `ChunkMeshBuilder atlas debug: ${blockName} canvas=${canvas.width}x${canvas.height} transparent=${transparentCount} opaque=${opaqueCount} hasAlphaHoles=${transparentCount > 0}`
        );
      }

      // faceUV mapping: each face maps to its atlas column
      const topUV = new BABYLON.Vector4(0, 0, 1 / 3, 1); // Column 0: top texture
      const sideUV = new BABYLON.Vector4(1 / 3, 0, 2 / 3, 1); // Column 1: side texture
      const bottomUV = new BABYLON.Vector4(2 / 3, 0, 1, 1); // Column 2: bottom texture

      const faceUV = [
        sideUV, // 0: back (-Z)
        sideUV, // 1: front (+Z)
        sideUV, // 2: right (+X)
        sideUV, // 3: left (-X)
        topUV, // 4: top (+Y)
        bottomUV, // 5: bottom (-Y)
      ];

      // Store faceUV array so it can be re-applied to fresh CreateBox meshes in buildChunkMesh.
      // The template mesh itself is invisible — only the chunk meshes are rendered, so they
      // need the same faceUV mapping to correctly show atlas regions per face.
      this._atlasFaceUVs.set(blockName, faceUV);

      const shortName = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
      // Asymmetric Y inflation: height=1.002 with position offset -0.001 so top face
      // stays at the natural Y+1 boundary (no green bleed-through) while bottom extends
      // 0.002 below (seals vertical gaps between stacked blocks).
      const tmpl = BABYLON.MeshBuilder.CreateBox(
        "tmpl_" + shortName,
        {
          width: 1.002,
          height: 1.002,
          depth: 1.002,
          faceUV: faceUV,
          wrap: true,
        },
        this._scene
      );

      const mat = new BABYLON.StandardMaterial("mat_atlas_" + shortName, this._scene);
      mat.diffuseTexture = texture;
      mat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
      mat.backFaceCulling = true;
      mat.zOffset = -2;

      // Global minimum emissive: ensures all block faces have minimum visibility
      // even in shadowed areas (e.g., ceiling viewed from below). Without this,
      // faces pointing away from the directional sun receive near-zero light,
      // appearing black even with hemispheric ambient lighting.
      mat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);

      // Biome-tinted blocks (grass, leaves): use a slightly green-tinted emissive
      // that provides minimum brightness without washing out the natural color.
      // Raised from (0.14,0.18,0.08) to prevent dark appearance in early morning.
      if (topBiomeTint) {
        mat.emissiveColor = new BABYLON.Color3(0.16, 0.22, 0.1);
      }

      // Water: enable alpha transparency for see-through rendering.
      // (Glass is handled separately by _createGlassAtlasTemplate with procedural texture.)
      const isTransparent = blockName === "minecraft:water";
      if (isTransparent) {
        texture.hasAlpha = true;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.backFaceCulling = false;
        mat.alpha = 0.55;
      }

      // Leaves: enable alpha test (cutout) so transparent pixels between leaves
      // are discarded instead of rendering as black. Uses ALPHATEST mode with a
      // threshold — pixels below the cutoff are fully discarded, pixels above are
      // fully opaque. Also disable backFaceCulling so leaves are visible from both sides.
      const isLeaves = blockName.includes("leaves");
      if (isLeaves) {
        texture.hasAlpha = true;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
        mat.alphaCutOff = 0.5;
        mat.backFaceCulling = false;
        // CRITICAL: tell StandardMaterial to source per-pixel alpha from the diffuse
        // texture's alpha channel. Without this, the alpha test runs against the
        // material's global alpha (1.0) and never discards any pixels.
        mat.useAlphaFromDiffuseTexture = true;
        Log.verbose(
          `ChunkMeshBuilder: ${blockName} leaf material: hasAlpha=${texture.hasAlpha} transparencyMode=${mat.transparencyMode} alphaCutOff=${mat.alphaCutOff} useAlphaFromDiffuse=${mat.useAlphaFromDiffuseTexture}`
        );
      }

      // Apply face shading vertex colors on template for reference.
      this._applyFaceShading(tmpl, isTransparent);

      // NOTE: Do NOT freeze the material here. The template mesh is never rendered
      // (setEnabled=false). Chunk meshes get fresh CreateBox instances with the same
      // material but different vertex buffers (including face shading vertex colors).
      // Freezing would lock the shader compilation state before vertex colors are set
      // on the actual rendered chunk mesh, causing vertex colors to be ignored and
      // bottom faces to appear black.
      tmpl.material = mat;

      tmpl.setEnabled(false);
      this._templateMeshes.set(blockName, tmpl);
    } catch (e) {
      Log.debug("Failed to create per-face atlas for " + blockName + ": " + e);
    }
  }

  /**
   * Create a procedural glass atlas template.
   * Instead of loading the vanilla glass.png (which is nearly fully transparent and causes
   * black rendering artifacts with thin instances + needDepthPrePass), we generate a light
   * blue glass texture with white grid lines, and use mat.alpha for overall transparency.
   */
  private async _createGlassAtlasTemplate(): Promise<void> {
    try {
      const cellSize = 16;
      const canvas = document.createElement("canvas");
      canvas.width = cellSize * 3;
      canvas.height = cellSize;
      const ctx = canvas.getContext("2d")!;

      // Draw procedural glass pattern for each of the 3 atlas columns (top, side, bottom)
      for (let cellIdx = 0; cellIdx < 3; cellIdx++) {
        const ox = cellIdx * cellSize;
        // Fill with light blue-white tint (opaque — transparency via mat.alpha)
        ctx.fillStyle = "rgb(210, 230, 255)";
        ctx.fillRect(ox, 0, cellSize, cellSize);

        // Draw white grid lines at the borders (1px wide)
        const imgData = ctx.getImageData(ox, 0, cellSize, cellSize);
        const d = imgData.data;
        for (let py = 0; py < cellSize; py++) {
          for (let px = 0; px < cellSize; px++) {
            const isEdge = px === 0 || px === cellSize - 1 || py === 0 || py === cellSize - 1;
            if (isEdge) {
              const idx = (py * cellSize + px) * 4;
              d[idx] = 255; // white
              d[idx + 1] = 255;
              d[idx + 2] = 255;
              d[idx + 3] = 255;
            }
          }
        }
        ctx.putImageData(imgData, ox, 0);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const texture = new BABYLON.Texture(dataUrl, this._scene, true, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
      texture.hasAlpha = false; // Texture is fully opaque; transparency via mat.alpha
      texture.anisotropicFilteringLevel = 1;

      const topUV = new BABYLON.Vector4(0, 0, 1 / 3, 1);
      const sideUV = new BABYLON.Vector4(1 / 3, 0, 2 / 3, 1);
      const bottomUV = new BABYLON.Vector4(2 / 3, 0, 1, 1);
      const faceUV = [sideUV, sideUV, sideUV, sideUV, topUV, bottomUV];
      this._atlasFaceUVs.set("minecraft:glass", faceUV);

      const tmpl = BABYLON.MeshBuilder.CreateBox(
        "tmpl_glass",
        {
          width: 1.002,
          height: 1.002,
          depth: 1.002,
          faceUV: faceUV,
          wrap: true,
        },
        this._scene
      );

      const mat = new BABYLON.StandardMaterial("mat_atlas_glass", this._scene);
      mat.diffuseTexture = texture;
      mat.diffuseColor = new BABYLON.Color3(0.8, 0.88, 1.0);
      mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      mat.emissiveColor = new BABYLON.Color3(0.15, 0.18, 0.22);
      mat.backFaceCulling = false; // Glass must render from BOTH sides (inside + outside)
      mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
      mat.alpha = 0.28; // Semi-transparent glass — shows what's behind
      // NO needDepthPrePass — avoids the black-rectangle artifact
      mat.zOffset = -2;

      mat.freeze();
      tmpl.material = mat;
      this._applyFaceShading(tmpl, true); // Gentle face shading for transparent blocks
      tmpl.setEnabled(false);
      this._templateMeshes.set("minecraft:glass", tmpl);
    } catch (e) {
      Log.debug("Failed to create glass atlas template: " + e);
    }
  }

  /**
   * Build meshes for a chunk column using thin instances per block type.
   * Uses BlockMeshFactory for textured template meshes when available.
   */
  buildChunkMesh(
    chunk: IChunkColumn,
    getBlockName: (runtimeId: number) => string,
    minY: number = -64
  ): IChunkMeshResult {
    const chunkWorldX = chunk.x * 16;
    const chunkWorldZ = chunk.z * 16;

    // Collect visible blocks grouped by type
    // Per-face exposure flags: [+X, -X, +Y, -Y, +Z, -Z]
    const blocksByType = new Map<string, { x: number; y: number; z: number; faces: boolean[] }[]>();
    let blockCount = 0;

    // Precompute graduated Y culling constants to avoid recalculation per block.
    const hasRadialCulling = this.maxRenderRadius < Infinity;
    const maxRadSq = this.maxRenderRadius * this.maxRenderRadius;
    const nearRadSq = this.nearRenderRadius * this.nearRenderRadius;
    const radRangeInv = maxRadSq > nearRadSq ? 1 / (maxRadSq - nearRadSq) : 0;
    const yRange = this.maxRenderY - this.groundRenderY;
    const fogCullDistSq = this.fogCullDistSq;

    for (let sci = 0; sci < chunk.subchunks.length; sci++) {
      const subchunk = chunk.subchunks[sci];
      if (!subchunk) continue;
      const subchunkWorldY = minY + sci * 16;

      // Performance: skip deep underground subchunks (below Y=40).
      // These are mostly solid stone and cave walls — rendering them
      // is wasteful since they're rarely visible from the surface.
      // Y=40 safely keeps the surface layer (Y=48+, ground at Y=63).
      if (subchunkWorldY < 40) continue;

      for (let ly = 0; ly < 16; ly++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let lx = 0; lx < 16; lx++) {
            // Bedrock SubChunk storage order is XZY: index = x*256 + z*16 + y
            const runtimeId = subchunk.blocks[lx * 256 + lz * 16 + ly];

            if (runtimeId === 0) continue;

            const blockName = getBlockName(runtimeId);
            if (!blockName || blockName === "minecraft:air") continue;
            if (this._isNonRenderable(blockName)) continue;

            const worldY = subchunkWorldY + ly;

            // Skip blocks above maxRenderY (eliminates natural terrain above cleared area)
            if (worldY > this.maxRenderY) continue;

            const worldX = chunkWorldX + lx;
            const worldZ = chunkWorldZ + lz;

            // Radial culling: skip blocks beyond maxRenderRadius from render center.
            // Eliminates terrain walls at edges regardless of SubChunk data race timing.
            if (hasRadialCulling) {
              const dx = worldX - this.renderCenterX;
              const dz = worldZ - this.renderCenterZ;
              const distSq = dx * dx + dz * dz;
              if (distSq > maxRadSq) continue;
              // Hard fog-cull: skip blocks beyond ~85% fog distance.
              // These would render as opaque fog-colored rectangles visible against the sky.
              if (distSq > fogCullDistSq) continue;

              // Graduated distance-dependent Y culling: smoothly interpolate the
              // effective maxY from maxRenderY (at nearRenderRadius) down to
              // groundRenderY (at maxRenderRadius). This eliminates staircase
              // artifacts from the old binary cutoff and prevents distant terrain
              // from forming visible walls against the sky gradient.
              if (distSq > nearRadSq) {
                const t = Math.min(1, (distSq - nearRadSq) * radRangeInv);
                const effectiveMaxY = this.maxRenderY - t * yRange;
                if (worldY > effectiveMaxY) continue;
              }
            }

            // Water surface-only: only render water blocks with non-water above.
            // This prevents rendering water planes inside water columns.
            const short = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
            if (short.includes("water")) {
              const aboveBlockName = this._getBlockAbove(chunk, sci, lx, ly, lz, getBlockName);
              if (aboveBlockName && aboveBlockName.includes("water")) continue;
            }

            // Face culling: check if block has any exposed face
            if (!this._hasExposedFace(chunk, sci, lx, ly, lz, getBlockName, blockName)) continue;

            // Per-face exposure: compute which of the 6 faces are exposed.
            // Order: [+X, -X, +Y, -Y, +Z, -Z]
            const faces = this._computeFaceExposure(chunk, sci, lx, ly, lz, getBlockName, blockName);

            // Simplify block type to reduce unique mesh count
            const renderName = ChunkMeshBuilder._BLOCK_SIMPLIFY[blockName] || blockName;

            let list = blocksByType.get(renderName);
            if (!list) {
              list = [];
              blocksByType.set(renderName, list);
            }
            list.push({ x: worldX, y: worldY, z: worldZ, faces });
            blockCount++;
          }
        }
      }
    }

    // Create meshes using thin instances per block type
    const meshes: BABYLON.Mesh[] = [];
    this._buildCount++;

    if (this._buildCount <= 2 || (this._buildCount <= 200 && this._buildCount % 100 === 0)) {
      Log.verbose(
        `ChunkMeshBuilder[${this._buildCount}]: chunk(${chunk.x},${chunk.z}) blockTypes=${blocksByType.size} totalBlocks=${blockCount} hasMeshFactory=${!!this._meshFactory} hasRenderDb=${!!this._renderDb}`
      );
      if (blocksByType.size > 0) {
        const typeNames = Array.from(blocksByType.keys()).slice(0, 10);
        Log.verbose(`ChunkMeshBuilder: first block types: ${typeNames.join(", ")}`);
      }
    }

    for (const [blockName, positions] of blocksByType) {
      if (positions.length === 0) continue;

      const mesh = this._getOrCreateTemplateMesh(blockName);
      if (!mesh) continue;

      const isBillboard = this._billboardTemplates.has(blockName);

      if (isBillboard) {
        // Billboard meshes now have merged geometry (no child planes), so thin instances
        // work directly with the textured template. Limit per chunk for performance.
        const MAX_BILLBOARD_PER_CHUNK = 200;
        const billboardPositions =
          positions.length > MAX_BILLBOARD_PER_CHUNK ? positions.slice(0, MAX_BILLBOARD_PER_CHUNK) : positions;

        // Clone the template for this chunk's billboard batch
        const bbMesh = mesh.clone(`bb_${blockName}_${this._buildCount}`);
        if (!bbMesh) continue;
        bbMesh.setEnabled(true);
        bbMesh.material = mesh.material;

        if (billboardPositions.length === 1) {
          bbMesh.position = new BABYLON.Vector3(
            billboardPositions[0].x + 0.5,
            billboardPositions[0].y + 0.5,
            billboardPositions[0].z + 0.5
          );
          bbMesh.isPickable = false;
          bbMesh.freezeWorldMatrix();
          meshes.push(bbMesh);
        } else {
          // Use createInstance() rather than thin instances. Thin instances
          // intermittently rendered freshly-cloned billboard chunks as a single
          // giant tilted opaque rectangle covering half the canvas — the buffer
          // upload appeared to interact poorly with Babylon's shader-effect
          // cache for newly-cloned alpha-cutout vegetation meshes (run20260506
          // second-pass F1). createInstance() produces one InstancedMesh per
          // billboard which shares the template geometry but each gets its own
          // world matrix, sidestepping the issue. The cost is N InstancedMesh
          // objects per chunk rather than one mesh + N matrices, which for the
          // ≤200 billboards per chunk is acceptable.
          for (let i = 0; i < billboardPositions.length; i++) {
            const inst = bbMesh.createInstance(`${bbMesh.name}_i${i}`);
            inst.position = new BABYLON.Vector3(
              billboardPositions[i].x + 0.5,
              billboardPositions[i].y + 0.5,
              billboardPositions[i].z + 0.5
            );
            inst.isPickable = false;
            inst.freezeWorldMatrix();
          }
          // The parent bbMesh is the geometry source; hide it so it doesn't
          // also render at world origin. Disposing bbMesh later auto-disposes
          // its InstancedMesh children, so we don't track them separately.
          bbMesh.isVisible = false;
          bbMesh.isPickable = false;
          meshes.push(bbMesh);
        }
        continue;
      }

      // Build merged mesh with per-face culling: only render faces adjacent to air/transparent.
      // This eliminates Z-fighting between stacked blocks (e.g. wall top + ceiling bottom)
      // and reduces vertex count by ~40% compared to rendering all 6 faces.
      const atlasFaceUVs = this._atlasFaceUVs.get(blockName);
      const chunkMesh = this._buildFaceCulledMesh(chunk, blockName, positions, mesh, atlasFaceUVs);
      if (chunkMesh) {
        meshes.push(chunkMesh);
      }
    }

    return { chunkX: chunk.x, chunkZ: chunk.z, meshes, blockCount };
  }

  /**
   * Get or create a template mesh for a block type.
   * Uses BlockMeshFactory (shared with VolumeEditor) when available,
   * falls back to colored boxes via BlockRenderDatabase.
   * Handles transparent blocks (water, leaves, glass) with special materials.
   * Shape-aware: creates billboards for flowers, half-blocks for slabs, etc.
   */
  private _getOrCreateTemplateMesh(blockName: string): BABYLON.Mesh | undefined {
    let tmpl = this._templateMeshes.get(blockName);
    if (tmpl) return tmpl;

    const shortName = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;

    // Water: render as a flat surface plane (top face only) sitting at the top of the water block.
    // This mimics Minecraft's water surface appearance — you see the surface from above,
    // and it doesn't occlude underwater terrain visibility from the side.
    if (shortName.includes("water")) {
      tmpl = BABYLON.MeshBuilder.CreateGround("tmpl_" + shortName, { width: 1, height: 1 }, this._scene);
      // Position at top of block (0.5 up from center, minus small offset to prevent z-fighting)
      tmpl.position.y = 0.38;
      const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
      mat.diffuseColor = new BABYLON.Color3(0.18, 0.42, 0.85);
      mat.alpha = 0.55;
      mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.5);
      mat.specularPower = 64;
      mat.backFaceCulling = false;
      mat.zOffset = 1;
      tmpl.material = mat;
      tmpl.setEnabled(false);
      this._templateMeshes.set(blockName, tmpl);
      return tmpl;
    }

    // Lava: opaque glowing orange
    if (shortName.includes("lava")) {
      tmpl = BABYLON.MeshBuilder.CreateBox("tmpl_" + shortName, { size: 1 }, this._scene);
      const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
      mat.diffuseColor = new BABYLON.Color3(0.9, 0.4, 0.05);
      mat.emissiveColor = new BABYLON.Color3(0.8, 0.3, 0.02);
      mat.specularColor = new BABYLON.Color3(0.1, 0.05, 0.02);
      mat.backFaceCulling = false;
      tmpl.material = mat;
      tmpl.setEnabled(false);
      this._templateMeshes.set(blockName, tmpl);
      return tmpl;
    }

    // Track whether this is a billboard (skip face shading — plants are uniformly lit)
    let isBillboard = false;

    // Primary path: use BlockMeshFactory for shape-aware rendering
    const useMeshFactory = true;
    if (useMeshFactory && this._meshFactory) {
      const shape = this._meshFactory.getBlockShape(shortName);

      // Force certain blocks to specific shapes regardless of catalog
      const isVine = shortName.includes("vine");
      const isLilyPad = shortName === "lily_pad";
      const isLeafLitter = shortName === "leaf_litter";
      const isPressurePlate = shortName.includes("pressure_plate");
      const isSign = shortName.includes("sign");
      const isBanner = shortName.includes("banner");
      const isBush =
        shortName === "bush" || shortName === "dead_bush" || shortName === "azalea" || shortName === "flowering_azalea";
      const isBamboo = shortName === "bamboo";
      const isKelp = shortName === "kelp";
      const isSeagrass = shortName === "seagrass" || shortName === "tall_seagrass";
      const isCoral = shortName.includes("coral") && !shortName.includes("block");
      const isFlower =
        (shortName.includes("flower") && !shortName.includes("pot") && !shortName.includes("azalea")) ||
        shortName === "poppy" ||
        shortName === "dandelion" ||
        shortName === "blue_orchid" ||
        shortName === "allium" ||
        shortName === "azure_bluet" ||
        shortName === "cornflower" ||
        shortName === "lily_of_the_valley" ||
        shortName === "wither_rose" ||
        shortName.includes("tulip") ||
        shortName === "oxeye_daisy" ||
        shortName === "sunflower" ||
        shortName === "lilac" ||
        shortName === "rose_bush" ||
        shortName === "peony";
      const isGrassPlant =
        shortName === "short_grass" ||
        shortName === "tall_grass" ||
        shortName === "tallgrass" ||
        shortName === "fern" ||
        shortName === "large_fern" ||
        shortName === "double_plant";
      const isSapling = shortName.includes("sapling");
      const isMushroom = shortName.includes("mushroom") && !shortName.includes("block") && !shortName.includes("stem");
      const isSweetBerry = shortName === "sweet_berry_bush";
      const isCropLike =
        shortName === "wheat" ||
        shortName === "carrots" ||
        shortName === "potatoes" ||
        shortName === "beetroots" ||
        shortName === "nether_wart" ||
        shortName === "melon_stem" ||
        shortName === "pumpkin_stem";
      const isForcedBillboard = isFlower || isGrassPlant || isSapling || isMushroom || isSweetBerry || isCropLike;
      const isTorch = shortName.includes("torch") && !shortName.includes("torchflower");
      const isRail = shortName.includes("rail");
      const isButton = shortName.includes("button");
      const isDoor = shortName.includes("door") && !shortName.includes("trapdoor");
      const isTrapdoor = shortName.includes("trapdoor");
      const isLadder = shortName === "ladder";
      const isChain = shortName === "chain";
      const isLantern = shortName === "lantern" || shortName === "soul_lantern";

      if (isTorch) {
        // Torch: brown wooden stick with emissive flame tip.
        // Built as merged mesh with vertex colors for thin-instance compatibility.
        isBillboard = true;
        const isSoul = shortName.includes("soul");
        const stickW = 0.125,
          stickH = 0.5,
          stickD = 0.125;
        const flameW = 0.1875,
          flameH = 0.1875,
          flameD = 0.1875;

        const stick = BABYLON.MeshBuilder.CreateBox(
          "torch_stick",
          { width: stickW, height: stickH, depth: stickD },
          this._scene
        );
        stick.position.y = -0.5 + stickH / 2;
        stick.bakeCurrentTransformIntoVertices();

        const flame = BABYLON.MeshBuilder.CreateBox(
          "torch_flame",
          { width: flameW, height: flameH, depth: flameD },
          this._scene
        );
        flame.position.y = -0.5 + stickH + flameH / 2;
        flame.bakeCurrentTransformIntoVertices();

        // Vertex colors: brown stick, yellow/cyan flame
        const stickVC = stick.getTotalVertices();
        const stickColors = new Float32Array(stickVC * 4);
        for (let vi = 0; vi < stickVC; vi++) {
          stickColors[vi * 4] = 0.45;
          stickColors[vi * 4 + 1] = 0.3;
          stickColors[vi * 4 + 2] = 0.15;
          stickColors[vi * 4 + 3] = 1;
        }
        stick.setVerticesData(BABYLON.VertexBuffer.ColorKind, stickColors);

        const flameVC = flame.getTotalVertices();
        const flameColors = new Float32Array(flameVC * 4);
        const fr = isSoul ? 0.2 : 1.0,
          fg = isSoul ? 0.85 : 0.75,
          fb = isSoul ? 0.9 : 0.2;
        for (let vi = 0; vi < flameVC; vi++) {
          flameColors[vi * 4] = fr;
          flameColors[vi * 4 + 1] = fg;
          flameColors[vi * 4 + 2] = fb;
          flameColors[vi * 4 + 3] = 1;
        }
        flame.setVerticesData(BABYLON.VertexBuffer.ColorKind, flameColors);

        tmpl = BABYLON.Mesh.MergeMeshes([stick, flame], true, true, undefined, false, true) ?? undefined;
        if (tmpl) {
          tmpl.name = "tmpl_" + shortName;
          const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
          mat.diffuseColor = BABYLON.Color3.White();
          mat.emissiveColor = isSoul ? new BABYLON.Color3(0.1, 0.3, 0.35) : new BABYLON.Color3(0.4, 0.3, 0.1);
          mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
          (mat as any).useVertexColors = true;
          tmpl.material = mat;
        }
      } else if (isRail) {
        // Rail: flat plane on top of block below
        isBillboard = true;
        tmpl = BABYLON.MeshBuilder.CreatePlane("tmpl_" + shortName, { size: 1 }, this._scene);
        tmpl.rotation.x = Math.PI / 2; // Lie flat
        tmpl.position.y = -0.48; // Slightly above the floor
        const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
        if (shortName.includes("powered") || shortName.includes("activator")) {
          mat.diffuseColor = new BABYLON.Color3(0.7, 0.15, 0.15); // Red rail
        } else if (shortName.includes("detector")) {
          mat.diffuseColor = new BABYLON.Color3(0.5, 0.15, 0.15);
        } else {
          mat.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.25); // Iron rail
        }
        mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        mat.backFaceCulling = false;
        tmpl.material = mat;
      } else if (isButton) {
        // Button: tiny block on the face of another block
        isBillboard = true;
        tmpl = BABYLON.MeshBuilder.CreateBox(
          "tmpl_" + shortName,
          { width: 0.375, height: 0.25, depth: 0.125 },
          this._scene
        );
        tmpl.position.y = -0.25;
        const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
        mat.diffuseColor = shortName.includes("stone")
          ? new BABYLON.Color3(0.5, 0.5, 0.5)
          : new BABYLON.Color3(0.6, 0.4, 0.2);
        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        tmpl.material = mat;
      } else if (isDoor) {
        // Door: thin panel (0.1875 × 2 × 1) — covers full block height, thin depth
        tmpl = this._meshFactory.createTexturedBlockMesh("tmpl_" + shortName, shortName) ?? undefined;
        // If mesh factory returned a full block, scale to thin panel
        if (tmpl) {
          tmpl.scaling.z = 0.1875;
          tmpl.position.z = 0.5 - 0.1875 / 2;
        }
      } else if (isTrapdoor) {
        // Trapdoor: thin flat panel when closed
        tmpl = this._meshFactory.createTexturedSlabMesh("tmpl_" + shortName, shortName) ?? undefined;
        if (tmpl) {
          tmpl.scaling.y = 0.375; // Thinner than normal slab
        }
      } else if (isLadder) {
        // Ladder: flat plane on a wall face
        isBillboard = true;
        tmpl = this._meshFactory.createTexturedBillboardMesh("tmpl_" + shortName, shortName) ?? undefined;
      } else if (isChain || isLantern) {
        // Chain/Lantern: small centered block
        isBillboard = true;
        const size = isChain ? 0.125 : 0.375;
        const height = isChain ? 1.0 : 0.5;
        tmpl = BABYLON.MeshBuilder.CreateBox(
          "tmpl_" + shortName,
          { width: size, height: height, depth: size },
          this._scene
        );
        if (isLantern) tmpl.position.y = -0.25;
        const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
        mat.diffuseColor = isChain ? new BABYLON.Color3(0.35, 0.35, 0.35) : new BABYLON.Color3(0.7, 0.5, 0.2);
        if (isLantern) mat.emissiveColor = new BABYLON.Color3(0.5, 0.35, 0.1);
        mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        tmpl.material = mat;
      } else if (
        shape === BlockShape.billboard ||
        isVine ||
        isBush ||
        isBamboo ||
        isKelp ||
        isSeagrass ||
        isCoral ||
        isForcedBillboard
      ) {
        // Cross/X shape for flowers, saplings, tall grass, mushrooms, vines, bush, bamboo
        isBillboard = true;
        tmpl = this._meshFactory.createTexturedBillboardMesh("tmpl_" + shortName, shortName) ?? undefined;

        // Fallback: if texture lookup failed, create a colored billboard cross
        if (!tmpl) {
          tmpl = this._createColoredBillboardCross(shortName);
        }
      } else if (
        shape === BlockShape.slab ||
        shortName.includes("snow_layer") ||
        shortName.includes("carpet") ||
        isLilyPad ||
        isLeafLitter ||
        isPressurePlate
      ) {
        // Half-height slab (also used for snow_layer, carpet, lily_pad, leaf_litter, pressure_plate)
        tmpl = this._meshFactory.createTexturedSlabMesh("tmpl_" + shortName, shortName) ?? undefined;
      } else if (isSign || isBanner) {
        // Signs and banners — render as thin panels (slab-like)
        tmpl = this._meshFactory.createTexturedSlabMesh("tmpl_" + shortName, shortName) ?? undefined;
      } else if (shape === BlockShape.stairs) {
        // Stair shape — rendered as full cube for now (stair rotation needs block state)
        tmpl = this._meshFactory.createTexturedBlockMesh("tmpl_" + shortName, shortName) ?? undefined;
      } else if (shape === BlockShape.fence || shape === BlockShape.fenceGate || shape === BlockShape.wall) {
        // Fence/wall — render as thin center post (without connections)
        tmpl = this._meshFactory.createTexturedFencePostMesh("tmpl_" + shortName, shortName) ?? undefined;
      } else {
        // Full cube (default) — covers unitCube, leaves, log, stairs (as cubes for now), etc.
        // forceSingleMaterial=true: prevents MultiMaterial creation which is incompatible
        // with thin instance rendering used by the chunk mesh pipeline.
        // preferTopFace=true for grass_block: uses grass_carried (top) texture instead of
        // grass_side, since the top face is what's most visible in the world.
        const isGrassBlock = shortName.includes("grass") && shortName.includes("block");
        tmpl =
          this._meshFactory.createTexturedBlockMesh("tmpl_" + shortName, shortName, true, isGrassBlock) ?? undefined;
      }
    }

    // Fallback: colored box from BlockRenderDatabase
    if (!tmpl) {
      tmpl = BABYLON.MeshBuilder.CreateBox("tmpl_" + shortName, { size: 1 }, this._scene);
      const mat = new BABYLON.StandardMaterial("mat_" + shortName, this._scene);
      const color = this._renderDb
        ? this._renderDb.getBlockColor(blockName)
        : ([0.5, 0.45, 0.5] as [number, number, number]);
      mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
      mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
      mat.backFaceCulling = true;

      // Leaves/glass: enable alpha from texture or make slightly transparent
      if (shortName.includes("leaves") || shortName.includes("glass") || shortName.includes("ice")) {
        mat.backFaceCulling = false;
        if (shortName.includes("glass")) {
          mat.alpha = 0.4;
        }
      }
      tmpl.material = mat;
    }

    // Apply biome tinting — _carried textures (grass, leaves) are bright lime/grayscale
    // and need to be multiplied by biome color for natural appearance.
    // Real Minecraft plains biome grass color: #91BD59 → (0.569, 0.741, 0.349)
    // Since face shading multiplies by 0.5-1.0, we use values close to the actual
    // biome color to avoid overly dark results.
    if (shortName.includes("grass") && shortName.includes("block")) {
      // Grass block: tint with natural biome color. The grass_top texture is grayscale,
      // so the tint IS the visible color. Vanilla plains: #91BD59 (0.57, 0.74, 0.35).
      this._applyBiomeTintTopOnly(tmpl, new BABYLON.Color3(0.65, 0.82, 0.42));
      if (tmpl.material instanceof BABYLON.StandardMaterial) {
        tmpl.material.emissiveColor = new BABYLON.Color3(0.12, 0.2, 0.06);
      }
    }

    // Grass-type billboard plants also need biome tinting
    if (
      shortName === "short_grass" ||
      shortName === "tall_grass" ||
      shortName === "tallgrass" ||
      shortName === "fern" ||
      shortName === "large_fern" ||
      shortName === "double_plant"
    ) {
      this._applyBiomeTint(tmpl, new BABYLON.Color3(0.55, 0.75, 0.38));
    }

    // Leaf biome tinting — leaf textures are grayscale and MUST be multiplied
    // by biome color. Non-carried textures (used with useWorldTextures=true) have
    // alpha cutout holes for foliage shape; carried versions are solid rectangles.
    // Values need to be high enough that the result isn't too dark.
    // Plains biome: #91BD59 = (0.569, 0.741, 0.349)
    if (shortName.includes("leaves")) {
      if (shortName.includes("birch")) {
        this._applyBiomeTint(tmpl, new BABYLON.Color3(0.85, 0.94, 0.64));
      } else if (shortName.includes("spruce")) {
        this._applyBiomeTint(tmpl, new BABYLON.Color3(0.76, 0.9, 0.64));
      } else if (shortName.includes("cherry")) {
        // Cherry leaves are pink — don't tint green
      } else {
        // Oak, jungle, dark_oak, acacia, mangrove, azalea
        this._applyBiomeTint(tmpl, new BABYLON.Color3(0.82, 0.93, 0.6));
      }
    }

    // Vine biome tinting
    if (shortName.includes("vine") || shortName === "bush" || shortName === "leaf_litter") {
      this._applyBiomeTint(tmpl, new BABYLON.Color3(0.78, 0.92, 0.56));
    }

    // For leaves/vine with texture: enable alpha cutout (ALPHATEST) from PNG alpha channel
    if (shortName.includes("leaves") || shortName.includes("vine")) {
      this._applyTransparencySettings(tmpl, true); // alphaTest = cutout
    }
    // For glass/ice: enable alpha blend (smooth semi-transparency)
    if (shortName.includes("glass") || shortName.includes("ice")) {
      this._applyTransparencySettings(tmpl, false); // alphaBlend = smooth
    }

    // Apply Minecraft-style directional face brightness via vertex colors.
    // Skip face shading for billboard meshes (plants are uniformly lit in Minecraft).
    // Also skip face shading entirely for leaves — they are translucent and receive
    // light from all directions (subsurface scattering). Face shading × biome tint
    // made them unacceptably dark. Glass/ice still get gentle shading.
    if (!isBillboard) {
      const isLeaf = shortName.includes("leaves") || shortName.includes("vine") || shortName.includes("leaf_litter");
      if (!isLeaf) {
        const isTransparent = shortName.includes("glass") || shortName.includes("ice");
        this._applyFaceShading(tmpl, isTransparent);
      }
    }

    // Ensure all factory-created materials have minimum emissive brightness.
    // BlockMeshFactory materials default to emissive=(0,0,0) and are frozen, making
    // shadowed faces appear nearly black (no ambient contribution in Babylon.js when
    // material.ambientColor is default (0,0,0)). Unfreeze, set emissive, re-freeze.
    if (tmpl.material instanceof BABYLON.StandardMaterial) {
      const mat = tmpl.material;
      const e = mat.emissiveColor;
      if (e.r < 0.05 && e.g < 0.05 && e.b < 0.05) {
        mat.unfreeze();
        mat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        mat.freeze();
      }
    }

    tmpl.setEnabled(false); // Template mesh is invisible — only instances are rendered
    this._templateMeshes.set(blockName, tmpl);
    if (isBillboard) {
      this._billboardTemplates.add(blockName);
    }
    return tmpl;
  }

  /**
   * Create a cross-shaped (X) billboard mesh for vegetation blocks.
   * Two intersecting planes at 45° angles form an X when viewed from above — the same
   * technique Minecraft uses for tall_grass, flowers, saplings, etc.
   * The merged mesh is a single geometry, fully compatible with thin instances.
   *
   * Plant types get different heights, widths, and colors:
   *   - Grass/ferns: tall, wide, green with darker base gradient
   *   - Flowers: shorter, colored bloom on green stem
   *   - Saplings: medium green cross
   *   - Mushrooms: short, colored cap
   */
  private _createSimplifiedBillboardMesh(blockName: string, _count: number): BABYLON.Mesh | undefined {
    const shortName = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
    const meshName = `bb_${shortName}_${this._buildCount}`;

    // Determine cross dimensions and color based on plant type
    let crossWidth = 0.85; // Width of each plane
    let crossHeight = 0.8; // Height of the cross
    let stemColor: BABYLON.Color3; // Lower portion color (stem/base)
    let topColor: BABYLON.Color3; // Upper portion color (bloom/tip)
    let emissive = BABYLON.Color3.Black();
    let alpha = 0.92;

    if (
      shortName === "short_grass" ||
      shortName === "tallgrass" ||
      shortName === "fern" ||
      shortName === "tall_grass" ||
      shortName === "large_fern" ||
      shortName === "double_plant"
    ) {
      crossWidth = 0.9;
      crossHeight =
        shortName.includes("tall") || shortName.includes("large") || shortName === "double_plant" ? 0.95 : 0.7;
      stemColor = new BABYLON.Color3(0.22, 0.45, 0.1);
      topColor = new BABYLON.Color3(0.38, 0.7, 0.2);
      emissive = new BABYLON.Color3(0.04, 0.08, 0.02);
    } else if (shortName.includes("sapling")) {
      crossWidth = 0.7;
      crossHeight = 0.75;
      stemColor = new BABYLON.Color3(0.35, 0.25, 0.12);
      topColor = new BABYLON.Color3(0.3, 0.58, 0.15);
    } else if (shortName === "dandelion" || shortName === "yellow_flower") {
      crossWidth = 0.6;
      crossHeight = 0.65;
      stemColor = new BABYLON.Color3(0.25, 0.5, 0.12);
      topColor = new BABYLON.Color3(0.95, 0.85, 0.15);
      emissive = new BABYLON.Color3(0.1, 0.08, 0.0);
    } else if (shortName === "poppy" || shortName === "red_flower" || shortName === "rose_bush") {
      crossWidth = 0.6;
      crossHeight = shortName === "rose_bush" ? 0.9 : 0.65;
      stemColor = new BABYLON.Color3(0.2, 0.45, 0.1);
      topColor = new BABYLON.Color3(0.88, 0.12, 0.1);
      emissive = new BABYLON.Color3(0.08, 0.01, 0.01);
    } else if (shortName === "blue_orchid") {
      crossWidth = 0.55;
      crossHeight = 0.6;
      stemColor = new BABYLON.Color3(0.2, 0.42, 0.12);
      topColor = new BABYLON.Color3(0.15, 0.5, 0.88);
    } else if (shortName === "cornflower") {
      crossWidth = 0.55;
      crossHeight = 0.7;
      stemColor = new BABYLON.Color3(0.22, 0.45, 0.12);
      topColor = new BABYLON.Color3(0.3, 0.42, 0.88);
    } else if (shortName === "lily_of_the_valley" || shortName === "oxeye_daisy" || shortName === "white_tulip") {
      crossWidth = 0.5;
      crossHeight = 0.6;
      stemColor = new BABYLON.Color3(0.22, 0.48, 0.12);
      topColor = new BABYLON.Color3(0.92, 0.94, 0.88);
    } else if (shortName.includes("tulip")) {
      crossWidth = 0.5;
      crossHeight = 0.65;
      stemColor = new BABYLON.Color3(0.2, 0.45, 0.1);
      topColor = shortName.includes("orange")
        ? new BABYLON.Color3(0.92, 0.55, 0.12)
        : shortName.includes("pink")
          ? new BABYLON.Color3(0.9, 0.5, 0.6)
          : shortName.includes("red")
            ? new BABYLON.Color3(0.85, 0.15, 0.12)
            : new BABYLON.Color3(0.85, 0.35, 0.2);
    } else if (shortName === "sunflower") {
      crossWidth = 0.8;
      crossHeight = 1.0;
      stemColor = new BABYLON.Color3(0.3, 0.5, 0.12);
      topColor = new BABYLON.Color3(0.95, 0.82, 0.1);
      emissive = new BABYLON.Color3(0.1, 0.08, 0.0);
    } else if (shortName === "sweet_berry_bush") {
      crossWidth = 0.85;
      crossHeight = 0.6;
      stemColor = new BABYLON.Color3(0.2, 0.38, 0.1);
      topColor = new BABYLON.Color3(0.3, 0.5, 0.18);
    } else if (shortName.includes("mushroom") && !shortName.includes("block")) {
      crossWidth = 0.5;
      crossHeight = 0.5;
      stemColor = new BABYLON.Color3(0.82, 0.78, 0.7);
      topColor = shortName.includes("red")
        ? new BABYLON.Color3(0.82, 0.12, 0.08)
        : new BABYLON.Color3(0.75, 0.62, 0.42);
    } else if (shortName === "dead_bush") {
      crossWidth = 0.75;
      crossHeight = 0.6;
      stemColor = new BABYLON.Color3(0.45, 0.32, 0.15);
      topColor = new BABYLON.Color3(0.55, 0.4, 0.2);
    } else if (shortName.includes("torch")) {
      // Torch: brown stick with flame tip (vertex-colored for thin-instance compat)
      return this._createTorchBillboard(meshName, shortName);
    } else if (shortName.includes("candle")) {
      return this._createSmallBoxBillboard(
        meshName,
        shortName,
        0.15,
        0.4,
        0.15,
        new BABYLON.Color3(0.9, 0.8, 0.55),
        new BABYLON.Color3(0.4, 0.3, 0.1),
        1.0
      );
    } else if (shortName.includes("vine")) {
      // Vines: flat plane on a wall face
      return this._createSmallBoxBillboard(
        meshName,
        shortName,
        0.9,
        0.9,
        0.05,
        new BABYLON.Color3(0.25, 0.55, 0.12),
        new BABYLON.Color3(0.04, 0.08, 0.02),
        0.88
      );
    } else {
      // Generic small plant
      crossWidth = 0.65;
      crossHeight = 0.6;
      stemColor = new BABYLON.Color3(0.25, 0.45, 0.15);
      topColor = new BABYLON.Color3(0.35, 0.58, 0.22);
      emissive = new BABYLON.Color3(0.04, 0.06, 0.02);
    }

    // Build two intersecting planes at 45° angles forming an X shape.
    // Each plane has 4 vertices with per-vertex colors: bottom=stemColor, top=topColor.
    const hw = crossWidth / 2;
    const hh = crossHeight / 2;
    const bottomY = -0.5; // Plant sits on bottom of block space
    const topY = bottomY + crossHeight;

    // Plane 1: diagonal from (-hw,0,-hw) to (hw,0,hw) — 45° in XZ
    // Plane 2: diagonal from (-hw,0,hw) to (hw,0,-hw) — 135° in XZ (perpendicular cross)
    const positions = new Float32Array([
      // Plane 1 — 4 verts (front face)
      -hw,
      bottomY,
      -hw,
      hw,
      bottomY,
      hw,
      hw,
      topY,
      hw,
      -hw,
      topY,
      -hw,
      // Plane 1 — 4 verts (back face, reversed winding)
      hw,
      bottomY,
      hw,
      -hw,
      bottomY,
      -hw,
      -hw,
      topY,
      -hw,
      hw,
      topY,
      hw,
      // Plane 2 — 4 verts (front face)
      -hw,
      bottomY,
      hw,
      hw,
      bottomY,
      -hw,
      hw,
      topY,
      -hw,
      -hw,
      topY,
      hw,
      // Plane 2 — 4 verts (back face)
      hw,
      bottomY,
      -hw,
      -hw,
      bottomY,
      hw,
      -hw,
      topY,
      hw,
      hw,
      topY,
      -hw,
    ]);

    const indices = new Uint32Array([
      0,
      1,
      2,
      0,
      2,
      3, // Plane 1 front
      4,
      5,
      6,
      4,
      6,
      7, // Plane 1 back
      8,
      9,
      10,
      8,
      10,
      11, // Plane 2 front
      12,
      13,
      14,
      12,
      14,
      15, // Plane 2 back
    ]);

    // Normals: each plane's normal is perpendicular to its diagonal
    const n1 = 0.7071; // 1/sqrt(2)
    const normals = new Float32Array([
      -n1,
      0,
      n1,
      -n1,
      0,
      n1,
      -n1,
      0,
      n1,
      -n1,
      0,
      n1, // Plane 1 front normal
      n1,
      0,
      -n1,
      n1,
      0,
      -n1,
      n1,
      0,
      -n1,
      n1,
      0,
      -n1, // Plane 1 back normal
      n1,
      0,
      n1,
      n1,
      0,
      n1,
      n1,
      0,
      n1,
      n1,
      0,
      n1, // Plane 2 front normal
      -n1,
      0,
      -n1,
      -n1,
      0,
      -n1,
      -n1,
      0,
      -n1,
      -n1,
      0,
      -n1, // Plane 2 back normal
    ]);

    // Per-vertex colors: bottom vertices get stemColor, top get topColor
    const sr = stemColor.r,
      sg = stemColor.g,
      sb = stemColor.b;
    const tr = topColor.r,
      tg = topColor.g,
      tb = topColor.b;
    const colors = new Float32Array([
      sr,
      sg,
      sb,
      1,
      sr,
      sg,
      sb,
      1,
      tr,
      tg,
      tb,
      1,
      tr,
      tg,
      tb,
      1, // Plane 1 front
      sr,
      sg,
      sb,
      1,
      sr,
      sg,
      sb,
      1,
      tr,
      tg,
      tb,
      1,
      tr,
      tg,
      tb,
      1, // Plane 1 back
      sr,
      sg,
      sb,
      1,
      sr,
      sg,
      sb,
      1,
      tr,
      tg,
      tb,
      1,
      tr,
      tg,
      tb,
      1, // Plane 2 front
      sr,
      sg,
      sb,
      1,
      sr,
      sg,
      sb,
      1,
      tr,
      tg,
      tb,
      1,
      tr,
      tg,
      tb,
      1, // Plane 2 back
    ]);

    // UVs for potential texturing (standard 0-1 quad mapping)
    const uvs = new Float32Array([
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1, // Plane 1 front
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1, // Plane 1 back
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1, // Plane 2 front
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      1, // Plane 2 back
    ]);

    const mesh = new BABYLON.Mesh(meshName, this._scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh);

    const mat = new BABYLON.StandardMaterial("mat_bb_" + shortName, this._scene);
    mat.diffuseColor = BABYLON.Color3.White(); // Vertex colors provide actual color
    mat.emissiveColor = emissive;
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    mat.alpha = alpha;
    mat.backFaceCulling = false;
    mat.freeze();
    mesh.material = mat;
    mesh.setEnabled(true);
    return mesh;
  }

  /**
   * Helper: create a torch billboard with brown stick + emissive flame tip.
   * Uses vertex colors for thin-instance compatibility.
   */
  private _createTorchBillboard(meshName: string, shortName: string): BABYLON.Mesh {
    const isSoul = shortName.includes("soul");
    const stickW = 0.125,
      stickH = 0.5,
      stickD = 0.125;
    const flameW = 0.1875,
      flameH = 0.1875,
      flameD = 0.1875;

    const stick = BABYLON.MeshBuilder.CreateBox(
      meshName + "_s",
      { width: stickW, height: stickH, depth: stickD },
      this._scene
    );
    stick.position.y = -0.5 + stickH / 2;
    stick.bakeCurrentTransformIntoVertices();

    const flame = BABYLON.MeshBuilder.CreateBox(
      meshName + "_f",
      { width: flameW, height: flameH, depth: flameD },
      this._scene
    );
    flame.position.y = -0.5 + stickH + flameH / 2;
    flame.bakeCurrentTransformIntoVertices();

    const svc = stick.getTotalVertices();
    const sc = new Float32Array(svc * 4);
    for (let i = 0; i < svc; i++) {
      sc[i * 4] = 0.45;
      sc[i * 4 + 1] = 0.3;
      sc[i * 4 + 2] = 0.15;
      sc[i * 4 + 3] = 1;
    }
    stick.setVerticesData(BABYLON.VertexBuffer.ColorKind, sc);

    const fvc = flame.getTotalVertices();
    const fc = new Float32Array(fvc * 4);
    const fr = isSoul ? 0.2 : 1.0,
      fg = isSoul ? 0.85 : 0.75,
      fb = isSoul ? 0.9 : 0.2;
    for (let i = 0; i < fvc; i++) {
      fc[i * 4] = fr;
      fc[i * 4 + 1] = fg;
      fc[i * 4 + 2] = fb;
      fc[i * 4 + 3] = 1;
    }
    flame.setVerticesData(BABYLON.VertexBuffer.ColorKind, fc);

    const merged = BABYLON.Mesh.MergeMeshes([stick, flame], true, true, undefined, false, true);
    if (!merged) {
      return this._createSmallBoxBillboard(
        meshName,
        shortName,
        0.125,
        0.625,
        0.125,
        new BABYLON.Color3(0.85, 0.65, 0.2),
        new BABYLON.Color3(0.6, 0.4, 0.1),
        1.0
      );
    }

    merged.name = meshName;
    const mat = new BABYLON.StandardMaterial("mat_torch_" + shortName, this._scene);
    mat.diffuseColor = BABYLON.Color3.White();
    mat.emissiveColor = isSoul ? new BABYLON.Color3(0.1, 0.3, 0.35) : new BABYLON.Color3(0.4, 0.3, 0.1);
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    (mat as any).useVertexColors = true;
    mat.freeze();
    merged.material = mat;
    merged.setEnabled(true);
    return merged;
  }

  /**
   * Helper: create a small box billboard for non-cross items (torches, candles, vines).
   */
  private _createSmallBoxBillboard(
    meshName: string,
    shortName: string,
    width: number,
    height: number,
    depth: number,
    color: BABYLON.Color3,
    emissive: BABYLON.Color3,
    alpha: number
  ): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateBox(meshName, { width, height, depth }, this._scene);
    const mat = new BABYLON.StandardMaterial("mat_bb_" + shortName, this._scene);
    mat.diffuseColor = color;
    mat.emissiveColor = emissive;
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    mat.alpha = alpha;
    mat.backFaceCulling = false;
    mat.freeze();
    mesh.material = mat;
    mesh.setEnabled(true);
    return mesh;
  }

  /**
   * Create a colored cross-shaped billboard mesh when texture lookup fails.
   * Uses flower/plant-appropriate colors based on the block name.
   */
  private _createColoredBillboardCross(shortName: string): BABYLON.Mesh {
    // Determine petal/tip color and green stem color based on block type.
    // Vertex colors create a two-tone effect: green stem at bottom, colored petals at top.
    let petalColor: BABYLON.Color3;
    const stemColor = new BABYLON.Color3(0.3, 0.55, 0.2);
    let emissive = new BABYLON.Color3(0.08, 0.08, 0.06);
    let height = 0.9;
    let width = 0.8;
    let isGreenPlant = false; // Solid green (grass, fern) — no stem/petal split

    if (shortName.includes("dandelion") || shortName.includes("yellow_flower")) {
      petalColor = new BABYLON.Color3(0.95, 0.85, 0.15);
      emissive = new BABYLON.Color3(0.15, 0.13, 0.02);
    } else if (shortName.includes("poppy") || shortName === "red_flower" || shortName.includes("rose")) {
      petalColor = new BABYLON.Color3(0.88, 0.12, 0.08);
      emissive = new BABYLON.Color3(0.12, 0.02, 0.01);
    } else if (shortName.includes("cornflower") || shortName.includes("blue_orchid")) {
      petalColor = new BABYLON.Color3(0.3, 0.45, 0.88);
      emissive = new BABYLON.Color3(0.04, 0.06, 0.14);
    } else if (shortName.includes("tulip")) {
      petalColor = shortName.includes("pink")
        ? new BABYLON.Color3(0.92, 0.5, 0.6)
        : shortName.includes("orange")
          ? new BABYLON.Color3(0.92, 0.55, 0.12)
          : shortName.includes("white")
            ? new BABYLON.Color3(0.92, 0.92, 0.88)
            : new BABYLON.Color3(0.88, 0.18, 0.12);
      emissive = new BABYLON.Color3(0.1, 0.06, 0.04);
    } else if (shortName.includes("allium")) {
      petalColor = new BABYLON.Color3(0.65, 0.3, 0.75);
      emissive = new BABYLON.Color3(0.08, 0.04, 0.1);
    } else if (shortName.includes("lily_of_the_valley") || shortName.includes("azure")) {
      petalColor = new BABYLON.Color3(0.88, 0.92, 0.88);
      emissive = new BABYLON.Color3(0.1, 0.1, 0.1);
    } else if (shortName.includes("oxeye_daisy")) {
      petalColor = new BABYLON.Color3(0.95, 0.92, 0.72);
      emissive = new BABYLON.Color3(0.12, 0.12, 0.08);
    } else if (shortName.includes("sunflower")) {
      petalColor = new BABYLON.Color3(0.95, 0.8, 0.1);
      height = 1.7;
      width = 1.0;
      emissive = new BABYLON.Color3(0.15, 0.12, 0.01);
    } else if (shortName.includes("lilac") || shortName.includes("peony")) {
      petalColor = new BABYLON.Color3(0.78, 0.5, 0.78);
      height = 1.5;
      width = 0.9;
      emissive = new BABYLON.Color3(0.1, 0.06, 0.1);
    } else if (shortName.includes("wither_rose")) {
      petalColor = new BABYLON.Color3(0.15, 0.15, 0.12);
    } else if (shortName.includes("grass") || shortName.includes("fern") || shortName === "double_plant") {
      petalColor = new BABYLON.Color3(0.35, 0.62, 0.2);
      isGreenPlant = true;
      height = 0.95;
      width = 0.9;
    } else if (shortName.includes("sapling")) {
      petalColor = new BABYLON.Color3(0.3, 0.58, 0.2);
      height = 0.75;
      width = 0.65;
      isGreenPlant = true;
    } else if (shortName.includes("mushroom")) {
      petalColor = shortName.includes("red")
        ? new BABYLON.Color3(0.82, 0.18, 0.12)
        : new BABYLON.Color3(0.85, 0.8, 0.6);
      height = 0.55;
      width = 0.55;
    } else if (shortName.includes("berry")) {
      petalColor = new BABYLON.Color3(0.35, 0.52, 0.2);
      isGreenPlant = true;
    } else if (
      shortName === "wheat" ||
      shortName === "carrots" ||
      shortName === "potatoes" ||
      shortName === "beetroots" ||
      shortName.includes("stem") ||
      shortName.includes("wart")
    ) {
      petalColor = new BABYLON.Color3(0.62, 0.58, 0.2);
      height = 0.65;
      isGreenPlant = true;
    } else {
      petalColor = new BABYLON.Color3(0.42, 0.62, 0.25);
      isGreenPlant = true;
    }

    // Create two perpendicular planes forming an X cross
    const planeOpts = {
      width: width,
      height: height,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    };

    const planeA = BABYLON.MeshBuilder.CreatePlane("bb_a_" + shortName, planeOpts, this._scene);
    planeA.rotation.y = Math.PI / 4;
    planeA.position.y = -0.5 + height / 2;
    planeA.bakeCurrentTransformIntoVertices();

    const planeB = BABYLON.MeshBuilder.CreatePlane("bb_b_" + shortName, planeOpts, this._scene);
    planeB.rotation.y = -Math.PI / 4;
    planeB.position.y = -0.5 + height / 2;
    planeB.bakeCurrentTransformIntoVertices();

    // Apply vertex colors for stem-to-petal gradient (green bottom → colored top)
    for (const plane of [planeA, planeB]) {
      const positions = plane.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (!positions) continue;
      const vc = positions.length / 3;
      const colors = new Float32Array(vc * 4);
      // Find Y extent for gradient
      let minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < vc; i++) {
        const y = positions[i * 3 + 1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const yRange = maxY - minY || 1;
      for (let i = 0; i < vc; i++) {
        const y = positions[i * 3 + 1];
        const t = (y - minY) / yRange; // 0=bottom, 1=top
        if (isGreenPlant) {
          // Solid green with slight brightness variation
          colors[i * 4] = petalColor.r * (0.8 + t * 0.2);
          colors[i * 4 + 1] = petalColor.g * (0.8 + t * 0.2);
          colors[i * 4 + 2] = petalColor.b * (0.8 + t * 0.2);
        } else {
          // Stem-to-petal gradient: green at bottom, flower color at top
          const stemT = Math.min(1, t * 2.5); // Transition mostly in lower half
          colors[i * 4] = stemColor.r * (1 - stemT) + petalColor.r * stemT;
          colors[i * 4 + 1] = stemColor.g * (1 - stemT) + petalColor.g * stemT;
          colors[i * 4 + 2] = stemColor.b * (1 - stemT) + petalColor.b * stemT;
        }
        colors[i * 4 + 3] = 1;
      }
      plane.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    }

    const merged = BABYLON.Mesh.MergeMeshes([planeA, planeB], true, true, undefined, false, true);
    if (!merged) {
      return BABYLON.MeshBuilder.CreateBox("tmpl_" + shortName, { size: 0.3 }, this._scene);
    }
    merged.name = "tmpl_bb_" + shortName;

    const mat = new BABYLON.StandardMaterial("mat_bb_" + shortName, this._scene);
    mat.diffuseColor = BABYLON.Color3.White();
    mat.emissiveColor = emissive;
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    mat.backFaceCulling = false;
    (mat as any).useVertexColors = true;
    merged.material = mat;

    return merged;
  }

  /**
   * Apply biome tint color to ALL of a block's materials.
   * Clones materials to avoid corrupting shared cached versions.
   */
  private _applyBiomeTint(mesh: BABYLON.Mesh, tint: BABYLON.Color3): void {
    const applyTint = (mat: BABYLON.StandardMaterial): BABYLON.StandardMaterial => {
      const tinted = mat.clone(mat.name + "_tinted");
      tinted.diffuseColor = tinted.diffuseColor.multiply(tint);
      return tinted;
    };

    if (mesh.material instanceof BABYLON.StandardMaterial) {
      mesh.material = applyTint(mesh.material);
    } else if (mesh.material instanceof BABYLON.MultiMaterial) {
      for (let i = 0; i < mesh.material.subMaterials.length; i++) {
        const subMat = mesh.material.subMaterials[i];
        if (subMat instanceof BABYLON.StandardMaterial) {
          mesh.material.subMaterials[i] = applyTint(subMat);
        }
      }
    }
  }

  /**
   * Apply biome tint to ONLY the top face of a multi-material block.
   * Used for grass_block: sides use grass_side_carried (already has dirt+green strip),
   * top uses grass_carried (bright green needing biome tint), bottom is dirt (no tint).
   * 6-face multi-material layout: [0-3]=sides, [4]=top, [5]=bottom.
   */
  private _applyBiomeTintTopOnly(mesh: BABYLON.Mesh, tint: BABYLON.Color3): void {
    if (mesh.material instanceof BABYLON.MultiMaterial) {
      const subs = mesh.material.subMaterials;
      // 6-face layout from _createBlockMesh: indices 0-3=sides, 4=top, 5=bottom
      const topIndex = subs.length === 6 ? 4 : subs.length >= 3 ? 1 : -1;
      if (topIndex >= 0 && topIndex < subs.length) {
        const topMat = subs[topIndex];
        if (topMat instanceof BABYLON.StandardMaterial) {
          const tinted = topMat.clone(topMat.name + "_tinted");
          tinted.diffuseColor = tinted.diffuseColor.multiply(tint);
          subs[topIndex] = tinted;
        }
      }
    } else if (mesh.material instanceof BABYLON.StandardMaterial) {
      // Uniform material — clone and tint everything
      const tinted = mesh.material.clone(mesh.material.name + "_tinted");
      tinted.diffuseColor = tinted.diffuseColor.multiply(tint);
      mesh.material = tinted;
    }
  }

  /**
   * Apply biome tint selectively — for grass_block, tint top + sides but NOT dirt bottom.
   * MultiMaterial face order from BoxMaterialAndUv (Babylon.js box): sides=0,1,2,3, up=4, down=5.
   * When skipBottom=true, the last sub-material (bottom/dirt) is left untinted.
   */
  private _applyBiomeTintSelective(mesh: BABYLON.Mesh, tint: BABYLON.Color3, skipBottom: boolean): void {
    const applyTint = (mat: BABYLON.StandardMaterial) => {
      mat.diffuseColor = mat.diffuseColor.multiply(tint);
    };

    if (mesh.material instanceof BABYLON.StandardMaterial) {
      applyTint(mesh.material);
    } else if (mesh.material instanceof BABYLON.MultiMaterial) {
      const subs = mesh.material.subMaterials;
      for (let i = 0; i < subs.length; i++) {
        const subMat = subs[i];
        if (!(subMat instanceof BABYLON.StandardMaterial)) continue;
        // Skip the last sub-material (bottom/dirt face) if requested
        if (skipBottom && i === subs.length - 1) continue;
        applyTint(subMat);
      }
    }
  }

  /**
   * Apply alpha/transparency settings for see-through blocks (leaves, glass, ice).
   *
   * ALPHA TEST vs ALPHA BLEND:
   *   - Leaves/vines: Use MATERIAL_ALPHATEST (binary cutout, like vanilla Minecraft).
   *     Pixels with alpha < threshold are fully discarded, rest are fully opaque.
   *     This matches Minecraft's "fancy" leaf rendering.
   *   - Glass/ice: Use MATERIAL_ALPHABLEND for smooth semi-transparency.
   */
  private _applyTransparencySettings(mesh: BABYLON.Mesh, useAlphaTest: boolean = true): void {
    const applyToMat = (mat: BABYLON.StandardMaterial): void => {
      if (mat.diffuseTexture) {
        mat.diffuseTexture.hasAlpha = true;
        if (useAlphaTest) {
          // Alpha cutout: use pure MATERIAL_ALPHATEST — Minecraft-style.
          // MATERIAL_ALPHATESTANDBLEND does NOT work with thin instances because:
          //   1. isAlphaTest() returns false for ALPHATESTANDBLEND, so the shader
          //      never includes the #ifdef ALPHATEST discard code path
          //   2. needDepthPrePass writes ALL pixels (including transparent ones) to
          //      the depth buffer, blocking anything behind the transparent areas
          // Pure ALPHATEST sets isAlphaTest()=true → shader discards below cutoff,
          // mesh renders in the OPAQUE pass (no depth sorting issues with thin instances).
          //
          // IMPORTANT: Keep backFaceCulling=true for alpha test blocks (leaves, vines).
          // With backFaceCulling=false, the back face of each cube face renders "behind"
          // the front face at nearly the same screen position, filling in the transparent
          // holes with the mirrored texture — making leaves appear fully solid.
          mat.backFaceCulling = true;
          mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
          mat.alphaCutOff = 0.3;
          mat.useAlphaFromDiffuseTexture = true;
        } else {
          // Alpha blend mode: smooth transparency (glass, ice)
          // Need double-sided rendering so you can see through from inside
          mat.backFaceCulling = false;
          mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
          mat.useAlphaFromDiffuseTexture = true;
        }
      }
    };

    if (mesh.material instanceof BABYLON.StandardMaterial) {
      applyToMat(mesh.material);
    } else if (mesh.material instanceof BABYLON.MultiMaterial) {
      for (const subMat of mesh.material.subMaterials) {
        if (subMat instanceof BABYLON.StandardMaterial) {
          applyToMat(subMat);
        }
      }
    }
  }

  /**
   * Apply Minecraft-style directional face brightness via vertex colors.
   * In Minecraft, each face direction has a fixed brightness multiplier:
   *   Opaque blocks:      Top = 1.0, N/S = 0.85, E/W = 0.7, Bottom = 0.55
   *   Transparent blocks:  Top = 1.0, N/S = 0.92, E/W = 0.85, Bottom = 0.78
   *
   * Transparent blocks (leaves, glass, ice) use gentler shading because their
   * biome tint already darkens the color significantly — multiplying by both
   * tint and harsh face shading produces near-black leaves. In real Minecraft,
   * leaves are translucent and receive scattered light from all directions.
   *
   * Uses vertex colors because they work with both:
   * - Textured multi-material meshes (BlockMeshFactory path)
   * - Fallback single-material colored meshes
   * Vertex colors multiply with diffuseColor * diffuseTexture in Babylon.js StandardMaterial.
   */
  private _applyFaceShading(mesh: BABYLON.Mesh, gentle: boolean = false): void {
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    if (!normals) {
      // Defensive: if normals aren't available (shouldn't happen for CreateBox),
      // force white vertex colors so the shader's VERTEXCOLOR path doesn't zero out diffuse.
      const totalVerts = mesh.getTotalVertices() || 24; // CreateBox default = 24
      const white = new Float32Array(totalVerts * 4);
      for (let i = 0; i < totalVerts; i++) {
        white[i * 4] = 1.0;
        white[i * 4 + 1] = 1.0;
        white[i * 4 + 2] = 1.0;
        white[i * 4 + 3] = 1.0;
      }
      mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, white);
      return;
    }

    const vertexCount = normals.length / 3;
    const colors = new Float32Array(vertexCount * 4);

    // Minecraft-style directional face brightness.
    // Vanilla Minecraft uses: Top=1.0, NS=0.8, EW=0.6, Bottom=0.5.
    // We use softer values than vanilla because without per-block ambient occlusion,
    // extreme face shading creates visible "striping" on grass blocks (bright green
    // tops alternating with dark brown sides). These values balance 3D depth with
    // smooth color transitions between adjacent block faces.
    // NOTE: Bottom brightness raised from 0.68 to 0.78 to prevent ceilings from
    // appearing nearly black when viewed from inside structures. The interior
    // darkness was caused by bottom face (0.68) * ground ambient (0.60) * scene
    // ambient (0.40) producing effective brightness ~0.16, far too dark.
    const topBrightness = 1.0;
    const nsBrightness = gentle ? 0.94 : 0.9;
    const ewBrightness = gentle ? 0.88 : 0.82;
    const bottomBrightness = gentle ? 0.86 : 0.78;

    for (let i = 0; i < vertexCount; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      let brightness: number;
      if (ny > 0.5) {
        brightness = topBrightness;
      } else if (ny < -0.5) {
        brightness = bottomBrightness;
      } else if (Math.abs(nz) > Math.abs(nx)) {
        brightness = nsBrightness;
      } else {
        brightness = ewBrightness;
      }

      colors[i * 4] = brightness;
      colors[i * 4 + 1] = brightness;
      colors[i * 4 + 2] = brightness;
      colors[i * 4 + 3] = 1.0;
    }

    mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
  }

  /**
   * Get the block name directly above a position in a chunk column.
   * Used for water surface-only rendering (skip water blocks with water above).
   */
  private _getBlockAbove(
    chunk: IChunkColumn,
    sci: number,
    lx: number,
    ly: number,
    _lz: number,
    getBlockName: (rid: number) => string
  ): string | undefined {
    const ny = ly + 1;
    if (ny < 16) {
      const rid = chunk.subchunks[sci]?.blocks[lx * 256 + _lz * 16 + ny];
      return rid ? getBlockName(rid) : undefined;
    }
    // Above is in next subchunk
    const nSci = sci + 1;
    if (nSci >= chunk.subchunks.length || !chunk.subchunks[nSci]) return undefined;
    const rid = chunk.subchunks[nSci].blocks[lx * 256 + _lz * 16 + 0];
    return rid ? getBlockName(rid) : undefined;
  }

  /**
   * Compute per-face exposure for a block. Returns 6 booleans: [+X, -X, +Y, -Y, +Z, -Z].
   * A face is "exposed" if the adjacent block in that direction is air, transparent, or missing.
   * Used by _buildFaceCulledMesh to only render visible faces, eliminating Z-fighting
   * between stacked blocks and reducing vertex count.
   */
  private _computeFaceExposure(
    chunk: IChunkColumn,
    sci: number,
    lx: number,
    ly: number,
    lz: number,
    getBlockName: (rid: number) => string,
    currentBlockName?: string
  ): boolean[] {
    // Direction order: [+X, -X, +Y, -Y, +Z, -Z]
    const DIRS = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    const faces: boolean[] = [false, false, false, false, false, false];
    const subchunk = chunk.subchunks[sci];
    if (!subchunk) return [true, true, true, true, true, true];

    for (let i = 0; i < 6; i++) {
      const [dx, dy, dz] = DIRS[i];
      const nx = lx + dx,
        ny = ly + dy,
        nz = lz + dz;

      // Cross-chunk boundary: use LiveWorldState
      if (nx < 0 || nx >= 16 || nz < 0 || nz >= 16) {
        if (this._worldState) {
          const worldX = chunk.x * 16 + nx;
          const worldZ = chunk.z * 16 + nz;
          const worldY = this._getMinY() + sci * 16 + ly + dy;
          const neighborBlock = this._worldState.getBlock(worldX, worldY, worldZ);
          if (
            neighborBlock &&
            (neighborBlock.runtimeId === 0 || this._shouldExposeFace(currentBlockName, neighborBlock.name ?? ""))
          ) {
            faces[i] = true;
          }
        }
        continue;
      }

      // Cross-subchunk boundary (Y direction)
      if (ny < 0 || ny >= 16) {
        const nSci = sci + dy;
        if (nSci < 0 || nSci >= chunk.subchunks.length || !chunk.subchunks[nSci]) {
          faces[i] = true;
          continue;
        }
        const nLy = ny < 0 ? 15 : 0;
        const nId = chunk.subchunks[nSci].blocks[nx * 256 + nz * 16 + nLy];
        if (nId === 0 || this._shouldExposeFace(currentBlockName, getBlockName(nId))) {
          faces[i] = true;
        }
      } else {
        const nId = subchunk.blocks[nx * 256 + nz * 16 + ny];
        if (nId === 0 || this._shouldExposeFace(currentBlockName, getBlockName(nId))) {
          faces[i] = true;
        }
      }
    }
    return faces;
  }

  /**
   * Build a merged mesh with per-face culling for a set of blocks of the same type.
   * Only renders faces that are adjacent to air/transparent blocks, eliminating
   * Z-fighting between stacked blocks and reducing vertex count.
   *
   * Each face is a quad (4 vertices, 2 triangles) with:
   * - Correct normals for the face direction
   * - Atlas-mapped UVs (top/side/bottom column from the 48×16 atlas texture)
   * - Face-shading vertex colors (Minecraft-style directional brightness)
   *
   * Replaces the previous thin-instance approach which rendered all 6 faces per block.
   */
  private _buildFaceCulledMesh(
    chunk: { x: number; z: number },
    blockName: string,
    positions: { x: number; y: number; z: number; faces: boolean[] }[],
    templateMesh: BABYLON.Mesh,
    atlasFaceUVs: BABYLON.Vector4[] | undefined
  ): BABYLON.Mesh | null {
    const verts: number[] = [];
    const norms: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const inds: number[] = [];
    let vc = 0;

    // Face shading brightness (Minecraft-style)
    const SHADE_TOP = 1.0;
    const SHADE_NS = 0.9;
    const SHADE_EW = 0.82;
    const SHADE_BOTTOM = 0.78;

    // UV ranges per face direction. Maps face index to CreateBox face index:
    // Our order: [+X(east), -X(west), +Y(top), -Y(bottom), +Z(north), -Z(south)]
    // CreateBox:  0=south(-Z), 1=north(+Z), 2=east(+X), 3=west(-X), 4=top(+Y), 5=bottom(-Y)
    const FACE_TO_BOX = [2, 3, 4, 5, 1, 0]; // map our face index to CreateBox face index

    for (const pos of positions) {
      const faces = pos.faces;
      const x = pos.x,
        y = pos.y,
        z = pos.z;

      // +X face (east)
      if (faces[0]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[0]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1);
        norms.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let c = 0; c < 4; c++) cols.push(SHADE_EW, SHADE_EW, SHADE_EW, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }

      // -X face (west)
      if (faces[1]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[1]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z);
        norms.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let c = 0; c < 4; c++) cols.push(SHADE_EW, SHADE_EW, SHADE_EW, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }

      // +Y face (top)
      if (faces[2]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[2]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x, y + 1, z, x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z);
        norms.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        for (let c = 0; c < 4; c++) cols.push(SHADE_TOP, SHADE_TOP, SHADE_TOP, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }

      // -Y face (bottom)
      if (faces[3]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[3]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x + 1, y, z, x + 1, y, z + 1, x, y, z + 1, x, y, z);
        norms.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
        uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        for (let c = 0; c < 4; c++) cols.push(SHADE_BOTTOM, SHADE_BOTTOM, SHADE_BOTTOM, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }

      // +Z face (north)
      if (faces[4]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[4]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1);
        norms.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let c = 0; c < 4; c++) cols.push(SHADE_NS, SHADE_NS, SHADE_NS, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }

      // -Z face (south)
      if (faces[5]) {
        const fuv = atlasFaceUVs ? atlasFaceUVs[FACE_TO_BOX[5]] : null;
        const u0 = fuv ? fuv.x : 0,
          v0 = fuv ? fuv.y : 0;
        const u1 = fuv ? fuv.z : 1,
          v1 = fuv ? fuv.w : 1;
        const vi = vc;
        verts.push(x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z);
        norms.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let c = 0; c < 4; c++) cols.push(SHADE_NS, SHADE_NS, SHADE_NS, 1);
        inds.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vc += 4;
      }
    }

    if (vc === 0) return null;

    const vd = new BABYLON.VertexData();
    vd.positions = new Float32Array(verts);
    vd.normals = new Float32Array(norms);
    vd.uvs = new Float32Array(uvs);
    vd.indices = new Uint32Array(inds);

    const meshName = `chunk_${chunk.x}_${chunk.z}_${blockName}_b${this._buildCount}`;
    const chunkMesh = new BABYLON.Mesh(meshName, this._scene);
    vd.applyToMesh(chunkMesh);
    chunkMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, new Float32Array(cols));
    chunkMesh.material = templateMesh.material;
    chunkMesh.setEnabled(true);
    chunkMesh.isPickable = false;
    chunkMesh.alwaysSelectAsActiveMesh = true;
    chunkMesh.freezeWorldMatrix();

    return chunkMesh;
  }

  private _hasExposedFace(
    chunk: IChunkColumn,
    sci: number,
    lx: number,
    ly: number,
    lz: number,
    getBlockName: (rid: number) => string,
    currentBlockName?: string
  ): boolean {
    const NEIGHBORS = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    const subchunk = chunk.subchunks[sci];
    if (!subchunk) return true;

    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = lx + dx,
        ny = ly + dy,
        nz = lz + dz;

      // Cross-chunk neighbor: use LiveWorldState for accurate culling.
      // CRITICAL: When neighbor data isn't loaded yet, assume SOLID (not exposed).
      // This prevents ugly floating cross-sections at chunk boundaries where
      // interior dirt/stone layers would otherwise be visible.
      if (nx < 0 || nx >= 16 || nz < 0 || nz >= 16) {
        if (this._worldState) {
          const worldX = chunk.x * 16 + nx;
          const worldZ = chunk.z * 16 + nz;
          const worldY = this._getMinY() + sci * 16 + ly + dy;
          const neighborBlock = this._worldState.getBlock(worldX, worldY, worldZ);
          if (
            neighborBlock &&
            (neighborBlock.runtimeId === 0 || this._shouldExposeFace(currentBlockName, neighborBlock.name ?? ""))
          ) {
            return true;
          }
        }
        continue;
      }

      if (ny < 0 || ny >= 16) {
        const nSci = sci + dy;
        if (nSci < 0 || nSci >= chunk.subchunks.length || !chunk.subchunks[nSci]) return true;
        const nLy = ny < 0 ? 15 : 0;
        const nId = chunk.subchunks[nSci].blocks[nx * 256 + nz * 16 + nLy];
        if (nId === 0 || this._shouldExposeFace(currentBlockName, getBlockName(nId))) return true;
      } else {
        const nId = subchunk.blocks[nx * 256 + nz * 16 + ny];
        if (nId === 0 || this._shouldExposeFace(currentBlockName, getBlockName(nId))) return true;
      }
    }
    return false;
  }

  private _getMinY(): number {
    return this._worldState?.minY ?? -64;
  }

  /**
   * Determine if the current block should expose its face against the given neighbor.
   * Same-type translucent blocks (water-water, glass-glass, leaves-leaves) do NOT
   * expose faces between each other — this prevents interior face rendering.
   */
  private _shouldExposeFace(currentBlockName: string | undefined, neighborName: string): boolean {
    if (!this._isSeeThrough(neighborName)) return false;
    // If both current and neighbor are in the same translucent group (e.g., both water),
    // don't expose the face between them — they form a single visual volume.
    if (currentBlockName) {
      const currentGroup = this._getTranslucentGroup(currentBlockName);
      if (currentGroup) {
        const neighborGroup = this._getTranslucentGroup(neighborName);
        if (currentGroup === neighborGroup) return false;
      }
    }
    return true;
  }

  /**
   * Get the translucent group for a block, or null if not translucent.
   * Blocks in the same group don't render faces between each other.
   */
  private _getTranslucentGroup(blockName: string): string | null {
    if (!blockName) return null;
    const short = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
    // Only water forms a continuous visual volume where interior faces should be hidden.
    // Glass, ice, and leaves should keep their interior faces:
    //   - Glass: stained glass panes of different colors need visible shared faces
    //   - Ice: solid block with slight transparency, interior faces visible in Minecraft
    //   - Leaves: alpha cutout texture — interior faces give dense, natural foliage look
    if (short.includes("water")) return "water";
    return null;
  }

  /**
   * Blocks that are "see-through" for face culling purposes.
   * Adjacent opaque blocks should render their face when next to these.
   * Includes billboard blocks (flowers, grass, saplings) which are rendered
   * but don't occlude adjacent block faces.
   */
  private _isSeeThrough(blockName: string): boolean {
    if (!blockName || blockName === "minecraft:air" || blockName === "") return true;
    const short = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
    if (short === "air") return true;
    // Translucent blocks that we DO render but are see-through for culling
    if (short.includes("water") || short.includes("glass") || short.includes("leaves") || short.includes("ice")) {
      return true;
    }
    // Billboard/cross blocks — rendered but see-through for adjacent face culling
    if (
      short.includes("torch") ||
      short.includes("vine") ||
      short === "lily_pad" ||
      short === "leaf_litter" ||
      short.includes("snow_layer") ||
      short.includes("carpet") ||
      short.includes("pressure_plate") ||
      short.includes("button") ||
      short.includes("rail") ||
      short.includes("door") ||
      short.includes("ladder") ||
      short === "chain" ||
      short.includes("lantern") ||
      short === "bush" ||
      short === "bamboo" ||
      short === "kelp" ||
      short === "seagrass" ||
      short === "tall_seagrass" ||
      (short.includes("coral") && !short.includes("block")) ||
      short.includes("sign") ||
      short.includes("banner") ||
      (short.includes("grass") && !short.includes("block")) ||
      short === "short_grass" ||
      short === "tall_grass" ||
      short === "fern" ||
      short === "large_fern" ||
      short.includes("flower") ||
      short.includes("sapling") ||
      short === "dead_bush" ||
      short === "sugar_cane" ||
      (short.includes("mushroom") && !short.includes("block"))
    ) {
      return true;
    }
    // Non-renderable blocks are also see-through
    return this._isNonRenderable(blockName);
  }

  /**
   * Blocks that we skip rendering entirely — blocks too complex for simple mesh
   * representation or that would look bad without custom geometry.
   * Billboard-type blocks (flowers, grass, saplings) are now rendered as cross planes.
   * Torches, rails, and buttons are now rendered with appropriate geometry.
   */
  private _isNonRenderable(blockName: string): boolean {
    if (!blockName || blockName === "minecraft:air" || blockName === "") return true;
    const short = blockName.startsWith("minecraft:") ? blockName.substring(10) : blockName;
    return (
      short === "air" ||
      short.includes("redstone_wire") ||
      short === "structure_void" ||
      short === "barrier" ||
      short === "light_block" ||
      short.includes("fire") ||
      short === "moving_block" ||
      short === "piston_arm_collision" ||
      short === "sticky_piston_arm_collision" ||
      // Small plants/mushrooms that render as ugly colored cubes — skip for cleaner terrain.
      // These blocks need billboard/cross-mesh rendering which we don't yet support.
      short === "red_mushroom" ||
      short === "brown_mushroom" ||
      short === "dead_bush" ||
      short === "fern" ||
      short === "large_fern" ||
      short === "sweet_berry_bush" ||
      short === "cave_vines" ||
      short === "cave_vines_body_with_berries" ||
      short === "cave_vines_head_with_berries" ||
      short === "hanging_roots" ||
      short === "spore_blossom" ||
      short === "moss_carpet" ||
      short === "sculk_vein" ||
      short === "glow_lichen" ||
      short === "cobweb" ||
      short === "tripwire" ||
      short.includes("candle") ||
      short.includes("carpet") ||
      short === "snow_layer" ||
      short.includes("coral_fan") ||
      short.includes("sea_pickle") ||
      short.includes("turtle_egg") ||
      short.includes("frog_spawn") ||
      short.includes("skull") ||
      short.includes("head") ||
      short.includes("flower_pot") ||
      // Flowers — render as ugly solid cubes without proper billboard support
      short === "poppy" ||
      short === "dandelion" ||
      short === "red_flower" ||
      short === "yellow_flower" ||
      short.includes("tulip") ||
      short === "allium" ||
      short === "azure_bluet" ||
      short === "oxeye_daisy" ||
      short === "cornflower" ||
      short === "lily_of_the_valley" ||
      short === "blue_orchid" ||
      short === "wither_rose" ||
      short === "torchflower" ||
      short === "pitcher_plant" ||
      short === "sunflower" ||
      short === "lilac" ||
      short === "rose_bush" ||
      short === "peony" ||
      // Grass/plant overlays
      short === "short_grass" ||
      short === "tall_grass" ||
      short === "double_plant" ||
      short === "seagrass" ||
      short === "kelp" ||
      short === "bamboo" ||
      short === "bamboo_sapling" ||
      // Small decorative blocks
      short === "lever" ||
      short.includes("button") ||
      short.includes("pressure_plate") ||
      short === "rail" ||
      short === "powered_rail" ||
      short === "activator_rail" ||
      short === "detector_rail" ||
      short === "ladder" ||
      short === "vine" ||
      short.includes("sign") ||
      short.includes("banner") ||
      short === "end_rod" ||
      short === "lightning_rod" ||
      short.includes("chain") ||
      short === "pointed_dripstone" ||
      // Liquids that appear as floating rectangles in cleared areas
      short === "lava" ||
      short === "flowing_lava" ||
      short === "flowing_water"
    );
  }

  dispose(): void {
    for (const tmpl of this._templateMeshes.values()) {
      tmpl.dispose();
    }
    this._templateMeshes.clear();
  }
}
