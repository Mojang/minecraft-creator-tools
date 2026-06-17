import {
  BlockPermutation,
  Dimension,
  LocationInUnloadedChunkError,
  LocationOutOfWorldBoundariesError,
  system,
  TickingAreaError,
  TickingAreaOptions,
  Vector3,
  world,
} from "@minecraft/server";

/**
 * ChunkLoader — force-loads and persists a rectangular block region.
 *
 * Strategy:
 *   1. Tile the requested region into TILE_CHUNKS × TILE_CHUNKS chunk tiles
 *      (64 chunks per tile by default). Keeps each ticking area well under the
 *      per-pack chunk cap (~100) and the 255-chunk-per-side limit.
 *   2. For each tile, create a single TickingArea via TickingAreaManager and
 *      await chunk load.
 *   3. For each chunk in the tile, fetch the topmost solid block, then perform
 *      a **two-write toggle** on the AIR block above it: write structure_void,
 *      then write back the original (air) permutation. Two distinct writes
 *      defeat the engine's same-permutation no-op optimization, guaranteeing
 *      the chunk is marked dirty so Bedrock serializes it. structure_void is
 *      invisible with no collision, so there is no visible terrain change.
 *   4. Remove the ticking area before moving to the next tile so we never
 *      exceed maxChunkCount.
 *   5. Yield ticks between tiles so other gameplay isn't starved and so the
 *      engine has time to flush save buffers before chunks unload.
 *
 * Why not same-permutation rewrite? An earlier implementation used
 * `top.setPermutation(top.permutation)` and produced visibly patchy results
 * when the world was reopened — large fractions of chunks were never saved.
 * Bedrock's engine appears to optimize away set-to-same-permutation writes,
 * so the chunk is never marked dirty. The two-write toggle is mandatory.
 *
 * Concurrency: at most one loadRegion job per dimension at a time. Overlapping
 * requests for the same dimension are rejected.
 *
 * Related files:
 *   - mc/scripts/creator_tools/CreatorTools.ts — registers the mct:load command
 *     and exposes loadRegion(...) as a pass-through used by the pliers wand.
 *   - mc/scripts/ingame/main.ts — pliers two-tap wand that calls loadRegion.
 */
export class ChunkLoader {
  /** Chunks per tile edge (8 → 64 chunks per tile → 128×128 blocks). */
  private static readonly TILE_CHUNKS = 8;

  /** Max region edge in blocks (4096 = 256 chunks/side) — sanity guard. */
  private static readonly MAX_REGION_BLOCKS = 4096;

  /** Ticks to wait between tiles to yield to the engine and let saves flush. */
  private static readonly TICKS_BETWEEN_TILES = 5;

  /**
   * Invisible filler block used for the two-write dirty toggle. structure_void
   * has no collision, no visuals, and is preserved across world reloads.
   */
  private static readonly DIRTY_FILLER_ID = "minecraft:structure_void";
  private static readonly AIR_ID = "minecraft:air";

  /** Per-dimension single-in-flight lock. */
  private readonly _inFlight = new Map<string, Promise<unknown>>();

  /** Monotonic counter to keep ticking area ids unique across calls. */
  private _runSeq = 0;

  /**
   * Returns true if a load is currently in flight for the given dimension.
   */
  isLoading(dimension: Dimension): boolean {
    return this._inFlight.has(dimension.id);
  }

  /**
   * Force-load and persist a rectangular block region.
   *
   * @param dimension  Target dimension.
   * @param fromX      One corner block X (inclusive).
   * @param fromZ      One corner block Z (inclusive).
   * @param toX        Opposite corner block X (inclusive).
   * @param toZ        Opposite corner block Z (inclusive).
   * @param onMessage  Optional progress callback (also echoed to world chat).
   */
  async loadRegion(
    dimension: Dimension,
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    onMessage?: (message: string) => void
  ): Promise<{ chunksLoaded: number; tilesProcessed: number; durationMs: number }> {
    const dimId = dimension.id;
    if (this._inFlight.has(dimId)) {
      throw new Error(`A chunk load is already in progress for dimension ${dimId}.`);
    }

    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const minZ = Math.min(fromZ, toZ);
    const maxZ = Math.max(fromZ, toZ);
    const widthBlocks = maxX - minX + 1;
    const depthBlocks = maxZ - minZ + 1;

    if (widthBlocks > ChunkLoader.MAX_REGION_BLOCKS || depthBlocks > ChunkLoader.MAX_REGION_BLOCKS) {
      throw new Error(
        `Region too large: ${widthBlocks}x${depthBlocks} blocks exceeds the ${ChunkLoader.MAX_REGION_BLOCKS}-block per-side limit.`
      );
    }

    const job = this._runJob(dimension, minX, minZ, maxX, maxZ, onMessage);
    this._inFlight.set(dimId, job);
    try {
      return await job;
    } finally {
      this._inFlight.delete(dimId);
    }
  }

