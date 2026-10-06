// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import JsonUtilities from "../JsonUtilities";
import { getManifestVersionValue, isManifestVersionNewer, shouldReplaceManifestVersion } from "./MinecraftVersionRules";

describe("getManifestVersionValue", () => {
  // Non-numeric format versions are treated as format 1 or 2, matching the manifest validator.
  const cases: { formatVersion: unknown; expected: number[] | string }[] = [
    { formatVersion: 1, expected: [1, 26, 50] },
    { formatVersion: 2, expected: [1, 26, 50] },
    { formatVersion: 3, expected: "1.26.50" },
    { formatVersion: 4, expected: "1.26.50" },
    { formatVersion: undefined, expected: [1, 26, 50] },
    { formatVersion: "3", expected: [1, 26, 50] },
  ];

  for (const { formatVersion, expected } of cases) {
    it(`format_version ${JSON.stringify(formatVersion)} gets ${JSON.stringify(expected)}`, () => {
      assert.deepEqual(getManifestVersionValue(formatVersion, [1, 26, 50]), expected);
    });
  }

  it("keeps the comments inside the array it replaces", () => {
    const manifest = JsonUtilities.parseJsonWithComments(
      '{ "header": { "min_engine_version": [\n  1, // major\n  20,\n  10 /* patch */\n] } }'
    ) as unknown as { header: { min_engine_version: number[] | string } };
    const current = manifest.header.min_engine_version;

    manifest.header.min_engine_version = getManifestVersionValue(2, [1, 26, 50], current);

    assert.notStrictEqual(manifest.header.min_engine_version, current, "should be a new array");
    const written = JsonUtilities.stringifyJsonWithComments(manifest);
    assert.include(written, "// major");
    assert.include(written, "/* patch */");
    assert.deepEqual(JSON.parse(JSON.stringify(manifest)).header.min_engine_version, [1, 26, 50]);
  });
});

describe("isManifestVersionNewer", () => {
  const cases: { version: unknown; expected: boolean }[] = [
    { version: [1, 26, 60], expected: true },
    { version: [1, 27, 0], expected: true },
    { version: [2, 0, 0], expected: true },
    { version: [1, 26, 60, 4], expected: true },
    { version: "1.26.60", expected: true },
    { version: [1, 26, 50], expected: false },
    { version: "1.26.50", expected: false },
    { version: [1, 26, 40], expected: false },
    { version: "1.21.100", expected: false },
    { version: "*", expected: false },
    { version: ["1", "27", "0"], expected: false },
    { version: undefined, expected: false },
  ];

  for (const { version, expected } of cases) {
    it(`${JSON.stringify(version)} ${expected ? "is" : "isn't"} newer than 1.26.50`, () => {
      assert.equal(isManifestVersionNewer(version, [1, 26, 50]), expected);
    });
  }
});

describe("shouldReplaceManifestVersion", () => {
  const cases: { version: unknown; keepNewerVersions: boolean; expected: boolean }[] = [
    { version: [1, 26, 50], keepNewerVersions: false, expected: false },
    { version: [1, 26, 50, 4], keepNewerVersions: false, expected: false },
    { version: [1, 20, 10], keepNewerVersions: false, expected: true },
    { version: [1, 20, 10], keepNewerVersions: true, expected: true },
    { version: [1, 27, 0], keepNewerVersions: false, expected: true },
    { version: [1, 27, 0], keepNewerVersions: true, expected: false },
    { version: "1.27.0", keepNewerVersions: true, expected: false },
    { version: "1.21.100", keepNewerVersions: true, expected: true },
    { version: "*", keepNewerVersions: true, expected: true },
    { version: undefined, keepNewerVersions: true, expected: true },
  ];

  for (const { version, keepNewerVersions, expected } of cases) {
    it(`${JSON.stringify(version)} with keepNewerVersions ${keepNewerVersions} ${expected ? "is" : "isn't"} replaced`, () => {
      assert.equal(shouldReplaceManifestVersion(version, [1, 26, 50], keepNewerVersions), expected);
    });
  }
});
