// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import SummaryInfoGenerator from "./SummaryInfoGenerator";
import { SummaryInfoGeneratorTest } from "./SummaryInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("SummaryInfoGenerator", () => {
  const gen = new SummaryInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "SUMMARY");
    assert.strictEqual(gen.title, "Summary Information");
  });

  it("returns exactly 2 featureAggregate items for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.lengthOf(aggregates, 2, "should always return 2 featureAggregate summary items");
  });

  it("first item has generatorIndex resourceManifest=101, second has behaviorManifest=102", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.strictEqual(aggregates[0].generatorIndex, SummaryInfoGeneratorTest.resourceManifest);
    assert.strictEqual(aggregates[1].generatorIndex, SummaryInfoGeneratorTest.behaviorManifest);
  });
});