  private async _runJob(
    dimension: Dimension,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    onMessage?: (message: string) => void
  ): Promise<{ chunksLoaded: number; tilesProcessed: number; durationMs: number }> {
    const start = Date.now();
    const seq = ++this._runSeq;

    // Convert block extents to chunk extents (floor-divide by 16).
    const minChunkX = Math.floor(minX / 16);
    const maxChunkX = Math.floor(maxX / 16);
    const minChunkZ = Math.floor(minZ / 16);
    const maxChunkZ = Math.floor(maxZ / 16);
    const tileSize = ChunkLoader.TILE_CHUNKS;

    const tilesAlongX = Math.ceil((maxChunkX - minChunkX + 1) / tileSize);
    const tilesAlongZ = Math.ceil((maxChunkZ - minChunkZ + 1) / tileSize);
    const totalTiles = tilesAlongX * tilesAlongZ;

    let chunksLoaded = 0;
    let chunksNoTop = 0;
    let chunksFailed = 0;
    let tilesProcessed = 0;
    let tileIndex = 0;

    const yMin = dimension.heightRange.min;
    const yMax = dimension.heightRange.max - 1;

    this._report(onMessage, `Load region start: ${maxX - minX + 1}x${maxZ - minZ + 1} blocks, ${totalTiles} tile(s).`);

    for (let tileChunkZ = minChunkZ; tileChunkZ <= maxChunkZ; tileChunkZ += tileSize) {
      for (let tileChunkX = minChunkX; tileChunkX <= maxChunkX; tileChunkX += tileSize) {
        const tileMaxChunkX = Math.min(tileChunkX + tileSize - 1, maxChunkX);
        const tileMaxChunkZ = Math.min(tileChunkZ + tileSize - 1, maxChunkZ);

        const tileFromX = tileChunkX * 16;
        const tileFromZ = tileChunkZ * 16;
        const tileToX = tileMaxChunkX * 16 + 15;
        const tileToZ = tileMaxChunkZ * 16 + 15;

        const opts: TickingAreaOptions = {
          dimension,
          from: { x: tileFromX, y: yMin, z: tileFromZ },
          to: { x: tileToX, y: yMax, z: tileToZ },
        };

        const id = `mct_load_${seq}_${tileIndex}`;
        tileIndex++;

        try {
          await this._ensureCapacityAndCreate(id, opts);
        } catch (err) {
          this._report(
            onMessage,
            `Tile (${tileChunkX},${tileChunkZ}) skipped: createTickingArea failed - ${(err as Error).message}`
          );
          continue;
        }

        let tileChunksLoaded = 0;
        for (let cz = tileChunkZ; cz <= tileMaxChunkZ; cz++) {
          for (let cx = tileChunkX; cx <= tileMaxChunkX; cx++) {
            const result = this._persistChunk(dimension, cx, cz);
            if (result === "ok") {
              tileChunksLoaded++;
            } else if (result === "no_top") {
              chunksNoTop++;
            } else {
              chunksFailed++;
            }
          }
        }
        chunksLoaded += tileChunksLoaded;

        try {
          world.tickingAreaManager.removeTickingArea(id);
        } catch (err) {
          this._report(onMessage, `removeTickingArea(${id}) failed: ${(err as Error).message}`);
        }

        tilesProcessed++;
        if (tilesProcessed % 4 === 0 || tilesProcessed === totalTiles) {
          this._report(
            onMessage,
            `Loaded tile ${tilesProcessed}/${totalTiles} (${chunksLoaded} chunks persisted so far).`
          );
        }

        await this._yieldTicks(ChunkLoader.TICKS_BETWEEN_TILES);
      }
    }

    // Final safety net: remove anything still owned by this pack.
    try {
      world.tickingAreaManager.removeAllTickingAreas();
    } catch {
      // ignore — best-effort cleanup
    }

    const durationMs = Date.now() - start;
    const summary =
      `Load region done: ${chunksLoaded} chunks across ${tilesProcessed} tile(s) in ${durationMs}ms` +
      (chunksNoTop > 0 || chunksFailed > 0 ? ` (skipped: ${chunksNoTop} no-top, ${chunksFailed} failed).` : `.`);
    this._report(onMessage, summary);

    return { chunksLoaded, tilesProcessed, durationMs };
  }

