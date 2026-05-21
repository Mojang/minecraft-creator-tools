// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import TypesInfoGenerator from "./TypesInfoGenerator";
import { TypesInfoGeneratorTest } from "./TypesInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { InfoItemType } from "../../IInfoItemData";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { AnnotationCategory } from "../../../core/ContentIndex";

const noOpContentIndex = { insert: () => {} } as any;

/** Creates a spy content index that records every insert call. */
function createSpyContentIndex() {
  const calls: { id: string; path: string; category: AnnotationCategory }[] = [];
  return {
    index: {
      insert: (id: string, path: string, category: AnnotationCategory) => calls.push({ id, path, category }),
    } as any,
    calls,
  };
}

describe("TypesInfoGenerator", () => {
  let gen: TypesInfoGenerator;

  beforeEach(() => {
    gen = new TypesInfoGenerator();
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "TYPES");
    assert.strictEqual(gen.title, "Types Info Aggregation");
  });

  it("has performAddOnValidations set to false", () => {
    expect(gen.performAddOnValidations).to.be.false;
  });

  it("returns exactly 1 featureAggregate item for empty project", async () => {
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    const aggregates = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
    assert.lengthOf(aggregates, 1, "should always return 1 featureAggregate types item");
  });

  it("the featureAggregate item has the correct generatorIndex", async () => {
    const results = await gen.generate(createStubProject(), noOpContentIndex);
    expect(results[0].generatorIndex).to.equal(TypesInfoGeneratorTest.types);
  });

  describe("unrecognised item types are skipped", () => {
    const skippedTypes = [
      ["resourcePackManifestJson", ProjectItemType.resourcePackManifestJson],
      ["behaviorPackManifestJson", ProjectItemType.behaviorPackManifestJson],
      ["texture", ProjectItemType.texture],
      ["soundDefinitionCatalog", ProjectItemType.soundDefinitionCatalog],
    ] as const;

    for (const [typeName, itemType] of skippedTypes) {
      it(`does not insert into contentIndex for ${typeName}`, async () => {
        const spy = createSpyContentIndex();
        const item = createStubProjectItem({ itemType, projectPath: `BP/${typeName}.json` });
        await gen.generate(createStubProject([item]), spy.index);
        expect(spy.calls).to.deep.equal([]);
      });
    }
  });

  describe("items with no primaryFile do not crash", () => {
    const handledTypes = [
      ["entityTypeBehavior", ProjectItemType.entityTypeBehavior],
      ["blockTypeBehavior", ProjectItemType.blockTypeBehavior],
      ["itemTypeBehavior", ProjectItemType.itemTypeBehavior],
      ["featureBehavior", ProjectItemType.featureBehavior],
      ["blocksCatalogResourceJson", ProjectItemType.blocksCatalogResourceJson],
    ] as const;

    for (const [typeName, itemType] of handledTypes) {
      it(`returns 1 aggregate item for ${typeName} with no primaryFile`, async () => {
        const item = createStubProjectItem({ itemType, file: undefined });
        const results = await gen.generate(createStubProject([item]), noOpContentIndex);
        expect(results).to.have.length(1);
        expect(results[0].itemType).to.equal(InfoItemType.featureAggregate);
      });
    }
  });

  describe("contentIndex inserts for handled types with valid content", () => {
    it("inserts the entity identifier for an entityTypeBehavior item", async () => {
      const content = JSON.stringify({
        "minecraft:entity": { description: { identifier: "test:my_entity" } },
      });
      const file = createStubFile({ name: "my_entity.json", content });
      const item = createStubProjectItem({
        itemType: ProjectItemType.entityTypeBehavior,
        projectPath: "BP/entities/my_entity.json",
        file,
      });
      const spy = createSpyContentIndex();
      await gen.generate(createStubProject([item]), spy.index);
      const entityInsert = spy.calls.find(
        (c) => c.id === "test:my_entity" && c.category === AnnotationCategory.entityTypeSource
      );
      expect(entityInsert, "expected entityTypeSource insert for test:my_entity").to.not.be.undefined;
    });

    it("inserts the block identifier for a blockTypeBehavior item", async () => {
      const content = JSON.stringify({
        "minecraft:block": { description: { identifier: "test:my_block" } },
      });
      const file = createStubFile({ name: "my_block.json", content });
      const item = createStubProjectItem({
        itemType: ProjectItemType.blockTypeBehavior,
        projectPath: "BP/blocks/my_block.json",
        file,
      });
      const spy = createSpyContentIndex();
      await gen.generate(createStubProject([item]), spy.index);
      const blockInsert = spy.calls.find(
        (c) => c.id === "test:my_block" && c.category === AnnotationCategory.blockTypeSource
      );
      expect(blockInsert, "expected blockTypeSource insert for test:my_block").to.not.be.undefined;
    });

    it("also inserts the un-namespaced block id for a blockTypeBehavior item", async () => {
      const content = JSON.stringify({
        "minecraft:block": { description: { identifier: "test:my_block" } },
      });
      const file = createStubFile({ name: "my_block.json", content });
      const item = createStubProjectItem({
        itemType: ProjectItemType.blockTypeBehavior,
        projectPath: "BP/blocks/my_block.json",
        file,
      });
      const spy = createSpyContentIndex();
      await gen.generate(createStubProject([item]), spy.index);
      const shortInsert = spy.calls.find(
        (c) => c.id === "my_block" && c.category === AnnotationCategory.blockTypeSource
      );
      expect(shortInsert, "expected blockTypeSource insert for un-namespaced 'my_block'").to.not.be.undefined;
    });

    it("inserts the item identifier for an itemTypeBehavior item", async () => {
      const content = JSON.stringify({
        "minecraft:item": { description: { identifier: "test:my_item" } },
      });
      const file = createStubFile({ name: "my_item.json", content });
      const item = createStubProjectItem({
        itemType: ProjectItemType.itemTypeBehavior,
        projectPath: "BP/items/my_item.json",
        file,
      });
      const spy = createSpyContentIndex();
      await gen.generate(createStubProject([item]), spy.index);
      const itemInsert = spy.calls.find(
        (c) => c.id === "test:my_item" && c.category === AnnotationCategory.itemTypeSource
      );
      expect(itemInsert, "expected itemTypeSource insert for test:my_item").to.not.be.undefined;
    });
  });

  describe("summarize", () => {
    it("sets info.textureCount from the summed data value", () => {
      const mockInfoSet = {
        getSummedDataValue: (_id: string, _idx: number) => 42,
      } as any;
      const info: any = {};
      gen.summarize(info, mockInfoSet);
      expect(info.textureCount).to.equal(42);
    });

    it("passes the correct generator id and index to getSummedDataValue", () => {
      let capturedId: string | undefined;
      let capturedIdx: number | undefined;
      const mockInfoSet = {
        getSummedDataValue: (id: string, idx: number) => {
          capturedId = id;
          capturedIdx = idx;
          return 0;
        },
      } as any;
      gen.summarize({}, mockInfoSet);
      expect(capturedId).to.equal("TYPES");
      expect(capturedIdx).to.equal(TypesInfoGeneratorTest.types);
    });
  });
});
