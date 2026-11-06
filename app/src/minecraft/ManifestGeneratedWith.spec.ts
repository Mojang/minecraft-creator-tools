// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { IAddonMetadata } from "./IAddonManifest";
import { addGeneratedWith } from "./ManifestGeneratedWith";

describe("addGeneratedWith", () => {
  const cases: {
    name: string;
    metadata: IAddonMetadata;
    expectedChanged: boolean;
    expected: IAddonMetadata;
  }[] = [
    {
      name: "creates the map on empty metadata",
      metadata: {},
      expectedChanged: true,
      expected: { generated_with: { mctoolscli: ["1.2.3"] } },
    },
    {
      name: "keeps other metadata and other tools",
      metadata: { authors: ["A"], generated_with: { blockbench: ["4.8.0"] } },
      expectedChanged: true,
      expected: { authors: ["A"], generated_with: { blockbench: ["4.8.0"], mctoolscli: ["1.2.3"] } },
    },
    {
      name: "appends a new version for the same tool",
      metadata: { generated_with: { mctoolscli: ["1.0.0"] } },
      expectedChanged: true,
      expected: { generated_with: { mctoolscli: ["1.0.0", "1.2.3"] } },
    },
    {
      name: "does nothing when the version is already recorded",
      metadata: { generated_with: { mctoolscli: ["1.2.3"] } },
      expectedChanged: false,
      expected: { generated_with: { mctoolscli: ["1.2.3"] } },
    },
    {
      name: "replaces a version list that isn't an array",
      metadata: { generated_with: { mctoolscli: "1.0.0" as unknown as string[] } },
      expectedChanged: true,
      expected: { generated_with: { mctoolscli: ["1.2.3"] } },
    },
    {
      name: "replaces a map that is an array",
      metadata: { generated_with: [] as unknown as { [toolName: string]: string[] } },
      expectedChanged: true,
      expected: { generated_with: { mctoolscli: ["1.2.3"] } },
    },
  ];

  for (const { name, metadata, expectedChanged, expected } of cases) {
    it(name, () => {
      assert.equal(addGeneratedWith(metadata, "mctoolscli", "1.2.3"), expectedChanged);
      assert.deepEqual(metadata, expected);
    });
  }
});
