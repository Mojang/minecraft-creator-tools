// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import JsonFileTagsInfoGenerator from "./JsonFileTagsInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";

const noOpContentIndex = { insert: () => {} } as any;

describe("JsonFileTagsInfoGenerator", () => {
  const gen = new JsonFileTagsInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "JSONTAGS");
    assert.strictEqual(gen.title, "JSON Tags");
  });

  it("returns empty array when project has no projectFolder", async () => {
    const project = createStubProject([], [], { projectFolder: undefined });
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });
});
