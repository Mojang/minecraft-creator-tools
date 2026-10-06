// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { deflateRawSync, deflateSync } from "zlib";
import LevelDb, { ILevelDbParsedRecord } from "../minecraft/LevelDb";
import LevelKeyValue from "../minecraft/LevelKeyValue";
import MCWorld from "../minecraft/MCWorld";
import Varint from "../minecraft/Varint";
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

function fixed64(value: number): number[] {
  const bytes = new Array<number>(8).fill(0);
  let remainingValue = value;

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = remainingValue & 0xff;
    remainingValue = Math.floor(remainingValue / 0x100);
  }

  return bytes;
}

function bytesFromString(value: string): number[] {
  return Array.from(value).map((ch) => ch.charCodeAt(0));
}

function stringFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function makeLdbRecord(
  userKey: number[],
  value: number[],
  sequence = 0,
  deleted = false,
  valueType = deleted ? 0 : 1
): number[] {
  const internalKeyTrailer = new Array<number>(8).fill(0);
  internalKeyTrailer[0] = valueType;

  let remainingSequence = sequence;
  for (let index = 1; index < internalKeyTrailer.length; index++) {
    internalKeyTrailer[index] = remainingSequence & 0xff;
    remainingSequence = Math.floor(remainingSequence / 0x100);
  }

  const internalKey = [...userKey, ...internalKeyTrailer];
  return [0, ...varint(internalKey.length), ...varint(value.length), ...internalKey, ...value];
}

function makePrefixCompressedLdbRecord(
  sharedByteLength: number,
  userKey: number[],
  value: number[],
  sequence = 0
): number[] {
  const fullRecord = makeLdbRecord(userKey, value, sequence);
  const sharedLengthBytes = varint(0).length;
  const unsharedLength = new Varint(new Uint8Array(fullRecord), sharedLengthBytes).value;
  const valueLengthOffset = sharedLengthBytes + varint(unsharedLength).length;
  const valueLength = new Varint(new Uint8Array(fullRecord), valueLengthOffset);
  const internalKeyOffset = valueLengthOffset + valueLength.byteLength;
  const internalKey = fullRecord.slice(internalKeyOffset, internalKeyOffset + unsharedLength);
  const unsharedInternalKey = internalKey.slice(sharedByteLength);

  return [
    ...varint(sharedByteLength),
    ...varint(unsharedInternalKey.length),
    ...varint(value.length),
    ...unsharedInternalKey,
    ...value,
  ];
}

function makeLdbBlock(records: number[][]): Uint8Array {
  return new Uint8Array([...records.flat(), ...fixed32(0), ...fixed32(1)]);
}

type LdbCompressionMode = "none" | "raw" | "wrapped";

function compressBlock(block: Uint8Array, mode: LdbCompressionMode): Uint8Array {
  if (mode === "raw") {
    return deflateRawSync(block);
  }

  if (mode === "wrapped") {
    return deflateSync(block);
  }

  return block;
}