  /**
   * Try to create the ticking area, freeing previously-held areas if capacity
   * is exceeded. Throws if creation still fails after cleanup.
   */
  private async _ensureCapacityAndCreate(id: string, opts: TickingAreaOptions): Promise<void> {
    if (!world.tickingAreaManager.hasCapacity(opts)) {
      try {
        world.tickingAreaManager.removeAllTickingAreas();
      } catch {
        // ignore — will surface as TickingAreaError below if creation fails
      }
    }
    try {
      await world.tickingAreaManager.createTickingArea(id, opts);
    } catch (err) {
      // Last-chance retry after clearing everything we own.
      if (err instanceof TickingAreaError) {
        try {
          world.tickingAreaManager.removeAllTickingAreas();
        } catch {
          // ignore
        }
        await world.tickingAreaManager.createTickingArea(id, opts);
      } else {
        throw err;
      }
    }
  }

  /**
   * Mark a single chunk dirty by performing two real block writes on an
   * invisible filler block above the topmost solid block, then restoring it.
   * Two distinct writes (any→structure_void, then structure_void→original)
   * defeat the engine's same-permutation no-op optimization that previously
   * caused chunks to silently fail to persist.
   *
   * Returns "ok" on success, "no_top" if getTopmostBlock returned nothing and
   * the fallback also failed, or "failed" on any other error.
   */
  private _persistChunk(dimension: Dimension, chunkX: number, chunkZ: number): "ok" | "no_top" | "failed" {
    const blockX = chunkX * 16 + 8;
    const blockZ = chunkZ * 16 + 8;

    try {
      const top = dimension.getTopmostBlock({ x: blockX, z: blockZ });
      if (top) {
        // Toggle the air block ABOVE the topmost solid block: no visible change,
        // structure_void is invisible and has no collision.
        const above = top.above(1);
        if (above) {
          return this._toggleBlock(above) ? "ok" : "failed";
        }
        // Top is already at the build height — toggle the topmost itself.
        return this._toggleBlock(top) ? "ok" : "failed";
      }

      // Fallback for fully-empty columns (rare): try a position just above the
      // floor of the dimension. Still cheap and yields a real chunk write.
      const fallbackLoc: Vector3 = { x: blockX, y: dimension.heightRange.min + 1, z: blockZ };
      try {
        const fallback = dimension.getBlock(fallbackLoc);
        if (fallback) {
          return this._toggleBlock(fallback) ? "ok" : "no_top";
        }
      } catch {
        // ignore — fall through to no_top
      }
      return "no_top";
    } catch (err) {
      if (err instanceof LocationOutOfWorldBoundariesError || err instanceof LocationInUnloadedChunkError) {
        return "failed";
      }
      return "failed";
    }
  }

  /**
   * Two-write toggle on a single block: capture original permutation, write
   * structure_void, then write the original back. Guarantees the chunk is
   * marked dirty regardless of engine no-op optimizations.
   */
  private _toggleBlock(block: {
    permutation: BlockPermutation;
    setPermutation: (p: BlockPermutation) => void;
  }): boolean {
    try {
      const original = block.permutation;
      const filler = BlockPermutation.resolve(ChunkLoader.DIRTY_FILLER_ID);
      block.setPermutation(filler);
      block.setPermutation(original);
      return true;
    } catch {
      // If structure_void isn't available for some reason, try air toggle.
      try {
        const original = block.permutation;
        const air = BlockPermutation.resolve(ChunkLoader.AIR_ID);
        block.setPermutation(air);
        block.setPermutation(original);
        return true;
      } catch {
        return false;
      }
    }
  }

  private _yieldTicks(ticks: number): Promise<void> {
    return new Promise((resolve) => {
      system.runTimeout(resolve, ticks);
    });
  }

  private _report(onMessage: ((message: string) => void) | undefined, text: string): void {
    if (onMessage) {
      try {
        onMessage(text);
      } catch {
        // ignore — callback must never break the job
      }
    }
    try {
      world.sendMessage(text);
    } catch {
      // ignore
    }
  }
}
