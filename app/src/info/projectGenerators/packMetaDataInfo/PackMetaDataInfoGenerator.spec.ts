// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import PackMetaDataInformationGenerator from "./PackMetaDataInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";

const noOpContentIndex = { insert: () => {} } as any;

describe("PackMetaDataInformationGenerator", () => {
  const gen = new PackMetaDataInformationGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "PACKMETADATA");
    assert.strictEqual(gen.title, "General info");
  });

  it("returns empty array when project has no tagsMetadata or projectSummaryMetadata items", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });
});
