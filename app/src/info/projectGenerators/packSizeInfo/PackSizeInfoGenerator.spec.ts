// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import PackSizeInfoGenerator from "./PackSizeInfoGenerator";
import { PackSizeInfoGeneratorTest } from "./PackSizeInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("PackSizeInfoGenerator", () => {
  const gen = new PackSizeInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "PACKSIZE");
    assert.strictEqual(gen.title, "Pack Size Information");
  });

  it("returns exactly 6 featureAggregate items for empty project folder", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.lengthOf(aggregates, 6, "should always return 6 featureAggregate summary items");
  });

  it("returns no size-exceeded error items for empty project folder", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    const addonSizeError = results.find(
      (r) => r.generatorIndex === PackSizeInfoGeneratorTest.exceedsRecommendedAddonSize
    );
    const packageSizeError = results.find(
      (r) => r.generatorIndex === PackSizeInfoGeneratorTest.exceedsRecommendedPackageSize
    );

    assert.isUndefined(addonSizeError, "empty project should not exceed add-on size limit");
    assert.isUndefined(packageSizeError, "empty project should not exceed package size limit");
  });
});
