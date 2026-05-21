// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import TextureInfoGenerator from "./TextureInfoGenerator";
import { TextureInfoGeneratorTest } from "./TextureInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { InfoItemType } from "../../IInfoItemData";
import { ProjectItemType } from "../../../app/IProjectItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("TextureInfoGenerator", () => {
  let gen: TextureInfoGenerator;

  beforeEach(() => {
    gen = new TextureInfoGenerator();
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "TEXTURE");
    assert.strictEqual(gen.title, "Texture Validation");
  });

  it("has performAddOnValidations set to false by default", () => {
    expect(gen.performAddOnValidations).to.be.false;
  });

  it("returns exactly 1 featureAggregate item for empty project", async () => {
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.lengthOf(aggregates, 1, "should always return 1 featureAggregate textures item");
  });

  it("the featureAggregate item has the correct generatorIndex", async () => {
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    expect(results[0].generatorIndex).to.equal(TextureInfoGeneratorTest.textures);
  });

  it("does not emit tooManyTextureHandles when performAddOnValidations is false (default)", async () => {
    // Even if the project somehow had many handles, the guard is off by default
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    const errors = results.filter((r) => r.generatorIndex === TextureInfoGeneratorTest.tooManyTextureHandles);
    expect(errors).to.have.length(0);
  });

  it("does not emit tooManyTextureHandles for an empty project even when performAddOnValidations is true", async () => {
    gen.performAddOnValidations = true;
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    const errors = results.filter((r) => r.generatorIndex === TextureInfoGeneratorTest.tooManyTextureHandles);
    expect(errors).to.have.length(0);
  });

  describe("items with no primaryFile do not crash", () => {
    const handledTypes: [string, ProjectItemType][] = [
      ["blocksCatalogResourceJson", ProjectItemType.blocksCatalogResourceJson],
      ["particleJson", ProjectItemType.particleJson],
      ["uiJson", ProjectItemType.uiJson],
      ["terrainTextureCatalogResourceJson", ProjectItemType.terrainTextureCatalogResourceJson],
      ["flipbookTexturesJson", ProjectItemType.flipbookTexturesJson],
      ["itemTextureJson", ProjectItemType.itemTextureJson],
      ["entityTypeResource", ProjectItemType.entityTypeResource],
      ["attachableResourceJson", ProjectItemType.attachableResourceJson],
      ["texture", ProjectItemType.texture],
      ["uiTexture", ProjectItemType.uiTexture],
    ];

    for (const [typeName, itemType] of handledTypes) {
      it(`returns 1 aggregate item for ${typeName} with no primaryFile`, async () => {
        const item = createStubProjectItem({ itemType, file: undefined });
        const results = await gen.generate(createStubProject([item]), noOpContentIndex);
        expect(results).to.have.length(1);
        expect(results[0].itemType).to.equal(InfoItemType.featureAggregate);
      });
    }
  });

  describe("unrecognised item types produce no additional items", () => {
    const skippedTypes: [string, ProjectItemType][] = [
      ["entityTypeBehavior", ProjectItemType.entityTypeBehavior],
      ["resourcePackManifestJson", ProjectItemType.resourcePackManifestJson],
      ["soundDefinitionCatalog", ProjectItemType.soundDefinitionCatalog],
    ];

    for (const [typeName, itemType] of skippedTypes) {
      it(`still returns exactly 1 item for ${typeName}`, async () => {
        const item = createStubProjectItem({ itemType });
        const results = await gen.generate(createStubProject([item]), noOpContentIndex);
        expect(results).to.have.length(1);
      });
    }
  });
});
