// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import TextureReferenceInfoGenerator from "./TextureReferenceInfoGenerator";
import { TextureReferenceInfoGeneratorTest } from "./TextureReferenceInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("TextureReferenceInfoGenerator", () => {
  const gen = new TextureReferenceInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "TEXTUREREF");
    assert.strictEqual(gen.title, "Texture References");
  });

  it("returns exactly 1 featureAggregate item for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.lengthOf(aggregates, 1, "should always return 1 featureAggregate textureReferences item");
  });

  it("first item has generatorIndex textureReferences=101", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);

    assert.strictEqual(results[0].generatorIndex, TextureReferenceInfoGeneratorTest.textureReferences);
  });
});
