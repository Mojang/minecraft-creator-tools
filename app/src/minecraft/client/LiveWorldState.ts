/**
 * ARCHITECTURE: LiveWorldState
 *
 * Client-side world model that maintains chunk data received from the server.
 * This is the browser's "copy" of the nearby world — chunks are loaded/unloaded
 * as the server sends LevelChunkPackets and NetworkChunkPublisherUpdatePackets.
 *
 * DATA FLOW:
 *   Server → proxy (decodes Bedrock protocol) → WebSocket → LiveWorldState
 *   LiveWorldState marks chunks dirty → WorldRenderer reads dirty chunks →
 *   ChunkMeshBuilder converts to Babylon.js meshes
 *
 * BLOCK ACCESS:
 *   getBlock(x, y, z) → { runtimeId, name } or undefined
 *   setBlock(x, y, z, runtimeId) → marks chunk dirty
 *   getBlockName(runtimeId) → block identifier string via palette lookup
 *
 * CHUNK STORAGE:
 *   Chunks keyed by "chunkX,chunkZ" string in a Map.
 *   Each chunk has up to 24 subchunks (y = -64 to 319 in overworld).
 *   Each subchunk is 16×16×16 blocks stored as a flat Int32Array of runtime IDs.
 *   Storage order is XZY: index = x*256 + z*16 + y (Bedrock SubChunk format).
 *
 * BLOCK PALETTE:
 *   Maps runtime IDs (32-bit hashes) → block names (e.g., "minecraft:stone").
 *   Populated from StartGamePacket.block_palette and block_palette events.
 *   CRITICAL: Chunks loaded before the palette arrives will have zero rendered
 *   blocks. When the palette arrives, all pre-loaded chunks are marked dirty
 *   so they get rebuilt with correct block names.
 *
 * DIRTY TRACKING:
 *   _dirtyChunks tracks which chunk keys need mesh rebuilds.
 *   Chunks are dirtied when: new chunk data arrives, blocks are modified,
 *   palette arrives (mass re-dirty), or adjacent chunks load (face-culling
 *   recalculation at chunk boundaries).
 *
 * CLEAR ZONE:
 *   Optional filter that replaces non-whitelisted blocks above a Y threshold
 *   with air. Used to clear terrain for building or to isolate structures.
 *   Applied to incoming chunk data as it arrives.
 *
 * COORDINATE SYSTEMS:
 *   - World coords: (x, y, z) — absolute block position
 *   - Chunk coords: (chunkX, chunkZ) = (x >> 4, z >> 4)
 *   - Local coords: (x & 15, y & 15, z & 15) within a subchunk
 *   - Subchunk index: (y - minY) >> 4
 *
 * PACKET HANDLERS:
 *   Each handle*() method processes a specific Bedrock protocol packet type.
 *   Packet interfaces are defined at the top of this file. The proxy pre-parses
 *   binary protocol data into JSON objects before sending via WebSocket.
 *
 * RELATED FILES:
 *   - WorldRenderer.ts — reads dirty chunks and builds scene meshes
 *   - ChunkMeshBuilder.ts — converts chunk data to Babylon.js meshes
 *   - EntityManager.ts — tracks entity state (separate from world blocks)
 *   - WorldChunk.ts — existing chunk model (used for file-based worlds)
 *   - BlockPalette.ts — block runtime ID → type mapping
 */

import Log from "../../core/Log";

export interface IBlockState {
  runtimeId: number;
  name?: string;
}

export interface ISubChunk {
  blocks: Int32Array | number[]; // 16*16*16 = 4096 runtime IDs (32-bit hashes)
  dirty: boolean;
}

export interface IChunkColumn {
  x: number;
  z: number;
  subchunks: (ISubChunk | undefined)[];
  dirty: boolean;
  meshGenerated: boolean;
}

