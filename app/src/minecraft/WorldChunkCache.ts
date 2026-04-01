// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import WorldChunk from "./WorldChunk";

/**
 * LRU (Least Recently Used) cache for WorldChunk objects.
 *
 * Manages memory by evicting least recently used chunks when the cache
 * exceeds its maximum size. This enables viewing of very large worlds
 * without loading all chunks into memory simultaneously.
 *
 * When a chunk is evicted, its cached/parsed data is cleared but the
 * chunk object itself remains in the world's chunks Map. This allows
 * the chunk to be re-parsed on demand from its raw LevelKeyValue data.
 */
export default class WorldChunkCache {
  /** Maximum number of chunks to keep parsed data for */
  private _maxChunks: number;

  /** Ordered list of chunk keys, oldest first (LRU tracking) */
  private _accessOrder: string[] = [];

  /** Set of chunks currently in the cache */
  private _cachedChunks: Set<string> = new Set();

  /** Callback to get a chunk by its key */
  private _getChunk?: (key: string) => WorldChunk | undefined;

  /**
   * Create a new chunk cache.
   * @param maxChunks Maximum number of chunks to keep parsed data for
   */
  constructor(maxChunks: number = 20000) {
    this._maxChunks = maxChunks;
  }

  /** Get the maximum number of cached chunks */
  get maxChunks(): number {
    return this._maxChunks;
  }

  /** Set the maximum number of cached chunks */
  set maxChunks(value: number) {
    this._maxChunks = value;
    this._evictIfNeeded();
  }

  /** Get the current number of cached chunks */
  get size(): number {
    return this._cachedChunks.size;
  }

  /**
   * Set the callback to retrieve chunks by key.
   * The key format should be "dim_x_z" (e.g., "0_10_-5").
   */
  setChunkProvider(provider: (key: string) => WorldChunk | undefined): void {
    this._getChunk = provider;
  }

  /**
   * Generate a cache key for a chunk.
   */
  static makeKey(dim: number, x: number, z: number): string {
    return `${dim}_${x}_${z}`;
  }

  /**
   * Parse a cache key back into coordinates.
   */
  static parseKey(key: string): { dim: number; x: number; z: number } | undefined {
    const parts = key.split("_");
    if (parts.length !== 3) return undefined;
    return {
      dim: parseInt(parts[0], 10),
      x: parseInt(parts[1], 10),
      z: parseInt(parts[2], 10),
    };
  }

  /**
   * Record access to a chunk, marking it as recently used.
   * Call this whenever a chunk is accessed for rendering or data retrieval.
   */
  access(dim: number, x: number, z: number): void {
    const key = WorldChunkCache.makeKey(dim, x, z);
    this.accessByKey(key);
  }

  /**
   * Record access to a chunk by key.
   */
  accessByKey(key: string): void {
    // Remove from old position if exists
    const existingIndex = this._accessOrder.indexOf(key);
    if (existingIndex >= 0) {
      this._accessOrder.splice(existingIndex, 1);
    }

    // Add to end (most recently used)
    this._accessOrder.push(key);
    this._cachedChunks.add(key);

    // Evict old chunks if over limit
    this._evictIfNeeded();
  }

  /**
   * Evict least recently used chunks if over the limit.
   */
  private _evictIfNeeded(): void {
    if (this._cachedChunks.size <= this._maxChunks) {
      return;
    }

    // Evict to 80% of max to avoid frequent evictions
    const targetSize = Math.floor(this._maxChunks * 0.8);
    const chunksToEvict = this._cachedChunks.size - targetSize;

    for (let i = 0; i < chunksToEvict && this._accessOrder.length > 0; i++) {
      const oldestKey = this._accessOrder.shift();
      if (oldestKey) {
        this._evictChunk(oldestKey);
      }
    }
  }

  /**
   * Evict a specific chunk, clearing its cached data.
   */
  private _evictChunk(key: string): void {
    this._cachedChunks.delete(key);

    if (this._getChunk) {
      const chunk = this._getChunk(key);
      if (chunk) {
        // Clear cached/parsed data but keep raw LevelKeyValue data
        // This allows the chunk to be re-parsed on demand
        chunk.clearCachedData();
      }
    }
  }

  /**
   * Check if a chunk is in the cache (has parsed data available).
   */
  isInCache(dim: number, x: number, z: number): boolean {
    const key = WorldChunkCache.makeKey(dim, x, z);
    return this._cachedChunks.has(key);
  }

  /**
   * Clear all cached chunks.
   */
  clear(): void {
    // Clear all cached chunk data
    if (this._getChunk) {
      for (const key of this._cachedChunks) {
        const chunk = this._getChunk(key);
        if (chunk) {
          chunk.clearCachedData();
        }
      }
    }

    this._accessOrder = [];
    this._cachedChunks.clear();
  }

  /**
   * Prefetch chunks in a region, loading them into the cache.
   * Useful for ensuring a viewport's worth of chunks are available.
   *
   * @param dim Dimension index
   * @param minX Minimum chunk X coordinate
   * @param maxX Maximum chunk X coordinate
   * @param minZ Minimum chunk Z coordinate
   * @param maxZ Maximum chunk Z coordinate
   */
  prefetchRegion(dim: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        this.access(dim, x, z);
      }
    }
  }

  /**
   * Get statistics about cache usage.
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this._cachedChunks.size,
      maxSize: this._maxChunks,
      hitRate: 0, // TODO: Track hit/miss for debugging
    };
  }
}
