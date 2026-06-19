// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import DataUtilities from "../core/DataUtilities";
import { ILevelDbParsedRecord } from "./LevelDb";

export interface IWorldDataMetrics {
  chunkCount: number;
  subchunkLessChunkCount: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  dimensionIds: Set<number>;
  hasDimensionNameIdTable: boolean;
  dimensionNameIdTableBytes?: Uint8Array;
}

interface IChunkRecordMetadata {
  chunkKey: string;
  dimension: number;
  x: number;
  z: number;
  hasSubchunk: boolean;
  includeInWorldMetrics: boolean;
}

const LevelChunkTags = new Set<number>([
  43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 118, 119, 120,
]);

const SubchunkPrefixTag = 47;

export default class WorldDataMetricsReducer {
  private _effectiveRecordsByKey = new Map<string, IChunkRecordMetadata>();
  private _hasDimensionNameIdTable = false;
  private _dimensionNameIdTableBytes?: Uint8Array;

  visit(record: ILevelDbParsedRecord) {
    if (record.key === "DimensionNameIdTable") {
      this._hasDimensionNameIdTable = !record.isDeleted;
      this._dimensionNameIdTableBytes =
        !record.isDeleted && record.value ? new Uint8Array(record.value) : undefined;
      return;
    }

    if (record.key.startsWith("digp")) {
      return;
    }

    const metadata = WorldDataMetricsReducer.getChunkRecordMetadata(record.keyBytes);

    if (!metadata) {
      return;
    }

    const identity = WorldDataMetricsReducer.getRecordIdentity(record.keyBytes);

    if (record.isDeleted) {
      this._effectiveRecordsByKey.delete(identity);
    } else {
      this._effectiveRecordsByKey.set(identity, metadata);
    }
  }

  getMetrics(): IWorldDataMetrics {
    const chunks = new Map<string, { x: number; z: number; hasSubchunk: boolean }>();
    const dimensionIds = new Set<number>();

    for (const metadata of this._effectiveRecordsByKey.values()) {
      dimensionIds.add(metadata.dimension);

      if (!metadata.includeInWorldMetrics) {
        continue;
      }

      let chunk = chunks.get(metadata.chunkKey);

      if (!chunk) {
        chunk = { x: metadata.x, z: metadata.z, hasSubchunk: false };
        chunks.set(metadata.chunkKey, chunk);
      }

      if (metadata.hasSubchunk) {
        chunk.hasSubchunk = true;
      }
    }

    const metrics: IWorldDataMetrics = {
      chunkCount: chunks.size,
      subchunkLessChunkCount: 0,
      dimensionIds,
      hasDimensionNameIdTable: this._hasDimensionNameIdTable,
      dimensionNameIdTableBytes: this._dimensionNameIdTableBytes,
    };

    for (const chunk of chunks.values()) {
      if (!chunk.hasSubchunk) {
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

  private static getChunkRecordMetadata(keyBytes: Uint8Array): IChunkRecordMetadata | undefined {
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

  private static getRecordIdentity(keyBytes: Uint8Array): string {
    let identity = "";

    for (let i = 0; i < keyBytes.length; i++) {
      identity += String.fromCharCode(keyBytes[i]);
    }

    return identity;
  }
}
