// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import ItemCountsInfoGenerator from "./ItemCountsInfoGenerator";
import { ItemCountsInfoGeneratorTest } from "./ItemCountsInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("ItemCountsInfoGenerator", () => {
  const gen = new ItemCountsInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "ITEMS");
    assert.strictEqual(gen.title, "Minimum Definition of a Pack");
  });

  it("returns empty array for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("emits behaviorPackManifest info item for BP manifest", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    const manifestItem = results.find((r) => r.generatorIndex === ItemCountsInfoGeneratorTest.behaviorPackManifest);
    assert.isDefined(manifestItem, "should emit a behaviorPackManifest info item");
  });

  it("emits count item at TopicTestIdBase + itemType for BP manifest", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    const countItem = results.find((r) => r.generatorIndex === 200 + ProjectItemType.behaviorPackManifestJson);
    assert.isDefined(countItem, "should emit count item at TopicTestIdBase + itemType");
    assert.strictEqual(countItem!.data, 1);
  });

  it("emits resourcePackManifest info item for RP manifest", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    const manifestItem = results.find((r) => r.generatorIndex === ItemCountsInfoGeneratorTest.resourcePackManifest);
    assert.isDefined(manifestItem, "should emit a resourcePackManifest info item");
  });
});