// Block palette maps runtime IDs to block identifiers
export interface IBlockPaletteEntry {
  name: string;
  states?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bedrock protocol packet interfaces (partial).
// These describe the subset of fields we actually read from decoded packets.
// The proxy pre-parses raw protocol data, so field names may vary between
// protocol versions — hence the optional alternates.
// ---------------------------------------------------------------------------

/** Shared 3D coordinate shape. */
interface IBlockPosition {
  x?: number;
  y?: number;
  z?: number;
  X?: number;
  Y?: number;
  Z?: number;
}

/** Pre-parsed subchunk data attached to a level_chunk packet by the proxy. */
interface IParsedSubChunkEntry {
  y?: number;
  blocks?: number[] | Int32Array;
}

export interface ILevelChunkPacket {
  x: number;
  z: number;
  sub_chunk_count?: number;
  /** Pre-parsed subchunk block arrays (provided by the proxy). */
  subchunks?: IParsedSubChunkEntry[];
  /** Raw payload buffer (legacy path). */
  payload?: ArrayBuffer | Uint8Array;
}

/** A single entry inside a SubChunk response. */
interface ISubChunkResponseEntry {
  result?: string;
  blocks?: number[] | Int32Array;
  dx?: number;
  dy?: number;
  dz?: number;
  yIndex?: number;
}

export interface ISubChunkPacket {
  origin?: { x?: number; z?: number };
  entries?: ISubChunkResponseEntry[];
}

export interface IUpdateBlockPacket {
  position?: IBlockPosition;
  block_position?: IBlockPosition;
  block_runtime_id?: number;
  runtime_id?: number;
}

/** Individual block update within an update_subchunk_blocks batch. */
interface ISubChunkBlockUpdate {
  block_position?: IBlockPosition;
  position?: IBlockPosition;
  block_runtime_id?: number;
  runtime_id?: number;
}

export interface IUpdateSubChunkBlocksPacket {
  blocks?: ISubChunkBlockUpdate[];
  standard_blocks?: ISubChunkBlockUpdate[];
  extra_blocks?: ISubChunkBlockUpdate[];
}

export interface IChunkPublisherUpdatePacket {
  position?: IBlockPosition;
  radius?: number;
}

export interface IStartGameData {
  player_gamemode?: number;
  gamemode?: number;
  world_name?: string;
  difficulty?: number;
  dimension?: number;
  world_spawn?: { x?: number; y?: number; z?: number };
  itemstates?: unknown[];
  block_palette?: Array<{ runtime_id?: number; name?: string; states?: Record<string, unknown> }>;
}

export default class LiveWorldState {
  private _chunks: Map<string, IChunkColumn> = new Map();
  private _blockPalette: Map<number, IBlockPaletteEntry> = new Map();
  private _dirtyChunks: Set<string> = new Set();

  // World settings from StartGamePacket
  private _worldName: string = "";
  private _gameMode: number = 0; // 0=survival, 1=creative, 2=adventure
  private _spawnPosition: { x: number; y: number; z: number } = { x: 0, y: 64, z: 0 };
  private _worldTime: number = 6000; // Default to noon for good sky lighting
  private _minY: number = -64;
  private _maxY: number = 319;
  private _dimensionId: number = 0; // 0=overworld, 1=nether, 2=end
  private _difficulty: number = 1;

  // Clear zone: when set, incoming SubChunk data is automatically filtered.
  // Natural terrain blocks above clearAboveY are replaced with air unless they're
  // in the keepNames whitelist AND below maxKeepY. This prevents SubChunk data
  // races from restoring terrain that was previously cleared.
  private _clearZone?: {
    clearAboveY: number;
    maxKeepY: number;
    keepNames: Set<string>;
  };

  // Stats
  private _loadedChunkCount: number = 0;

  get worldName(): string {
    return this._worldName;
  }
  get gameMode(): number {
    return this._gameMode;
  }
  get spawnPosition(): { x: number; y: number; z: number } {
    return this._spawnPosition;
  }
  get worldTime(): number {
    return this._worldTime;
  }
  set worldTime(t: number) {
    this._worldTime = t;
  }
  get dimensionId(): number {
    return this._dimensionId;
  }
  get minY(): number {
    return this._minY;
  }
  get loadedChunkCount(): number {
    return this._loadedChunkCount;
  }
  get dirtyChunkCount(): number {
    return this._dirtyChunks.size;
  }

  /**
   * Return the center position (in world coordinates) of all loaded chunks.
   * Falls back to spawnPosition if no chunks are loaded.
   */
  getChunkCenter(): { x: number; y: number; z: number } {
    if (this._chunks.size === 0) return { ...this._spawnPosition };

    let sumX = 0;
    let sumZ = 0;
    for (const key of this._chunks.keys()) {
      const parts = key.split(",");
      const cx = parseInt(parts[0], 10);
      const cz = parseInt(parts[1], 10);
      // Chunk center in world coords: chunkX * 16 + 8
      sumX += cx * 16 + 8;
      sumZ += cz * 16 + 8;
    }
    return {
      x: sumX / this._chunks.size,
      y: this._spawnPosition.y,
      z: sumZ / this._chunks.size,
    };
  }

