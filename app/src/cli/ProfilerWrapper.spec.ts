// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/// <reference types="node" />

import { assert } from "chai";
import { format } from "node:util";
import ProfilerWrapper from "./ProfilerWrapper";

describe("ProfilerWrapper.generateMemoryProfile", () => {
  it("reports a failed peak heap snapshot without a stack trace", async function () {
    this.timeout(20000);
    const memoryUsage = process.memoryUsage;
    const generateHeapSnapshot = ProfilerWrapper.generateHeapSnapshot;
    const warn = console.warn;
    const warnings: string[] = [];
    let rss = 300 * 1024 * 1024;

    // Grow RSS past the 256 MB floor on every poll so the profiler tries a peak snapshot.
    process.memoryUsage = Object.assign(
      () => {
        rss = Math.ceil(rss * 1.5);
        return { ...memoryUsage(), rss };
      },
      { rss: () => rss }
    );
    ProfilerWrapper.generateHeapSnapshot = () => {
      throw new Error("Snapshot write failed");
    };
    console.warn = (...args: unknown[]) => {
      warnings.push(format(...args));
    };

    try {
      await ProfilerWrapper.generateMemoryProfile(
        "profiler-wrapper-spec",
        () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
        { pollMs: 10, report: () => {} }
      );
    } finally {
      process.memoryUsage = memoryUsage;
      ProfilerWrapper.generateHeapSnapshot = generateHeapSnapshot;
      console.warn = warn;
    }

    assert.isNotEmpty(warnings, "a peak snapshot should have been attempted");
    for (const warning of warnings) {
      assert.equal(warning, "Failed to write peak heap snapshot: Error: Snapshot write failed");
    }
  });
});
