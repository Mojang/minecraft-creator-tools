// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import PackInfoGenerator from "./PackInfoGenerator";
import { PackInfoGeneratorTest } from "./PackInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("PackInfoGenerator", () => {
  const gen = new PackInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "PACK");
    assert.strictEqual(gen.title, "General info");
  });

  it("returns exactly 1 item (memory tiers featureAggregate) for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].generatorIndex, PackInfoGeneratorTest.subpackTiers);
    assert.strictEqual(results[0].itemType, InfoItemType.featureAggregate);
  });

  it("emits behaviorPackManifest and behaviorPackUuid info items for BP manifest with uuid", async () => {
    const manifestJson = { header: { uuid: "test-uuid-bp-1234" }, modules: [] };
    const item = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      json: manifestJson,
    });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    const bpManifestItem = results.find((r) => r.generatorIndex === PackInfoGeneratorTest.behaviorPackManifest);
    assert.isDefined(bpManifestItem, "should emit behaviorPackManifest info item");

    const bpUuidItem = results.find((r) => r.generatorIndex === PackInfoGeneratorTest.behaviorPackUuid);
    assert.isDefined(bpUuidItem, "should emit behaviorPackUuid info item");
    assert.strictEqual(bpUuidItem!.data, "test-uuid-bp-1234");
  });
});
