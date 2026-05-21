// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import StrictPlatformInfoGenerator from "./StrictPlatformInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("StrictPlatformInfoGenerator", () => {
  const gen = new StrictPlatformInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "STRICT");
    assert.strictEqual(gen.title, "Strict Platform");
  });

  it("returns empty array for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("returns empty array for entityTypeBehavior item with no primaryFile", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });
});
