// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import LevelDb, { ILevelDbParsedRecord } from "../minecraft/LevelDb";
import WorldDataMetricsReducer from "../minecraft/WorldDataMetricsReducer";
import IFile from "../storage/IFile";

function varint(value: number): number[] {
  const bytes: number[] = [];

  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 0x80);
  }

  bytes.push(value);
  return bytes;
}

function fixed32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function fixed64Zero(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

function bytesFromString(value: string): number[] {
  return Array.from(value).map((ch) => ch.charCodeAt(0));
}

function stringFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function makeLdbRecord(userKey: number[], value: number[]): number[] {
  const internalKey = [...userKey, 1, 0, 0, 0, 0, 0, 0, 0];
  return [0, ...varint(internalKey.length), ...varint(value.length), ...internalKey, ...value];
}

function makeLdbBlock(records: number[][]): Uint8Array {
  return new Uint8Array([...records.flat(), ...fixed32(0), ...fixed32(1)]);
}

function makeLdbFile(records: number[][]): Uint8Array {
  const dataBlock = makeLdbBlock(records);
  const metaBlock = new Uint8Array([0]);
  const indexValue = [...varint(0), ...varint(dataBlock.length)];
  const indexBlock = makeLdbBlock([makeLdbRecord(bytesFromString("last"), indexValue)]);
  const indexOffset = dataBlock.length + metaBlock.length;
  const footer = new Uint8Array(48);
  const footerPrefix = [
    ...varint(dataBlock.length),
    ...varint(metaBlock.length),
    ...varint(indexOffset),
    ...varint(indexBlock.length),
  ];

  footer.set(footerPrefix, 0);
  footer.set([87, 251, 128, 139, 36, 117, 71, 219], 40);

  const file = new Uint8Array(dataBlock.length + metaBlock.length + indexBlock.length + footer.length);
  file.set(dataBlock, 0);
  file.set(metaBlock, dataBlock.length);
  file.set(indexBlock, indexOffset);
  file.set(footer, indexOffset + indexBlock.length);

  return file;
}

function makeLogFile(entries: { key: number[]; value?: number[]; deleted?: boolean }[]): Uint8Array {
  const batch: number[] = [...fixed64Zero(), ...fixed32(entries.length)];

  for (const entry of entries) {
    batch.push(entry.deleted ? 0 : 1, ...varint(entry.key.length), ...entry.key);

    if (!entry.deleted) {
      const value = entry.value ?? [];
      batch.push(...varint(value.length), ...value);
    }
  }

  return new Uint8Array([...fixed32(0), batch.length & 0xff, (batch.length >>> 8) & 0xff, 1, ...batch]);
}

function makeFile(name: string, content: Uint8Array): IFile {
  return {
    name,
    fullPath: name,
    storageRelativePath: name,
    content,
    isContentLoaded: true,
    loadContent: async () => new Date(),
    unload() {
      this.isContentLoaded = false;
    },
  } as IFile;
}

function chunkKey(x: number, z: number, tag: number, dimension?: number, subchunk?: number): Uint8Array {
  const bytes = new Uint8Array(dimension === undefined ? (subchunk === undefined ? 9 : 10) : subchunk === undefined ? 13 : 14);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, x, true);
  view.setInt32(4, z, true);

  if (dimension === undefined) {
    bytes[8] = tag;
    if (subchunk !== undefined) {
      bytes[9] = subchunk;
    }
  } else {
    view.setInt32(8, dimension, true);
    bytes[12] = tag;
    if (subchunk !== undefined) {
      bytes[13] = subchunk;
    }
  }

  return bytes;
}

function record(keyBytes: Uint8Array, isDeleted?: boolean, key?: string, value?: Uint8Array): ILevelDbParsedRecord {
  return {
    ordinal: 0,
    key: key ?? stringFromBytes(keyBytes),
    keyBytes,
    value,
    isDeleted,
    sourceKind: "log",
  };
}

function normalizeMetrics(metrics: ReturnType<WorldDataMetricsReducer["getMetrics"]>) {
  const normalized: any = {
    ...metrics,
    dimensionIds: Array.from(metrics.dimensionIds).sort((a, b) => a - b),
  };
  delete normalized.dimensionNameIdTableBytes;

  if (metrics.dimensionNameIdTableBytes) {
    normalized.dimensionNameIdTableBytes = Array.from(metrics.dimensionNameIdTableBytes);
  }

  return normalized;
}

