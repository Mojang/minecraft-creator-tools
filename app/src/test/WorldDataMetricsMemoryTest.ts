// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import "./TestDataDir";
import { assert } from "chai";
import { spawnSync } from "child_process";
import { buildSync } from "esbuild";
import * as path from "path";
import TestPaths from "./TestPaths";

describe("WorldDataMetricsReducer memory", () => {
  it("retains one million versioned records within a compact metadata budget", function () {
    this.timeout(60000);

    const bundle = buildSync({
      entryPoints: [path.join(TestPaths.appRoot, "src", "minecraft", "WorldDataMetricsReducer.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
    }).outputFiles[0].text;

    // An isolated heap and explicit GC measure retained state, not the test runner or transient parser allocations.
    const script = `
      ${bundle}
      const Reducer = module.exports.default;
      global.gc();
      const before = process.memoryUsage().heapUsed;
      const reducer = new Reducer();
      for (let x = 0; x < 40000; x++) {
        for (let y = 0; y < 25; y++) {
          const keyBytes = new Uint8Array(10);
          new DataView(keyBytes.buffer).setInt32(0, x, true);
          keyBytes[8] = 47;
          keyBytes[9] = y;
          reducer.visit({
            ordinal: x * 25 + y, key: String.fromCharCode(...keyBytes), keyBytes,
            sourceKind: "ldb", sequenceNumber: "9007199254740993"
          });
        }
      }
      global.gc();
      const retainedBytes = process.memoryUsage().heapUsed - before;
      const metrics = reducer.getMetrics();
      process.stdout.write(JSON.stringify({retainedBytes, ...metrics, dimensionIds: [...metrics.dimensionIds]}));
    `;
    const run = spawnSync(process.execPath, ["--expose-gc", "--max-old-space-size=512", "-"], {
      input: script,
      encoding: "utf8",
      timeout: 55000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });

    assert.isUndefined(run.error, String(run.error));
    assert.strictEqual(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    assert.isBelow(result.retainedBytes, 128 * 1024 * 1024, `Retained metadata bytes: ${result.retainedBytes}`);
    assert.strictEqual(result.chunkCount, 40000);
    assert.strictEqual(result.subchunkLessChunkCount, 0);
    assert.strictEqual(result.minX, 0);
    assert.strictEqual(result.maxX, 640000);
    assert.deepEqual(result.dimensionIds, [0]);
  });
});
