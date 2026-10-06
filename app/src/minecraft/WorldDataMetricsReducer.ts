// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Metadata-only world validation consumes LevelDb.forEachRecord without retaining payloads.
 * Coordinates and live-record counters are stored once per chunk; each exact record suffix
 * maps to a scalar combining its sequence and deletion bit, not a second metadata object/map.
 * Tombstone versions survive even when a chunk becomes empty so older SST/LOG records cannot
 * resurrect it. BigInt preserves the full LevelDB sequence; unversioned records retain visit order.
 *
 * Within a chunk, suffix identity includes the tag, optional trailing byte (including zero),
 * and explicit-dimension marker. Implicit and explicit dimension-zero keys must remain distinct:
 * both contribute dimension adoption, but only implicit overworld keys contribute world bounds.
 * MCWorld's full-load path also uses getChunkRecordMetadata; its classification stays shared.
 */

import DataUtilities from "../core/DataUtilities";
import type { ILevelDbParsedRecord } from "./LevelDb";

export interface IWorldDataMetrics {
  chunkCount: number;
  customDimensionChunkCount: number;
  subchunkLessChunkCount: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  dimensionIds: Set<number>;
  hasDimensionNameIdTable: boolean;
  dimensionNameIdTableBytes?: Uint8Array;
}

export interface IChunkRecordMetadata {
  chunkKey: string;
  dimension: number;
  x: number;
  z: number;
  hasSubchunk: boolean;
  includeInWorldMetrics: boolean;
}

// BigInt: sequence in the high bits, deletion in bit zero. Boolean: unversioned live/deleted.
type ChunkRecordState = bigint | boolean;

interface IChunkMetricsState {
  x: number;
  z: number;
  dimension: number;
  records: Map<number, ChunkRecordState>;
  liveRecords: number;
  worldRecords: number;
  worldSubchunks: number;
}

const LevelChunkTags = new Set<number>([
  43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 72, 115, 118, 119, 120,
]);

const SubchunkPrefixTag = 47;

const NamedWorldRecordPrefixes = [
  "AutonomousEntities",
  "schedulerWT",
  "Overworld",
  "BiomeData",
  "digp",
  "actorprefix",
  "player",
  "portals",
  "LevelChunk",
  "structuretemplate",
  "~local_player",
  "game_",
  "CustomProperties",
  "DynamicProperties",
  "LevelSpawnWasFixed",
  "VILLAGE_",
  "gametestinstance_",
  "tickingarea_",
  "map_",
  "scoreboard",
  "SavedEntity",
  "ServerMapRuntime",
  "VillageRuntime",
  "WorldFeatureRuntime",
  "WorldGenerationRuntime",
  "WorldStreamRuntime",
  "BSharpRuntime",
  "BadgerSynced",
  "CinematicsRuntime",
  "CustomGameOptions",
  "DeckRuntime",
  "EntityFactorySetup",
  "GeologyRuntime",
  "InvasionRuntime",
  "MapRevealRuntime",
  "RealmsStoriesData",
  "mobevents",
  "dimension",
  "structureplacement",
  "chunk_loaded_request",
  "legacy_console_player",
  "PosTrackDB",
  "PositionTrackDB",
  "OwnedEntitiesLimbo",
  "MCeditMap",
  "EDU_CurrentCodingURL",
  "TheEnd",
  "SST_",
  "SUSP",
  "neteaseData",
  "scriptGid",
  "Nether",
  "game_flatworldlayers",
];

export default class WorldDataMetricsReducer {
  private _chunks = new Map<string, IChunkMetricsState>();
  private _dimensionNameIdTableState?: ChunkRecordState;
  private _hasDimensionNameIdTable = false;
  private _dimensionNameIdTableBytes?: Uint8Array;

  visit(record: ILevelDbParsedRecord) {
    if (record.key === "DimensionNameIdTable") {
      const sequenceNumber = record.sequenceNumber === undefined ? undefined : BigInt(record.sequenceNumber);
      if (!WorldDataMetricsReducer.shouldApplyRecord(this._dimensionNameIdTableState, sequenceNumber)) {
        return;
      }

      this._dimensionNameIdTableState = WorldDataMetricsReducer.getRecordState(record, sequenceNumber);
      this._hasDimensionNameIdTable = !record.isDeleted;
      this._dimensionNameIdTableBytes = !record.isDeleted && record.value ? new Uint8Array(record.value) : undefined;
      return;
    }

    if (WorldDataMetricsReducer.isNamedWorldRecordKey(record.key)) {
      return;
    }

    const metadata = WorldDataMetricsReducer.getChunkRecordMetadata(record.keyBytes);

    if (!metadata) {
      return;
    }

    let chunk = this._chunks.get(metadata.chunkKey);
    if (!chunk) {
      chunk = {
        x: metadata.x,
        z: metadata.z,
        dimension: metadata.dimension,
        records: new Map(),
        liveRecords: 0,
        worldRecords: 0,
        worldSubchunks: 0,
      };
      this._chunks.set(metadata.chunkKey, chunk);
    }

    const identity = WorldDataMetricsReducer.getRecordSuffixIdentity(record.keyBytes);
    const currentState = chunk.records.get(identity);
    const sequenceNumber = record.sequenceNumber === undefined ? undefined : BigInt(record.sequenceNumber);
    if (!WorldDataMetricsReducer.shouldApplyRecord(currentState, sequenceNumber)) {
      return;
    }

    const wasLive = WorldDataMetricsReducer.isLiveRecord(currentState);
    const isLive = !record.isDeleted;
    chunk.records.set(identity, WorldDataMetricsReducer.getRecordState(record, sequenceNumber));

    if (wasLive !== isLive) {
      const delta = isLive ? 1 : -1;
      chunk.liveRecords += delta;
      if (metadata.includeInWorldMetrics) {
        chunk.worldRecords += delta;
        if (metadata.hasSubchunk) {
          chunk.worldSubchunks += delta;
        }
      }
    }
  }