function makeLdbFile(records: number[][], compressionMode: LdbCompressionMode = "none"): Uint8Array {
  const uncompressedDataBlock = makeLdbBlock(records);
  const dataBlock = compressBlock(uncompressedDataBlock, compressionMode);
  const metaBlock = new Uint8Array([0]);
  const indexValue = [...varint(0), ...varint(dataBlock.length)];
  const uncompressedIndexBlock = makeLdbBlock([makeLdbRecord(bytesFromString("last"), indexValue)]);
  const indexBlock = compressBlock(uncompressedIndexBlock, compressionMode);
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

function makeMultiBlockLdbFile(
  blocks: Array<{ records: number[][]; lastUserKey: number[]; lastSequence: number }>
): Uint8Array {
  const dataBlocks = blocks.map((block) => makeLdbBlock(block.records));
  const metaBlock = new Uint8Array([0]);
  let blockOffset = 0;
  const indexRecords: number[][] = [];

  for (let index = 0; index < blocks.length; index++) {
    const dataBlock = dataBlocks[index];
    const indexValue = [...varint(blockOffset), ...varint(dataBlock.length)];
    indexRecords.push(makeLdbRecord(blocks[index].lastUserKey, indexValue, blocks[index].lastSequence));
    blockOffset += dataBlock.length;
  }

  const indexBlock = makeLdbBlock(indexRecords);
  const indexOffset = blockOffset + metaBlock.length;
  const footer = new Uint8Array(48);
  const footerPrefix = [
    ...varint(blockOffset),
    ...varint(metaBlock.length),
    ...varint(indexOffset),
    ...varint(indexBlock.length),
  ];

  footer.set(footerPrefix, 0);
  footer.set([87, 251, 128, 139, 36, 117, 71, 219], 40);

  const file = new Uint8Array(blockOffset + metaBlock.length + indexBlock.length + footer.length);
  let writeOffset = 0;
  for (const dataBlock of dataBlocks) {
    file.set(dataBlock, writeOffset);
    writeOffset += dataBlock.length;
  }
  file.set(metaBlock, blockOffset);
  file.set(indexBlock, indexOffset);
  file.set(footer, indexOffset + indexBlock.length);

  return file;
}

function makeLogFile(
  entries: { key: number[]; value?: number[]; deleted?: boolean }[],
  startSequence = 0
): Uint8Array {
  const batch: number[] = [...fixed64(startSequence), ...fixed32(entries.length)];

  for (const entry of entries) {
    batch.push(entry.deleted ? 0 : 1, ...varint(entry.key.length), ...entry.key);

    if (!entry.deleted) {
      const value = entry.value ?? [];
      batch.push(...varint(value.length), ...value);
    }
  }

  return new Uint8Array([...fixed32(0), batch.length & 0xff, (batch.length >>> 8) & 0xff, 1, ...batch]);
}

function makeLogPhysicalRecord(payload: number[]): Uint8Array {
  return new Uint8Array([
    ...fixed32(0),
    payload.length & 0xff,
    (payload.length >>> 8) & 0xff,
    1,
    ...payload,
  ]);
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

async function collectLdbRecords(ldb: Uint8Array): Promise<ILevelDbParsedRecord[]> {
  const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
  const records: ILevelDbParsedRecord[] = [];

  await levelDb.forEachRecord((rec) => records.push(rec), { includeValues: true });

  assert.strictEqual(levelDb.keys.size, 0);
  return records;
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
    assert.doesNotThrow(() => JSON.stringify(records));
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

  it("streams raw-zlib-compressed LDB index and data blocks", async () => {
    const ldb = makeLdbFile([makeLdbRecord(bytesFromString("compressed"), [7, 8, 9])], "raw");
    const records = await collectLdbRecords(ldb);

    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].key, "compressed");
    assert.deepEqual(Array.from(records[0].value ?? []), [7, 8, 9]);
  });

  it("streams wrapped-zlib-compressed LDB index and data blocks", async () => {
    const ldb = makeLdbFile([makeLdbRecord(bytesFromString("wrapped"), [10, 11])], "wrapped");
    const records = await collectLdbRecords(ldb);

    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].key, "wrapped");
    assert.deepEqual(Array.from(records[0].value ?? []), [10, 11]);
  });

  it("streams compressed LDB blocks through pako fallback when native zlib is unavailable", async () => {
    const levelDbConstructor = LevelDb as unknown as { _nodeZlib?: unknown };
    const originalNodeZlib = levelDbConstructor._nodeZlib;

    try {
      levelDbConstructor._nodeZlib = false;

      const rawRecords = await collectLdbRecords(
        makeLdbFile([makeLdbRecord(bytesFromString("pako-raw"), [15])], "raw")
      );
      const wrappedRecords = await collectLdbRecords(
        makeLdbFile([makeLdbRecord(bytesFromString("pako-wrapped"), [16, 17])], "wrapped")
      );

      assert.strictEqual(rawRecords[0].key, "pako-raw");
      assert.deepEqual(Array.from(rawRecords[0].value ?? []), [15]);
      assert.strictEqual(wrappedRecords[0].key, "pako-wrapped");
      assert.deepEqual(Array.from(wrappedRecords[0].value ?? []), [16, 17]);
    } finally {
      levelDbConstructor._nodeZlib = originalNodeZlib;
    }
  });

  it("loads raw-zlib-compressed LDB blocks through init", async () => {
    const ldb = makeLdbFile([makeLdbRecord(bytesFromString("init-compressed"), [12])], "raw");
    const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");

    await levelDb.init();

    const value = levelDb.keys.get("init-compressed");
    assert.isOk(value && typeof value !== "boolean");
    assert.deepEqual(Array.from((value && typeof value !== "boolean" ? value.value : undefined) ?? []), [12]);
  });

  it("loads wrapped-zlib-compressed LDB blocks through init", async () => {
    const ldb = makeLdbFile([makeLdbRecord(bytesFromString("init-wrapped"), [13, 14])], "wrapped");
    const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");

    await levelDb.init();

    const value = levelDb.keys.get("init-wrapped");
    assert.isOk(value && typeof value !== "boolean");
    assert.deepEqual(Array.from((value && typeof value !== "boolean" ? value.value : undefined) ?? []), [13, 14]);
  });

  it("releases prefix-compression links after reconstructing SST keys", async () => {
    const firstKey = bytesFromString("prefix-a");
    const secondKey = bytesFromString("prefix-b");
    const ldb = makeLdbFile([
      makeLdbRecord(firstKey, [1], 2),
      makePrefixCompressedLdbRecord(7, secondKey, [2], 1),
      makeLdbRecord(bytesFromString("restart-z"), [3], 0),
    ]);
    const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");

    await levelDb.init();

    const first = levelDb.keys.get("prefix-a");
    const second = levelDb.keys.get("prefix-b");
    const restart = levelDb.keys.get("restart-z");
    assert.isOk(first && typeof first !== "boolean");
    assert.isOk(second && typeof second !== "boolean");
    assert.isOk(restart && typeof restart !== "boolean");
    assert.isUndefined(first && typeof first !== "boolean" ? first.previousKey : undefined);
    assert.isUndefined(second && typeof second !== "boolean" ? second.previousKey : undefined);
    assert.isUndefined(first && typeof first !== "boolean" ? first.internalKeyBytes : undefined);
    assert.isUndefined(second && typeof second !== "boolean" ? second.internalKeyBytes : undefined);
    assert.isUndefined(restart && typeof restart !== "boolean" ? restart.internalKeyBytes : undefined);
  });

  it("preserves compacted LDB tombstones over older values", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const ldb = makeLdbFile([
      makeLdbRecord(keyBytes, [], 2, true),
      makeLdbRecord(keyBytes, [7], 1),
    ]);
    const visitorDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
    const initDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await visitorDb.forEachRecord((record) => records.push(record), {
      includeValues: true,
      includeDeleted: true,
    });
    await initDb.init();

    assert.strictEqual(records.length, 1);
    assert.isTrue(records[0].isDeleted);
    assert.strictEqual(WorldDataMetricsReducer.getMetricsForRecords(records).customDimensionChunkCount, 0);
    assert.strictEqual(initDb.keys.get(stringFromBytes(new Uint8Array(keyBytes))), false);
  });

  it("preserves the newest compacted version when one user key spans data blocks", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const ldb = makeMultiBlockLdbFile([
      {
        records: [makeLdbRecord(keyBytes, [], 3, true)],
        lastUserKey: keyBytes,
        lastSequence: 3,
      },
      {
        records: [makeLdbRecord(keyBytes, [8], 2)],
        lastUserKey: keyBytes,
        lastSequence: 2,
      },
      {
        records: [makeLdbRecord(keyBytes, [7], 1)],
        lastUserKey: keyBytes,
        lastSequence: 1,
      },
    ]);
    const visitorDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
    const initDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await visitorDb.forEachRecord((record) => records.push(record), {
      includeValues: true,
      includeDeleted: true,
    });
    await initDb.init();

    assert.strictEqual(records.length, 1);
    assert.isTrue(records[0].isDeleted);
    assert.strictEqual(WorldDataMetricsReducer.getMetricsForRecords(records).customDimensionChunkCount, 0);
    assert.strictEqual(initDb.keys.get(stringFromBytes(new Uint8Array(keyBytes))), false);
  });

  it("preserves the newest compacted version when one user key spans SST files", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const newestTombstone = makeLdbFile([makeLdbRecord(keyBytes, [], 3, true)]);
    const olderValue = makeLdbFile([makeLdbRecord(keyBytes, [7], 2)]);
    const visitorDb = new LevelDb(
      [makeFile("000001.ldb", newestTombstone), makeFile("000002.ldb", olderValue)],
      [],
      [],
      "test"
    );
    const initDb = new LevelDb(
      [makeFile("000001.ldb", newestTombstone), makeFile("000002.ldb", olderValue)],
      [],
      [],
      "test"
    );
    const records: ILevelDbParsedRecord[] = [];

    await visitorDb.forEachRecord((record) => records.push(record), {
      includeValues: true,
      includeDeleted: true,
    });
    await initDb.init();

    assert.strictEqual(records.length, 2);
    assert.strictEqual(WorldDataMetricsReducer.getMetricsForRecords(records).customDimensionChunkCount, 0);
    assert.strictEqual(initDb.keys.get(stringFromBytes(new Uint8Array(keyBytes))), false);
  });

  it("does not replace a newer LOG value with an older incremental SST value", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const initialLdb = makeLdbFile([makeLdbRecord(keyBytes, [1], 1)]);
    const newerLog = makeLogFile([{ key: keyBytes, value: [9] }], 3);
    const olderIncrementalLdb = makeLdbFile([makeLdbRecord(keyBytes, [2], 2)]);
    const levelDb = new LevelDb(
      [makeFile("000001.ldb", initialLdb)],
      [makeFile("000002.log", newerLog)],
      [],
      "test"
    );

    await levelDb.init();
    await levelDb.parseIncrementalFile(makeFile("000003.ldb", olderIncrementalLdb));

    const value = levelDb.keys.get(stringFromBytes(new Uint8Array(keyBytes)));
    assert.isOk(value && typeof value !== "boolean");
    assert.deepEqual(Array.from((value && typeof value !== "boolean" ? value.value : undefined) ?? []), [9]);
  });

  it("does not replace a newer SST value with an older incremental SST value", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const newerSst = makeLdbFile([makeLdbRecord(keyBytes, [9], 3)]);
    const olderIncrementalSst = makeLdbFile([makeLdbRecord(keyBytes, [2], 2)]);
    const levelDb = new LevelDb([makeFile("000001.ldb", newerSst)], [], [], "test");

    await levelDb.init();
    await levelDb.parseIncrementalFile(makeFile("000002.ldb", olderIncrementalSst));

    const value = levelDb.keys.get(stringFromBytes(new Uint8Array(keyBytes)));
    assert.isOk(value && typeof value !== "boolean");
    assert.deepEqual(Array.from((value && typeof value !== "boolean" ? value.value : undefined) ?? []), [9]);
  });

  it("allows an equal-sequence SST record to repopulate an evicted key", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const sst = makeLdbFile([makeLdbRecord(keyBytes, [9], 3)]);
    const levelDb = new LevelDb([makeFile("000001.ldb", sst)], [], [], "test");

    await levelDb.init();
    levelDb.clearLoadedKeys(false);
    levelDb.parseLdbContent(sst, "test");

    const value = levelDb.keys.get(stringFromBytes(new Uint8Array(keyBytes)));
    assert.isOk(value && typeof value !== "boolean");
    assert.deepEqual(Array.from((value && typeof value !== "boolean" ? value.value : undefined) ?? []), [9]);
  });

  it("reports a chunk affected by an incremental SST tombstone", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44));
    const initialLdb = makeLdbFile([makeLdbRecord(keyBytes, [1], 1)]);
    const incrementalTombstone = makeLdbFile([makeLdbRecord(keyBytes, [], 2, true)]);
    const levelDb = new LevelDb([makeFile("000001.ldb", initialLdb)], [], [], "test");

    await levelDb.init();
    const affectedChunks = await levelDb.parseIncrementalFile(makeFile("000002.ldb", incrementalTombstone));

    assert.deepEqual(affectedChunks, [
      { x: 1, z: 2, dimension: 0, hasDeletion: true, requiresReload: false },
    ]);
    assert.strictEqual(levelDb.keys.get(stringFromBytes(new Uint8Array(keyBytes))), false);
  });

  it("distinguishes incremental LOG puts from tombstones", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44));
    const initialLdb = makeLdbFile([makeLdbRecord(keyBytes, [1], 1)]);
    const levelDb = new LevelDb([makeFile("000001.ldb", initialLdb)], [], [], "test");

    await levelDb.init();
    const putChunks = await levelDb.parseIncrementalFile(
      makeFile("000002.log", makeLogFile([{ key: keyBytes, value: [2] }], 2))
    );
    const deletedChunks = await levelDb.parseIncrementalFile(
      makeFile("000003.log", makeLogFile([{ key: keyBytes, deleted: true }], 3))
    );

    assert.deepEqual(putChunks, [
      { x: 1, z: 2, dimension: 0, hasDeletion: false, requiresReload: false },
    ]);
    assert.deepEqual(deletedChunks, [
      { x: 1, z: 2, dimension: 0, hasDeletion: true, requiresReload: false },
    ]);
  });

  it("reports LOG tombstones after processed key payloads were evicted", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44));
    const key = stringFromBytes(new Uint8Array(keyBytes));
    const initialLdb = makeLdbFile([makeLdbRecord(keyBytes, [1], 1)]);
    const levelDb = new LevelDb([makeFile("000001.ldb", initialLdb)], [], [], "test");

    await levelDb.init();
    levelDb.deleteKey(key);
    const affectedChunks = await levelDb.parseIncrementalFile(
      makeFile("000002.log", makeLogFile([{ key: keyBytes, deleted: true }], 2))
    );

    assert.deepEqual(affectedChunks, [
      { x: 1, z: 2, dimension: 0, hasDeletion: true, requiresReload: false },
    ]);
  });

  it("marks custom-dimension incremental changes for authoritative reload", async () => {
    const keyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const levelDb = new LevelDb([], [], [], "test");

    const affectedChunks = await levelDb.parseIncrementalFile(
      makeFile("000001.log", makeLogFile([{ key: keyBytes, value: [1] }], 1))
    );

    assert.deepEqual(affectedChunks, [
      { x: 1, z: 2, dimension: 1000, hasDeletion: false, requiresReload: true },
    ]);
  });

  it("does not classify named incremental records as custom-dimension chunks", async () => {
    const namedKey = bytesFromString("map_123456789");
    const levelDb = new LevelDb([], [], [], "test");

    const affectedChunks = await levelDb.parseIncrementalFile(
      makeFile("000001.log", makeLogFile([{ key: namedKey, value: [1] }], 1))
    );

    assert.deepEqual(affectedChunks, []);
  });

  it("surfaces incremental DimensionNameIdTable changes for metadata reload", async () => {
    const levelDb = new LevelDb([], [], [], "test");

    const affectedChunks = await levelDb.parseIncrementalFile(
      makeFile(
        "000001.log",
        makeLogFile([{ key: bytesFromString("DimensionNameIdTable"), value: [1] }], 1)
      )
    );

    assert.deepEqual(affectedChunks, []);
    assert.isTrue(levelDb.incrementalMetadataChanged);
  });

  it("does not replay unchanged custom-dimension LOG records after an append", async () => {
    const customKey = Array.from(chunkKey(1, 2, 44, 1000));
    const vanillaKey = Array.from(chunkKey(3, 4, 44));
    const firstBatch = makeLogFile([{ key: customKey, value: [1] }], 1);
    const appendedBatch = makeLogFile([{ key: vanillaKey, value: [2] }], 2);
    const logFile = makeFile("000001.log", firstBatch);
    const levelDb = new LevelDb([], [], [], "test");

    const firstAffected = await levelDb.parseIncrementalFile(logFile);
    const grownLog = new Uint8Array(firstBatch.length + appendedBatch.length);
    grownLog.set(firstBatch, 0);
    grownLog.set(appendedBatch, firstBatch.length);
    logFile.content = grownLog;
    logFile.isContentLoaded = true;
    const secondAffected = await levelDb.parseIncrementalFile(logFile);

    assert.deepEqual(firstAffected, [
      { x: 1, z: 2, dimension: 1000, hasDeletion: false, requiresReload: true },
    ]);
    assert.deepEqual(secondAffected, [
      { x: 3, z: 4, dimension: 0, hasDeletion: false, requiresReload: false },
    ]);
  });

  it("does not report an evicted historical LOG record as changed after an append", async () => {
    const customKeyBytes = Array.from(chunkKey(1, 2, 44, 1000));
    const customKey = stringFromBytes(new Uint8Array(customKeyBytes));
    const vanillaKey = Array.from(chunkKey(3, 4, 44));
    const firstBatch = makeLogFile([{ key: customKeyBytes, value: [1] }], 1);
    const appendedBatch = makeLogFile([{ key: vanillaKey, value: [2] }], 2);
    const logFile = makeFile("000001.log", firstBatch);
    const levelDb = new LevelDb([], [], [], "test");

    await levelDb.parseIncrementalFile(logFile);
    levelDb.deleteKey(customKey);
    const grownLog = new Uint8Array(firstBatch.length + appendedBatch.length);
    grownLog.set(firstBatch, 0);
    grownLog.set(appendedBatch, firstBatch.length);
    logFile.content = grownLog;
    logFile.isContentLoaded = true;
    const affectedChunks = await levelDb.parseIncrementalFile(logFile);

    assert.deepEqual(affectedChunks, [
      { x: 3, z: 4, dimension: 0, hasDeletion: false, requiresReload: false },
    ]);
    assert.isUndefined(levelDb.keys.get(customKey));
  });

  it("reports truncated LOG WriteBatch headers without throwing", async () => {
    const levelDb = new LevelDb([], [makeFile("000001.log", makeLogPhysicalRecord([1, 2, 3]))], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((record) => records.push(record), { includeDeleted: true });

    assert.deepEqual(records, []);
    assert.isTrue(levelDb.isInErrorState);
  });

  it("rejects LOG keys whose declared length exceeds the WriteBatch boundary", async () => {
    const payload = [...fixed64(1), ...fixed32(1), 1, ...varint(100)];
    const levelDb = new LevelDb([], [makeFile("000001.log", makeLogPhysicalRecord(payload))], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((record) => records.push(record), { includeDeleted: true });

    assert.deepEqual(records, []);
    assert.isTrue(levelDb.isInErrorState);
  });

  it("rejects LOG values whose declared length exceeds the WriteBatch boundary", async () => {
    const payload = [...fixed64(1), ...fixed32(1), 1, ...varint(1), "a".charCodeAt(0), ...varint(100)];
    const levelDb = new LevelDb([], [makeFile("000001.log", makeLogPhysicalRecord(payload))], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((record) => records.push(record), { includeValues: true });

    assert.deepEqual(records, []);
    assert.isTrue(levelDb.isInErrorState);
  });

  it("rejects SST entries whose declared key extends into restart metadata", () => {
    const malformedEntry = new Uint8Array([0, ...varint(100), 0]);
    const keyValue = new LevelKeyValue();

    assert.throws(() => keyValue.loadFromLdb(malformedEntry, 0, undefined, malformedEntry.length));
  });

  it("reports malformed SST entries through the public parser", async () => {
    const malformedRecord = [0, ...varint(100), 0];
    const levelDb = new LevelDb([makeFile("000001.ldb", makeLdbFile([malformedRecord]))], [], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((record) => records.push(record), { includeValues: true });

    assert.deepEqual(records, []);
    assert.isTrue(levelDb.isInErrorState);
  });

  it("rejects unsupported SST internal-key value types", async () => {
    const malformedTypeLdb = makeLdbFile([
      makeLdbRecord(bytesFromString("invalid-type"), [1], 1, false, 2),
    ]);
    const levelDb = new LevelDb([makeFile("000001.ldb", malformedTypeLdb)], [], [], "test");
    const records: ILevelDbParsedRecord[] = [];

    await levelDb.forEachRecord((record) => records.push(record), { includeValues: true });

    assert.deepEqual(records, []);
    assert.isTrue(levelDb.isInErrorState);
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
      makeLdbRecord(bytesFromString("duplicate"), [1], 1),
      makeLdbRecord(bytesFromString("removed"), [2], 2),
    ]);
    const log = makeLogFile([
      { key: bytesFromString("duplicate"), value: [3] },
      { key: bytesFromString("removed"), deleted: true },
    ], 3);
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
  it("resolves puts and tombstones by exact sequence rather than visitation or source order", () => {
    const keyBytes = chunkKey(-2147483648, 2147483647, 47, undefined, 255);
    const put = { ...record(keyBytes), sourceKind: "ldb" as const, sequenceNumber: "9007199254740992" };
    const deleted = { ...record(keyBytes, true), sequenceNumber: "9007199254740993" };

    for (const records of [
      [put, deleted],
      [deleted, put],
    ]) {
      const reducer = new WorldDataMetricsReducer();
      records.forEach((entry) => reducer.visit(entry));
      reducer.visit(put);
      reducer.visit({ ...put, sequenceNumber: deleted.sequenceNumber });
      assert.strictEqual(reducer.getMetrics().chunkCount, 0);
      assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), []);

      reducer.visit({ ...put, sequenceNumber: "72057594037927935" });
      const metrics = reducer.getMetrics();
      assert.strictEqual(metrics.chunkCount, 1);
      assert.strictEqual(metrics.subchunkLessChunkCount, 0);
      assert.strictEqual(metrics.minX, -34359738368);
      assert.strictEqual(metrics.maxZ, 34359738368);
    }
  });

  it("keeps equal sequences unchanged and preserves visit ordering when a sequence is absent", () => {
    const keyBytes = chunkKey(0, 0, 44);
    const reducer = new WorldDataMetricsReducer();
    reducer.visit({ ...record(keyBytes), sequenceNumber: "0" });
    reducer.visit({ ...record(keyBytes, true), sequenceNumber: "0" });
    assert.strictEqual(reducer.getMetrics().chunkCount, 1);
    reducer.visit(record(keyBytes, true));
    assert.strictEqual(reducer.getMetrics().chunkCount, 0);
    reducer.visit({ ...record(keyBytes), sequenceNumber: "0" });
    assert.strictEqual(reducer.getMetrics().chunkCount, 1);
  });

  it("updates chunk presence, subchunk presence and bounds only when effective presence changes", () => {
    const reducer = new WorldDataMetricsReducer();
    const visit = (key: Uint8Array, sequence: number, deleted = false) =>
      reducer.visit({ ...record(key, deleted), sequenceNumber: String(sequence) });
    const version = chunkKey(2, -3, 44);
    const lower = chunkKey(2, -3, 47, undefined, 0);
    const upper = chunkKey(2, -3, 47, undefined, 255);
    visit(version, 1);
    visit(lower, 2);
    visit(upper, 3);
    visit(lower, 4);
    visit(lower, 5, true);
    assert.strictEqual(reducer.getMetrics().subchunkLessChunkCount, 0);
    visit(upper, 6, true);
    assert.strictEqual(reducer.getMetrics().subchunkLessChunkCount, 1);
    visit(version, 7, true);
    assert.strictEqual(reducer.getMetrics().chunkCount, 0);
    assert.isUndefined(reducer.getMetrics().minX);
    visit(version, 6);
    assert.strictEqual(reducer.getMetrics().chunkCount, 0);
    visit(lower, 8);
    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 1,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      minX: 32,
      maxX: 48,
      minZ: -48,
      maxZ: -32,
      dimensionIds: [0],
      hasDimensionNameIdTable: false,
    });
  });

  it("keeps every suffix byte, key length and dimension encoding as a distinct record identity", () => {
    for (const dimension of [undefined, 0, 1, 2, 999, 1000, 2147483647]) {
      const reducer = new WorldDataMetricsReducer();
      const keys: Uint8Array[] = [];
      for (const tag of [43, 44, 47, 120]) {
        keys.push(chunkKey(0, 0, tag, dimension));
        for (let suffix = 0; suffix < 256; suffix++) {
          keys.push(chunkKey(0, 0, tag, dimension, suffix));
        }
      }
      for (const key of keys) {
        reducer.visit({ ...record(key), sequenceNumber: "1" });
      }
      const expectedWorldChunks = dimension === undefined || dimension === 1 || dimension === 2 ? 1 : 0;
      const expectedCustomChunks = dimension !== undefined && dimension >= 1000 ? 1 : 0;
      assert.strictEqual(reducer.getMetrics().chunkCount, expectedWorldChunks);
      assert.strictEqual(reducer.getMetrics().customDimensionChunkCount, expectedCustomChunks);
      for (let index = 0; index < keys.length; index++) {
        assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), [dimension ?? 0]);
        reducer.visit({ ...record(keys[index], true), sequenceNumber: "2" });
      }
      assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), []);
      assert.strictEqual(reducer.getMetrics().chunkCount, 0);
      assert.strictEqual(reducer.getMetrics().customDimensionChunkCount, 0);
      reducer.visit({ ...record(keys[0]), sequenceNumber: "1" });
      assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), []);
      reducer.visit({ ...record(keys[0]), sequenceNumber: "3" });
      assert.strictEqual(reducer.getMetrics().chunkCount, expectedWorldChunks);
      assert.strictEqual(reducer.getMetrics().customDimensionChunkCount, expectedCustomChunks);
      assert.strictEqual(reducer.getMetrics().subchunkLessChunkCount, expectedWorldChunks);
      assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), [dimension ?? 0]);
    }
  });

  it("does not merge implicit overworld records with dimension-encoded overworld records", () => {
    const reducer = new WorldDataMetricsReducer();
    const implicit = chunkKey(1, 2, 47, undefined, 0);
    const explicit = chunkKey(1, 2, 47, 0, 0);
    reducer.visit({ ...record(implicit), sequenceNumber: "1" });
    reducer.visit({ ...record(explicit, true), sequenceNumber: "2" });
    assert.strictEqual(reducer.getMetrics().chunkCount, 1);
    reducer.visit({ ...record(implicit, true), sequenceNumber: "3" });
    reducer.visit({ ...record(explicit), sequenceNumber: "4" });
    assert.strictEqual(reducer.getMetrics().chunkCount, 0);
    assert.deepEqual(Array.from(reducer.getMetrics().dimensionIds), [0]);
    reducer.visit({ ...record(implicit), sequenceNumber: "5" });
    assert.strictEqual(reducer.getMetrics().subchunkLessChunkCount, 0);
  });

  it("retains only the newest DimensionNameIdTable and copies its bytes", () => {
    const reducer = new WorldDataMetricsReducer();
    const bytes = new Uint8Array([1, 2, 3]);
    const table = record(new Uint8Array(bytesFromString("DimensionNameIdTable")), false, "DimensionNameIdTable", bytes);
    reducer.visit({ ...table, sequenceNumber: "10" });
    bytes[0] = 99;
    reducer.visit({ ...table, isDeleted: true, sequenceNumber: "9" });
    assert.deepEqual(Array.from(reducer.getMetrics().dimensionNameIdTableBytes ?? []), [1, 2, 3]);
    reducer.visit({ ...table, isDeleted: true, sequenceNumber: "11" });
    reducer.visit({ ...table, sequenceNumber: "10" });
    assert.isFalse(reducer.getMetrics().hasDimensionNameIdTable);
    assert.isUndefined(reducer.getMetrics().dimensionNameIdTableBytes);
    reducer.visit({ ...table, sequenceNumber: "12" });
    assert.isTrue(reducer.getMetrics().hasDimensionNameIdTable);
  });

  it("applies duplicate puts and tombstones using last-write-wins semantics", () => {
    const subchunk = chunkKey(1, 2, 47, undefined, 0);
    const reducer = new WorldDataMetricsReducer();

    reducer.visit(record(subchunk));
    reducer.visit(record(subchunk));
    reducer.visit(record(subchunk, true));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: false,
    });

    reducer.visit(record(subchunk));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 1,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      minX: 16,
      maxX: 32,
      minZ: 32,
      maxZ: 48,
      dimensionIds: [0],
      hasDimensionNameIdTable: false,
    });
  });

  describe("MCWorld constrained dimension metadata", () => {
    it("finishes custom dimension metadata after the full scan is truncated", async () => {
      const ldb = makeLdbFile([
        makeLdbRecord(Array.from(chunkKey(0, 0, 44)), [1]),
        makeLdbRecord(bytesFromString("tickingarea_1"), [9]),
        makeLdbRecord(Array.from(chunkKey(1, 0, 44, 1000)), [2], 3),
        makeLdbRecord(Array.from(chunkKey(1, 0, 47, 1000, 0)), [3], 4),
        makeLdbRecord(Array.from(chunkKey(2, 0, 44, 1001)), [4], 5),
      ]);
      const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
      const world = new MCWorld();

      await levelDb.init();
      await world.loadFromLevelDb(levelDb, {
        maxNumberOfRecordsToProcess: 1,
      });

      assert.isTrue(world.wasLoadTruncated);
      assert.strictEqual(world.chunkCount, 1);
      assert.strictEqual(world.customDimensionChunkCount, 2);
      assert.deepEqual(Array.from(world.dimensionIdsInChunks).sort((a, b) => a - b), [0, 1000, 1001]);

      const olderIncrementalSst = makeLdbFile([
        makeLdbRecord(Array.from(chunkKey(1, 0, 44, 1000)), [8], 2),
      ]);
      const affectedChunks = await levelDb.parseIncrementalFile(
        makeFile("000002.ldb", olderIncrementalSst)
      );
      assert.deepEqual(affectedChunks, []);
      assert.isUndefined(levelDb.keys.get(stringFromBytes(chunkKey(1, 0, 44, 1000))));
    });

    it("treats a compacted DimensionNameIdTable tombstone as absent", async () => {
      const levelDb = new LevelDb([], [], [], "test");
      const world = new MCWorld();
      levelDb.keys.set("DimensionNameIdTable", false);

      await world.loadFromLevelDb(levelDb, {
        skipFullProcessing: true,
        clearKeysAfterProcess: false,
      });

      assert.isFalse(world.hasDimensionNameIdTable);
    });

    it("releases custom-dimension records skipped by full processing", async () => {
      const ldb = makeLdbFile([
        makeLdbRecord(Array.from(chunkKey(0, 0, 44)), [1]),
        makeLdbRecord(Array.from(chunkKey(1, 0, 44, 1000)), [2]),
        makeLdbRecord(Array.from(chunkKey(2, 0, 42, 1000)), [3]),
      ]);
      const levelDb = new LevelDb([makeFile("000001.ldb", ldb)], [], [], "test");
      const world = new MCWorld();

      await levelDb.init();
      await world.loadFromLevelDb(levelDb);

      assert.strictEqual(world.chunkCount, 1);
      assert.strictEqual(world.customDimensionChunkCount, 1);
      assert.strictEqual(levelDb.keys.size, 0);
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
      customDimensionChunkCount: 0,
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
      customDimensionChunkCount: 1,
      subchunkLessChunkCount: 0,
      dimensionIds: [0, 1000],
      hasDimensionNameIdTable: false,
    });
  });

  it("counts unique chunks across custom dimensions", () => {
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([
      record(chunkKey(0, 0, 44, 1000)),
      record(chunkKey(0, 0, 47, 1000, 0)),
      record(chunkKey(1, 0, 44, 1000)),
      record(chunkKey(0, 0, 44, 1001)),
      record(chunkKey(1, 0, 72, 1001)),
      record(chunkKey(2, 0, 115, 1001)),
    ]);

    assert.strictEqual(metrics.customDimensionChunkCount, 5);
    assert.deepEqual(Array.from(metrics.dimensionIds).sort((a, b) => a - b), [1000, 1001]);
  });

  it("does not count non-chunk records with custom-dimension-shaped keys", () => {
    const invalidKey = chunkKey(0, 0, 42, 1000);
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([record(invalidKey)]);

    assert.strictEqual(WorldDataMetricsReducer.getChunkRecordMetadata(invalidKey), undefined);
    assert.strictEqual(metrics.customDimensionChunkCount, 0);
    assert.deepEqual(Array.from(metrics.dimensionIds), []);
  });

  it("rejects negative dimension IDs", () => {
    const negativeDimensionKey = chunkKey(0, 0, 44, -1);
    const metadata = WorldDataMetricsReducer.getChunkRecordMetadata(negativeDimensionKey);
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([record(negativeDimensionKey)]);

    assert.isUndefined(metadata);
    assert.strictEqual(metrics.chunkCount, 0);
    assert.strictEqual(metrics.customDimensionChunkCount, 0);
    assert.deepEqual(Array.from(metrics.dimensionIds), []);
  });

  it("does not count named records that resemble valid custom-dimension chunk keys", () => {
    const namedKey = new Uint8Array(bytesFromString("tickingarea_1"));
    const metrics = WorldDataMetricsReducer.getMetricsForRecords([record(namedKey)]);

    assert.strictEqual(namedKey.length, 13);
    assert.isTrue(WorldDataMetricsReducer.isNamedWorldRecordKey("tickingarea_1"));
    assert.strictEqual(metrics.customDimensionChunkCount, 0);
    assert.deepEqual(Array.from(metrics.dimensionIds), []);
  });

  it("tracks DimensionNameIdTable value and tombstones for CDWORLDDATA", () => {
    const tableBytes = new Uint8Array([1, 2, 3]);
    const reducer = new WorldDataMetricsReducer();

    reducer.visit(record(new Uint8Array(bytesFromString("DimensionNameIdTable")), false, "DimensionNameIdTable", tableBytes));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: true,
      dimensionNameIdTableBytes: [1, 2, 3],
    });

    reducer.visit(record(new Uint8Array(bytesFromString("DimensionNameIdTable")), true, "DimensionNameIdTable"));

    assert.deepEqual(normalizeMetrics(reducer.getMetrics()), {
      chunkCount: 0,
      customDimensionChunkCount: 0,
      subchunkLessChunkCount: 0,
      dimensionIds: [],
      hasDimensionNameIdTable: false,
    });
  });
});
