// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlockSpriteDatabase — Loads the committed vanilla block sprite atlas and
 * exposes per-block tile coordinates for UI surfaces (primarily the block
 * picker) so they can render all blocks from a single PNG via CSS
 * background-position instead of issuing one HTTP request per block.
 *
 * Inputs:
 *   /data/block-atlas.json           — { tileSize, cols, rows, file, blocks }
 *   /data/atlases/block-sprites.png  — the composited sheet
 *
 * Both are committed and produced off-line by
 * `npm run generate-block-atlas` (stitches render snapshots in
 * debugoutput/res/snapshots/).
 *
 * Mirrors the shape of ItemSpriteDatabase but is intentionally simpler:
 * blocks don't carry display names or categories here — callers already
 * have that data from LookupUtilities.getBlockTypeReferences().
 */

import CreatorToolsHost from "../../../app/CreatorToolsHost";
import Log from "../../../core/Log";
import SpriteAtlasLoader from "../sprites/SpriteAtlasLoader";

interface IBlockAtlasCoord {
  x: number;
  y: number;
}

interface IBlockAtlasManifest {
  version: number;
  tileSize: number;
  cols: number;
  rows: number;
  file: string;
  blocks: Record<string, IBlockAtlasCoord>;
}

export default class BlockSpriteDatabase {
  private static _loadPromise: Promise<void> | null = null;
  private static _manifest: IBlockAtlasManifest | null = null;
  private static _atlas = new SpriteAtlasLoader("BlockSpriteDatabase");

  /** Kick off (or reuse) the atlas load. Safe to call many times. */
  static ensureLoaded(): Promise<void> {
    if (BlockSpriteDatabase._loadPromise) {
      return BlockSpriteDatabase._loadPromise;
    }

    BlockSpriteDatabase._loadPromise = (async () => {
      try {
        const url = CreatorToolsHost.contentWebRoot + "data/block-atlas.json";
        const response = await fetch(url);
        if (!response.ok) {
          Log.debug(
            "BlockSpriteDatabase: atlas manifest unavailable (HTTP " +
              response.status +
              "), using per-icon fallback"
          );
          return;
        }
        const manifest: IBlockAtlasManifest = await response.json();
        if (!manifest || !manifest.blocks || !manifest.file) {
          Log.debug("BlockSpriteDatabase: atlas manifest malformed, using per-icon fallback");
          return;
        }
        BlockSpriteDatabase._manifest = manifest;
        BlockSpriteDatabase._atlas.setAtlasUrl(CreatorToolsHost.contentWebRoot + "data/" + manifest.file);
      } catch (err) {
        // Atlas missing or malformed — callers fall back to individual icons.
        Log.debug("BlockSpriteDatabase: atlas load failed, using per-icon fallback: " + err);
      }
    })();

    return BlockSpriteDatabase._loadPromise;
  }

  /** Resolve when the atlas PNG has finished loading (or failed). */
  static async waitForPreload(): Promise<void> {
    await BlockSpriteDatabase.ensureLoaded();
    await BlockSpriteDatabase._atlas.waitForPreload();
  }

  /** True once the atlas PNG is decoded and ready to render from. */
  static get hasAtlas(): boolean {
    return BlockSpriteDatabase._atlas.hasAtlas;
  }

  static get atlasUrl(): string | null {
    return BlockSpriteDatabase._atlas.atlasUrl;
  }

  static get tileSize(): number {
    return BlockSpriteDatabase._manifest ? BlockSpriteDatabase._manifest.tileSize : 64;
  }

  static get atlasWidth(): number {
    if (!BlockSpriteDatabase._manifest) return 0;
    return BlockSpriteDatabase._manifest.cols * BlockSpriteDatabase._manifest.tileSize;
  }

  static get atlasHeight(): number {
    if (!BlockSpriteDatabase._manifest) return 0;
    return BlockSpriteDatabase._manifest.rows * BlockSpriteDatabase._manifest.tileSize;
  }

  /**
   * Look up the tile coordinates for a block id. Accepts ids with or without
   * the "minecraft:" prefix and normalises to the canonical vanilla key.
   */
  static getCoords(blockId: string): IBlockAtlasCoord | undefined {
    if (!BlockSpriteDatabase._manifest) return undefined;
    const blocks = BlockSpriteDatabase._manifest.blocks;
    if (blocks[blockId]) return blocks[blockId];

    const short = blockId.startsWith("minecraft:") ? blockId.substring("minecraft:".length) : blockId;
    if (blocks[short]) return blocks[short];

    const full = "minecraft:" + short;
    if (blocks[full]) return blocks[full];

    return undefined;
  }
}