  private static shouldApplyRecord(currentState: ChunkRecordState | undefined, sequenceNumber?: bigint): boolean {
    return sequenceNumber === undefined || typeof currentState !== "bigint" || currentState >> 1n < sequenceNumber;
  }

  private static getRecordState(record: ILevelDbParsedRecord, sequenceNumber?: bigint): ChunkRecordState {
    if (sequenceNumber === undefined) {
      return !record.isDeleted;
    }

    return (sequenceNumber << 1n) | (record.isDeleted ? 1n : 0n);
  }

  private static isLiveRecord(state: ChunkRecordState | undefined): boolean {
    return typeof state === "bigint" ? (state & 1n) === 0n : state === true;
  }

  getMetrics(): IWorldDataMetrics {
    const metrics: IWorldDataMetrics = {
      chunkCount: 0,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: new Set(),
      hasDimensionNameIdTable: this._hasDimensionNameIdTable,
      dimensionNameIdTableBytes: this._dimensionNameIdTableBytes,
    };

    for (const chunk of this._chunks.values()) {
      if (chunk.liveRecords === 0) {
        continue;
      }
      metrics.dimensionIds.add(chunk.dimension);
      if (chunk.dimension >= 1000) {
        metrics.customDimensionChunkCount++;
      }
      if (chunk.worldRecords === 0) {
        continue;
      }
      metrics.chunkCount++;
      if (chunk.worldSubchunks === 0) {
        metrics.subchunkLessChunkCount++;
      }

      const minX = chunk.x * 16;
      const maxX = (chunk.x + 1) * 16;
      const minZ = chunk.z * 16;
      const maxZ = (chunk.z + 1) * 16;

      metrics.minX = metrics.minX === undefined ? minX : Math.min(metrics.minX, minX);
      metrics.maxX = metrics.maxX === undefined ? maxX : Math.max(metrics.maxX, maxX);
      metrics.minZ = metrics.minZ === undefined ? minZ : Math.min(metrics.minZ, minZ);
      metrics.maxZ = metrics.maxZ === undefined ? maxZ : Math.max(metrics.maxZ, maxZ);
    }

    return metrics;
  }

  static getMetricsForRecords(records: Iterable<ILevelDbParsedRecord>): IWorldDataMetrics {
    const reducer = new WorldDataMetricsReducer();

    for (const record of records) {
      reducer.visit(record);
    }

    return reducer.getMetrics();
  }

  static isNamedWorldRecordKey(key: string): boolean {
    return (
      NamedWorldRecordPrefixes.some((prefix) => key.startsWith(prefix)) ||
      key.includes("WasPicked") ||
      key.includes("TextIg")
    );
  }

  static getChunkRecordMetadata(keyBytes: Uint8Array): IChunkRecordMetadata | undefined {
    if (keyBytes.length !== 9 && keyBytes.length !== 10 && keyBytes.length !== 13 && keyBytes.length !== 14) {
      return undefined;
    }

    const hasDimension = keyBytes.length >= 13;
    const tagOffset = hasDimension ? 12 : 8;
    const tag = keyBytes[tagOffset];

    if (!LevelChunkTags.has(tag)) {
      return undefined;
    }

    let dimension = 0;
    let includeInWorldMetrics = true;

    if (hasDimension) {
      dimension = DataUtilities.getSignedInteger(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11], true);

      if (dimension < 0) {
        return undefined;
      }

      includeInWorldMetrics = dimension >= 1 && dimension <= 2;
    }

    const x = DataUtilities.getSignedInteger(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3], true);
    const z = DataUtilities.getSignedInteger(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7], true);

    return {
      chunkKey: `${dimension}_${x}_${z}`,
      dimension,
      x: x,
      z: z,
      hasSubchunk: tag === SubchunkPrefixTag,
      includeInWorldMetrics,
    };
  }

  private static getRecordSuffixIdentity(keyBytes: Uint8Array): number {
    const hasDimension = keyBytes.length >= 13;
    const tagOffset = hasDimension ? 12 : 8;
    // Exact byte fields, not a hash: tag occupies bits 0-7, trailing byte + 1 occupies
    // bits 8-16 (zero means absent), and bit 17 distinguishes explicit dimensions.
    const trailingByte = keyBytes.length > tagOffset + 1 ? keyBytes[tagOffset + 1] + 1 : 0;
    return keyBytes[tagOffset] | (trailingByte << 8) | (hasDimension ? 1 << 17 : 0);
  }
}