  /**
   * Set a clear zone that automatically filters incoming SubChunk data.
   * Any block above clearAboveY is replaced with air UNLESS it's in keepNames
   * AND at or below maxKeepY. This prevents SubChunk data races from restoring
   * natural terrain that was previously cleared.
   */
  setClearZone(clearAboveY: number, maxKeepY: number, keepNames: Set<string>): void {
    this._clearZone = { clearAboveY, maxKeepY, keepNames };
  }

  clearClearZone(): void {
    this._clearZone = undefined;
  }

  /**
   * Initialize from StartGamePacket data.
   */
  initFromStartGame(data: IStartGameData): void {
    if (!data) return;

    this._gameMode = data.player_gamemode ?? data.gamemode ?? 1;
    this._worldName = data.world_name ?? "";
    this._difficulty = data.difficulty ?? 1;
    this._dimensionId = data.dimension ?? 0;

    if (data.world_spawn) {
      // Bedrock uses Y >= 32768 as a sentinel meaning "spawn on top of highest block".
      // Anything above ~32700 should be treated the same — never a real Y coordinate.
      // Clamp to a reasonable surface default since we don't have chunk data yet.
      let spawnY = data.world_spawn.y ?? 64;
      if (spawnY >= 32700) {
        Log.verbose(
          `LiveWorldState.initFromStartGame: world_spawn Y=${spawnY} is spawn-on-surface sentinel, clamping to 80`
        );
        spawnY = 80;
      }
      this._spawnPosition = {
        x: data.world_spawn.x ?? 0,
        y: spawnY,
        z: data.world_spawn.z ?? 0,
      };
    }

    if (data.itemstates) {
      // Build block palette from item states (contains runtime IDs)
      // The actual block palette comes in the start_game packet
    }

    // Block palette from start_game
    if (data.block_palette) {
      for (const entry of data.block_palette) {
        if (entry.runtime_id !== undefined && entry.name) {
          this._blockPalette.set(entry.runtime_id, {
            name: entry.name,
            states: entry.states,
          });
        }
      }
    }
  }

