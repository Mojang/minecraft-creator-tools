// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import SharingInfoGenerator from "./SharingInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("SharingInfoGenerator", () => {
  const gen = new SharingInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "SHARING");
    assert.strictEqual(gen.title, "Sharing Best Practices");
  });

  it("returns empty array for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("emits an error for an item with unsupported sharing type", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorTreeJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    const error = results.find((r) => r.generatorIndex === 500 + ProjectItemType.behaviorTreeJson);
    assert.isDefined(error, "expected an error for unsupported sharing type");
    assert.strictEqual(error!.itemType, InfoItemType.error);
  });
});
