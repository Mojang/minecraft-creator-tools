// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * IWorldScanCache
 *
 * Cached output of a single world-chunk scan, suitable for replay across
 * multiple ProjectInfoSet suite passes without re-decompressing the LevelDB.
 *
 * BACKGROUND
 * ----------
 * A typical CLI validation run invokes 2-3 ProjectInfoSets per project
 * (defaultInDevelopment, cooperativeAddOn, currentPlatformVersions). Each
 * one runs WorldDataInfoGenerator and CustomDimensionWorldDataInfoGenerator.
 * Without caching, each suite would re-iterate every chunk (and previously
 * even re-decompressed every LDB block).
 *
 * MCWorld holds at most one IWorldScanCache at a time. The first pass that
 * needs it builds it from a full chunk scan; subsequent passes consume it
 * and emit per-suite ProjectInfoItems without touching the heavy chunk
 * structures (which can then be cleared by per-chunk `clearAllAfterProcess`
 * during the first pass).
 */

/**
 * Aggregated, replay-friendly summary of a single CommandBlockActor
 * encountered during a chunk scan.
 *
 * Stores only the fields downstream suite scoring needs — we deliberately
 * avoid retaining references to the original NBT-backed actor objects so
 * the underlying chunk buffers can be freed.
 */
export interface IWorldScanCachedCommandBlockActor {
  /** "minecraft:command_block" / "minecraft:chain_command_block" / ... */
  id?: string;
  /** Raw command string from the block. May be empty. */
  command?: string;
  /** Block-actor version (used to detect older Minecraft versions). */
  version?: number;
  /** World-space coordinates (for diagnostic messages only). */
  x?: number;
  y?: number;
  z?: number;
}

/**
 * Aggregated, replay-friendly summary of a non-command block actor.
 */
export interface IWorldScanCachedBlockActor {
  /** Actor id, e.g. "minecraft:sign". */
  id?: string;
}

/**
 * The full cached scan result. All counts are pre-summed across the world's
 * chunks; the per-actor arrays preserve enough detail for any suite to score
 * its own rules without needing to walk chunks again.
 */
export default interface IWorldScanCache {
  /** Total chunks observed during the scan. */
  chunkCount: number;
  /** Subset of chunks whose `subChunks.length` was 0. */
  subchunkLessChunkCount: number;
  /** Total block instances summed across all chunks. */
  blockCount: number;
  /** Per-block-type counts: minecraft:stone → 12345. */
  blockTypeCounts: Map<string, number>;
  /** Per-non-command-actor-id counts: minecraft:sign → 7. */
  blockActorCounts: Map<string, number>;
  /** Every command block actor we saw, captured by value. */
  commandBlockActors: IWorldScanCachedCommandBlockActor[];
}