  /**
   * Get a block at world coordinates.
   */
  getBlock(x: number, y: number, z: number): IBlockState | undefined {
    const chunkX = x >> 4;
    const chunkZ = z >> 4;
    const chunk = this._chunks.get(`${chunkX},${chunkZ}`);
    if (!chunk) return undefined;

    const subchunkIndex = (y - this._minY) >> 4;
    if (subchunkIndex < 0 || subchunkIndex >= chunk.subchunks.length) return undefined;

    const subchunk = chunk.subchunks[subchunkIndex];
    if (!subchunk) return undefined;

    const localX = ((x % 16) + 16) % 16;
    const localY = (((y - this._minY) % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;

    // Bedrock SubChunk storage order is XZY: index = x*256 + z*16 + y
    const runtimeId = subchunk.blocks[localX * 256 + localZ * 16 + localY];
    const paletteEntry = this._blockPalette.get(runtimeId);

    return {
      runtimeId,
      name: paletteEntry?.name ?? `unknown_${runtimeId}`,
    };
  }

  /**
   * Set a block at world coordinates (for client-side prediction).
   */
  setBlock(x: number, y: number, z: number, runtimeId: number): void {
    const chunkX = x >> 4;
    const chunkZ = z >> 4;
    const key = `${chunkX},${chunkZ}`;
    let chunk = this._chunks.get(key);
    if (!chunk) return;

    const subchunkIndex = (y - this._minY) >> 4;
    if (subchunkIndex < 0 || subchunkIndex >= chunk.subchunks.length) return;

    let subchunk = chunk.subchunks[subchunkIndex];
    if (!subchunk) {
      subchunk = {
        blocks: new Int32Array(4096),
        dirty: true,
      };
      chunk.subchunks[subchunkIndex] = subchunk;
    }

    const localX = ((x % 16) + 16) % 16;
    const localY = (((y - this._minY) % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;

    subchunk.blocks[localX * 256 + localZ * 16 + localY] = runtimeId;
    subchunk.dirty = true;
    chunk.dirty = true;
    this._dirtyChunks.add(key);
  }

  /**
   * Check if the chunk containing this position has been loaded.
   */
  isChunkLoaded(x: number, z: number): boolean {
    const chunkX = x >> 4;
    const chunkZ = z >> 4;
    return this._chunks.has(`${chunkX},${chunkZ}`);
  }

  /**
   * Check if a block position is solid (for collision detection).
   */
  isSolid(x: number, y: number, z: number): boolean {
    const block = this.getBlock(x, y, z);
    if (!block) return false;

    const name = block.name ?? "";
    // Air and fluids are not solid
    if (name === "minecraft:air" || name === "" || name === "minecraft:water" || name === "minecraft:lava") {
      return false;
    }
    // Runtime ID 0 is usually air
    if (block.runtimeId === 0) return false;

    // Non-solid blocks that you can't target/interact with
    const short = name.startsWith("minecraft:") ? name.substring(10) : name;
    if (short === "structure_void" || short === "barrier" || short === "light_block" || short.includes("fire")) {
      return false;
    }

    return true;
  }

  /**
   * Handle block_palette event from the proxy.
   * This provides the mapping of runtime IDs to block names.
   */
  handleBlockPalette(entries: { rid: number; name: string }[]): void {
    const prevSize = this._blockPalette.size;
    for (const entry of entries) {
      if (entry.rid !== undefined && entry.name) {
        this._blockPalette.set(entry.rid, { name: entry.name });
      }
    }
    if (prevSize === 0 || this._blockPalette.size < 100) {
      Log.verbose(
        `LiveWorldState.handleBlockPalette: added ${entries.length} entries, palette size now ${this._blockPalette.size}`
      );
    }

    // CRITICAL: Mark all loaded chunks as dirty so they get rebuilt with the new palette.
    // Chunks loaded before the palette arrives have 0 rendered blocks because getBlockName()
    // returned undefined for all runtime IDs. Now that we have the palette, they need rebuilding.
    if (prevSize === 0 && this._blockPalette.size > 0) {
      let rebuildCount = 0;
      for (const [key, chunk] of this._chunks) {
        if (chunk.meshGenerated) {
          chunk.meshGenerated = false;
          this._dirtyChunks.add(key);
          rebuildCount++;
        }
      }
      if (rebuildCount > 0) {
        Log.verbose(`LiveWorldState.handleBlockPalette: marked ${rebuildCount} pre-palette chunks for rebuild`);
      }
    }
  }

  /**
   * Handle a level_chunk packet from the server.
   * The proxy may have pre-parsed subchunk data for us.
   */
  private _levelChunkLogCount: number = 0;
  private _subchunkLogCount: number = 0;

  handleLevelChunk(packet: ILevelChunkPacket): void {
    const chunkX = packet.x;
    const chunkZ = packet.z;
    const key = `${chunkX},${chunkZ}`;

    const totalSubchunks = (this._maxY - this._minY + 1) >> 4;
    const chunk: IChunkColumn = {
      x: chunkX,
      z: chunkZ,
      subchunks: new Array(totalSubchunks).fill(undefined),
      dirty: true,
      meshGenerated: false,
    };

    // Log first few level_chunk packets for debugging
    if (this._levelChunkLogCount < 3) {
      this._levelChunkLogCount++;
      Log.verbose(
        `LiveWorldState.handleLevelChunk: chunk(${chunkX},${chunkZ}) sub_chunk_count=${packet.sub_chunk_count} hasSubchunks=${!!(packet.subchunks && Array.isArray(packet.subchunks))} subchunkArrayLen=${packet.subchunks?.length ?? "N/A"} hasPayload=${!!packet.payload}`
      );
    }

    // If proxy sent parsed subchunk arrays, use them directly
    if (packet.subchunks && Array.isArray(packet.subchunks)) {
      let nonEmptyCount = 0;
      for (const sc of packet.subchunks) {
        const subchunkIndex = sc.y !== undefined ? sc.y - (this._minY >> 4) : 0;
        if (subchunkIndex >= 0 && subchunkIndex < totalSubchunks && sc.blocks) {
          const blocks = new Int32Array(4096);
          let nonZero = 0;
          for (let i = 0; i < Math.min(sc.blocks.length, 4096); i++) {
            blocks[i] = sc.blocks[i];
            if (sc.blocks[i] !== 0) nonZero++;
          }
          chunk.subchunks[subchunkIndex] = { blocks, dirty: true };
          if (nonZero > 0) nonEmptyCount++;

          // Apply clear zone filter to incoming level_chunk data
          if (this._clearZone) {
            this._applyClearZoneToSubchunk(blocks, subchunkIndex);
          }
        }
      }
      if (this._levelChunkLogCount <= 3) {
        Log.verbose(`  -> parsed ${packet.subchunks.length} subchunks, ${nonEmptyCount} non-empty`);
      }
    } else if (packet.sub_chunk_count !== undefined && packet.payload) {
      // Legacy: proxy sent raw payload
      this._parseLevelChunkPayload(chunk, packet);
    }

    this._chunks.set(key, chunk);
    this._dirtyChunks.add(key);
    this._loadedChunkCount = this._chunks.size;
  }

  /**
   * Handle a subchunk packet (from the proxy's parsed SubChunk response).
   * The proxy resolves PalettedBlockStorage and sends pre-parsed block arrays.
   * Origin is in sub-chunk coordinates (chunkX, subchunkY, chunkZ) — already
   * in chunk coordinate space. Do NOT right-shift by 4 (that would be double-shifting).
   */
  handleSubChunk(packet: ISubChunkPacket): void {
    if (!packet.entries || !Array.isArray(packet.entries)) {
      if (this._subchunkLogCount < 3) {
        this._subchunkLogCount++;
        Log.verbose(`LiveWorldState.handleSubChunk: no entries array. keys=${Object.keys(packet).join(",")}`);
      }
      return;
    }

    const originX = packet.origin?.x ?? 0;
    const originZ = packet.origin?.z ?? 0;

    // Origin is in sub-chunk coordinates (chunkX, subchunkY, chunkZ).
    // x and z are already chunk coordinates — use directly without >> 4.
    const baseChunkX = originX;
    const baseChunkZ = originZ;

    let successCount = 0;
    let blockDataCount = 0;

    for (const entry of packet.entries) {
      if (entry.result !== "success" || !entry.blocks) continue;
      successCount++;

      const chunkX = baseChunkX + (entry.dx ?? 0);
      const chunkZ = baseChunkZ + (entry.dz ?? 0);
      const subY = entry.dy ?? 0;
      const yIndex = entry.yIndex ?? subY;
      const key = `${chunkX},${chunkZ}`;

      let chunk = this._chunks.get(key);
      if (!chunk) {
        const totalSubchunks = (this._maxY - this._minY + 1) >> 4;
        chunk = {
          x: chunkX,
          z: chunkZ,
          subchunks: new Array(totalSubchunks).fill(undefined),
          dirty: true,
          meshGenerated: false,
        };
        this._chunks.set(key, chunk);
      }

      const subchunkIndex = yIndex - (this._minY >> 4);
      if (subchunkIndex >= 0 && subchunkIndex < chunk.subchunks.length) {
        const blocks = new Int32Array(4096);
        const srcBlocks = entry.blocks;
        let nonZero = 0;
        for (let i = 0; i < Math.min(srcBlocks.length, 4096); i++) {
          blocks[i] = srcBlocks[i];
          if (srcBlocks[i] !== 0) nonZero++;
        }
        if (nonZero > 0) blockDataCount++;

        chunk.subchunks[subchunkIndex] = {
          blocks: blocks,
          dirty: true,
        };

        // Apply clear zone filter to incoming SubChunk data
        if (this._clearZone) {
          this._applyClearZoneToSubchunk(blocks, subchunkIndex);
        }
      }

      chunk.dirty = true;
      this._dirtyChunks.add(key);

      // Mark adjacent chunks dirty for face-culling recalculation.
      // When a chunk loads, its neighbors' edge blocks may have been rendered
      // as "exposed" because this chunk's data wasn't available yet.
      // Now that we have data, neighbors need to recalculate face culling.
      for (const [adjDx, adjDz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const adjKey = `${chunkX + adjDx},${chunkZ + adjDz}`;
        const adjChunk = this._chunks.get(adjKey);
        if (adjChunk && adjChunk.meshGenerated) {
          adjChunk.meshGenerated = false;
          this._dirtyChunks.add(adjKey);
        }
      }
    }

    if (this._subchunkLogCount < 5) {
      this._subchunkLogCount++;
      Log.verbose(
        `LiveWorldState.handleSubChunk: origin=(${originX},${originZ}) entries=${packet.entries.length} success=${successCount} withBlockData=${blockDataCount}`
      );
      if (packet.entries.length > 0) {
        const e = packet.entries[0];
        Log.verbose(
          `  first entry: result=${e.result} hasBlocks=${!!e.blocks} blocksLen=${e.blocks?.length ?? "N/A"} dx=${e.dx} dy=${e.dy} yIndex=${e.yIndex}`
        );
      }
    }

    this._loadedChunkCount = this._chunks.size;
  }

  /**
   * Handle update_block packet.
   */
  handleUpdateBlock(packet: IUpdateBlockPacket): void {
    const pos = packet.position ?? packet.block_position;
    if (!pos) return;

    const x = pos.x ?? pos.X ?? 0;
    const y = pos.y ?? pos.Y ?? 0;
    const z = pos.z ?? pos.Z ?? 0;
    const runtimeId = packet.block_runtime_id ?? packet.runtime_id ?? 0;

    this.setBlock(x, y, z, runtimeId);
  }

  /**
   * Handle update_subchunk_blocks — batch block updates within a subchunk.
   */
  handleUpdateSubChunkBlocks(packet: IUpdateSubChunkBlocksPacket): void {
    const updates = packet.blocks ?? packet.standard_blocks ?? [];
    const extraUpdates = packet.extra_blocks ?? [];

    for (const update of [...updates, ...extraUpdates]) {
      const pos = update.block_position ?? update.position;
      if (!pos) continue;
      const x = pos.x ?? pos.X ?? 0;
      const y = pos.y ?? pos.Y ?? 0;
      const z = pos.z ?? pos.Z ?? 0;
      const runtimeId = update.block_runtime_id ?? update.runtime_id ?? 0;
      this.setBlock(x, y, z, runtimeId);
    }
  }

  /**
   * Handle network_chunk_publisher_update — defines which chunks should be loaded.
   */
  handleChunkPublisherUpdate(packet: IChunkPublisherUpdatePacket): void {
    // Could unload chunks outside the radius, but for now keep everything
  }

  /**
   * Get chunk at chunk coordinates.
   */
  getChunk(chunkX: number, chunkZ: number): IChunkColumn | undefined {
    return this._chunks.get(`${chunkX},${chunkZ}`);
  }

  /**
   * Get all dirty chunks and clear dirty flags.
   */
  consumeDirtyChunks(): IChunkColumn[] {
    const dirty: IChunkColumn[] = [];
    for (const key of this._dirtyChunks) {
      const chunk = this._chunks.get(key);
      if (chunk) {
        dirty.push(chunk);
        chunk.dirty = false;
        if (chunk.subchunks) {
          for (const sc of chunk.subchunks) {
            if (sc) sc.dirty = false;
          }
        }
      }
    }
    this._dirtyChunks.clear();
    return dirty;
  }

  /**
   * Mark a chunk as dirty so it will be rebuilt on next consumeDirtyChunks call.
   */
  markChunkDirty(chunk: IChunkColumn): void {
    chunk.dirty = true;
    this._dirtyChunks.add(`${chunk.x},${chunk.z}`);
  }

  /**
   * Get all loaded chunks.
   */
  getAllChunks(): IChunkColumn[] {
    return Array.from(this._chunks.values());
  }

  /**
   * Read-only access to the chunks map for iteration.
   * Used by WorldRenderer.ensureNearbyChunkMeshes() to scan for chunks
   * within render distance that need mesh generation.
   */
  get chunks(): ReadonlyMap<string, IChunkColumn> {
    return this._chunks;
  }

  /**
   * Get a chunk by its key string ("chunkX,chunkZ").
   */
  getChunkByKey(key: string): IChunkColumn | undefined {
    return this._chunks.get(key);
  }

  /**
   * Add or replace a chunk column directly.
   * Used by WorldViewer to feed pre-built chunk data from file-based MCWorld.
   */
  setChunkColumn(chunk: IChunkColumn): void {
    const key = `${chunk.x},${chunk.z}`;
    this._chunks.set(key, chunk);
    this._loadedChunkCount = this._chunks.size;
    if (chunk.dirty) {
      this._dirtyChunks.add(key);
    }
  }

  /**
   * Mark ALL loaded chunks as dirty, forcing a complete mesh rebuild.
   * Useful after fill commands or other bulk world modifications.
   */
  markAllChunksDirty(): void {
    for (const [key, chunk] of this._chunks) {
      chunk.dirty = true;
      this._dirtyChunks.add(key);
    }
  }

  /**
   * Get block palette entry by runtime ID.
   */
  private _lookupLogCount: number = 0;
  private _lookupMissCount: number = 0;
  private _lookupHitCount: number = 0;

  getBlockName(runtimeId: number): string {
    const entry = this._blockPalette.get(runtimeId);
    if (entry) {
      this._lookupHitCount++;
    } else {
      this._lookupMissCount++;
      if (this._lookupLogCount < 5 && runtimeId !== 0) {
        this._lookupLogCount++;
        Log.verbose(
          `LiveWorldState.getBlockName: MISS runtimeId=${runtimeId} paletteSize=${this._blockPalette.size} hits=${this._lookupHitCount} misses=${this._lookupMissCount}`
        );
      }
    }
    return entry?.name ?? "minecraft:air";
  }

  /**
   * Unload all chunks (e.g., on dimension change).
   */
  clear(): void {
    this._chunks.clear();
    this._dirtyChunks.clear();
    this._loadedChunkCount = 0;
  }

  /**
   * Parse a level_chunk payload into subchunk data.
   * The payload format depends on the network protocol version, but decoded
   * packets typically give us the raw subchunk data as a Buffer.
   */
  private _parseLevelChunkPayload(chunk: IChunkColumn, packet: ILevelChunkPacket): void {
    // For now, create placeholder subchunks from the data.
    // In many cases the decoded packet already parsed the payload structure for us.
    const subchunkCount = packet.sub_chunk_count;

    if (typeof subchunkCount === "number" && subchunkCount > 0) {
      // If payload is a buffer, we need to parse sub-chunk format
      // Each subchunk uses PalettedBlockStorage format
      // For the initial implementation, we'll populate from parsed data when available
      for (let i = 0; i < Math.min(subchunkCount, chunk.subchunks.length); i++) {
        if (!chunk.subchunks[i]) {
          chunk.subchunks[i] = {
            blocks: new Int32Array(4096),
            dirty: true,
          };
        }
      }
    }
  }

  /**
   * Parse raw subchunk data into an ISubChunk.
   * Bedrock uses PalettedBlockStorage format per subchunk.
   */
  private _parseSubChunkData(payload: IParsedSubChunkEntry | undefined): ISubChunk {
    const subchunk: ISubChunk = {
      blocks: new Int32Array(4096),
      dirty: true,
    };

    // If payload is already parsed (array of block entries), use directly
    if (payload && payload.blocks) {
      for (let i = 0; i < Math.min(payload.blocks.length, 4096); i++) {
        subchunk.blocks[i] = payload.blocks[i];
      }
    }

    return subchunk;
  }

  /**
   * Apply the clear zone filter to a subchunk's block data.
   * Replaces non-whitelisted blocks above clearAboveY with air (runtime ID 0).
   */
  private _applyClearZoneToSubchunk(blocks: Int32Array, subchunkIndex: number): void {
    const zone = this._clearZone;
    if (!zone) return;

    const scBaseY = this._minY + subchunkIndex * 16;
    if (scBaseY + 15 < zone.clearAboveY) return; // entirely below clear zone

    // Find air runtime ID
    let airId = 0;
    if (this._blockPalette) {
      for (const [rid, entry] of this._blockPalette) {
        if (entry.name === "minecraft:air") {
          airId = rid;
          break;
        }
      }
    }

    for (let i = 0; i < 4096; i++) {
      if (blocks[i] === airId || blocks[i] === 0) continue;
      const localY = i % 16;
      const worldY = scBaseY + localY;
      if (worldY < zone.clearAboveY) continue;

      const entry = this._blockPalette?.get?.(blocks[i]);
      const name = entry?.name ?? "";
      if (worldY <= zone.maxKeepY && zone.keepNames.has(name)) continue;

      blocks[i] = airId;
    }
  }
}