describe("LevelDb.forEachRecord", () => {
  it("streams LDB and LOG records without populating keys", async () => {
    const ldb = makeLdbFile([makeLdbRecord(bytesFromString("alpha"), [1, 2, 3])]);
    const log = makeLogFile([{ key: bytesFromString("beta"), value: [4] }]);
    const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [makeFile("000002.log", log)], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((rec) => records.push(rec), { includeValues: true });

    assert.deepEqual(
      records.map((rec) => `${rec.sourceKind}:${rec.key}`),
      ["ldb:alpha", "log:beta"]
    );
    assert.deepEqual(Array.from(records[0].keyBytes), bytesFromString("alpha"));
    assert.deepEqual(Array.from(records[0].value ?? []), [1, 2, 3]);
    assert.strictEqual(levelDb.keys.size, 0);
  });

  it("omits values when requested", async () => {
    const log = makeLogFile([{ key: bytesFromString("beta"), value: [4] }]);
    const levelDb = new LevelDb([], [makeFile("000001.log", log)], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((rec) => records.push(rec), { includeValues: false });

    assert.strictEqual(records.length, 1);
    assert.isUndefined(records[0].value);
  });

  it("emits LOG tombstones only when includeDeleted is enabled", async () => {
    const log = makeLogFile([{ key: bytesFromString("gone"), deleted: true }]);
    const levelDb = new LevelDb([], [makeFile("000001.log", log)], [], "test");
    const withDeleted: ILevelDbParsedRecord[] = [];
    const withoutDeleted: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((rec) => withDeleted.push(rec), { includeDeleted: true });
    await new LevelDb([], [makeFile("000001.log", log)], [], "test").forEachRecord((rec) => withoutDeleted.push(rec), {
      includeDeleted: false,
    });

    assert.strictEqual(withDeleted.length, 1);
    assert.strictEqual(withDeleted[0].key, "gone");
    assert.strictEqual(withDeleted[0].isDeleted, true);
    assert.strictEqual(withoutDeleted.length, 0);
  });

  it("can reduce visitor output to the same effective records as init", async () => {
    const ldb = makeLdbFile([
      makeLdbRecord(bytesFromString("duplicate"), [1]),
      makeLdbRecord(bytesFromString("removed"), [2]),
    ]);
    const log = makeLogFile([
      { key: bytesFromString("duplicate"), value: [3] },
      { key: bytesFromString("removed"), deleted: true },
    ]);
    const initDb = new LevelDb([makeFile("000001.ldb", ldb)], [makeFile("000002.log", log)], [], "test");
    const visitorDb = new LevelDb([makeFile("000001.ldb", ldb)], [makeFile("000002.log", log)], [], "test");
    const reduced = new Map<string, number[] | false>();

    await initDb.init();
    await visitorDb.forEachRecord(
      (rec) => {
        reduced.set(rec.key, rec.isDeleted ? false : Array.from(rec.value ?? []));
      },
      { includeValues: true, includeDeleted: true }
    );

    const duplicate = initDb.keys.get("duplicate");

    assert.isOk(duplicate && typeof duplicate !== "boolean");
    assert.deepEqual(Array.from((duplicate && typeof duplicate !== "boolean" ? duplicate.value : undefined) ?? []), [3]);
    assert.strictEqual(initDb.keys.get("removed"), false);
    assert.deepEqual(reduced.get("duplicate"), [3]);
    assert.strictEqual(reduced.get("removed"), false);
    assert.strictEqual(visitorDb.keys.size, 0);
  });
});

describe("WorldDataMetricsReducer", () => {
  it("applies duplicate puts and tombstones using last-write-wins semantics", () => {
    const subchunk = chunkKey(1, 2, 47, undefined, 0);
    const reducer = new WorldDataMetricsReducer();

    reducer.visit(record(subchunk));
    reducer.visit(record(subchunk));
    reducer.visit(record(subchunk, true));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: false,
    });

    reducer.visit(record(subchunk));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 1,
      subchunkLessChunkCount: 0,
      minX: 16,
      maxX: 32,
      minZ: 32,
      maxZ: 48,
      dimensionIds: [0],
      hasDimensionNameIdTable: false,
    });
  });

  it("computes chunk metrics for 9, 10, 13, and 14 byte keys", () => {
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([
      record(chunkKey(0, 0, 44)),
      record(chunkKey(1, 0, 47, undefined, 0)),
      record(chunkKey(-1, 2, 44, 1)),
      record(chunkKey(2, -2, 47, 2, 0)),
    ]);

    assert.deepEqual(normalizeMetrics(metrics), {
      chunkCount: 4,
      subchunkLessChunkCount: 2,
      minX: -16,
      maxX: 48,
      minZ: -32,
      maxZ: 48,
      dimensionIds: [0, 1, 2],
      hasDimensionNameIdTable: false,
    });
  });

  it("ignores dimension-encoded overworld, custom dimensions, invalid tags, and digp records for world metrics", () => {
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([
      record(chunkKey(0, 0, 44, 0)),
      record(chunkKey(0, 0, 44, 1000)),
      record(new Uint8Array(bytesFromString("abcdefghi"))),
      record(new Uint8Array(bytesFromString("digp12345")), false, "digp12345"),
    ]);

    assert.deepEqual(normalizeMetrics(metrics), {
      chunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [0, 1000],
      hasDimensionNameIdTable: false,
    });
  });

  it("tracks DimensionNameIdTable value and tombstones for CDWORLDDATA", () => {
    const tableBytes = new Uint8Array([1, 2, 3]);
    const reducer = new WorldDataMetricsReducer();

    reducer.visit(record(new Uint8Array(bytesFromString("DimensionNameIdTable")), false, "DimensionNameIdTable", tableBytes));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: true,
      dimensionNameIdTableBytes: [1, 2, 3],
    });

    reducer.visit(record(new Uint8Array(bytesFromString("DimensionNameIdTable")), true, "DimensionNameIdTable"));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: false,
    });
  });
});
