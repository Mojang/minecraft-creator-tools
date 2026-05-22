// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import UnlinkedItemInfoGenerator from "./UnlinkedItemInfoGenerator";
import { UnlinkedItemInfoGeneratorTest, UnlinkedItemNotFoundByType } from "./UnlinkedItemInfoData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("UnlinkedItemInfoGenerator", () => {
  const gen = new UnlinkedItemInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "UNLINK");
    assert.strictEqual(gen.title, "Unlinked Items");
  });

  it("returns [] for item with no unfulfilled relationships and non-texture type", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("emits avoidLinksToVanillaItems recommendation for vanilla-dependent relationship", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.entityTypeBehavior,
      unfulfilledRelationships: [
        {
          parentItem: null as any,
          itemType: ProjectItemType.entityTypeResource,
          path: "textures/entity/zombie",
          isVanillaDependent: true,
        },
      ],
    });
    const results = await gen.generate(item, noOpContentIndex);

    const rec = results.find((r) => r.generatorIndex === UnlinkedItemInfoGeneratorTest.avoidLinksToVanillaItems);
    assert.isDefined(rec, "expected a recommendation for vanilla-dependent link");
    assert.strictEqual(rec!.itemType, InfoItemType.recommendation);
  });

  it("emits warning for non-vanilla unresolved relationship", async () => {
    const linkedType = ProjectItemType.entityTypeResource;
    const item = createStubProjectItem({
      itemType: ProjectItemType.entityTypeBehavior,
      unfulfilledRelationships: [
        {
          parentItem: null as any,
          itemType: linkedType,
          path: "textures/entity/custom_mob",
          isVanillaDependent: false,
        },
      ],
    });
    const results = await gen.generate(item, noOpContentIndex);

    const warning = results.find((r) => r.generatorIndex === UnlinkedItemNotFoundByType + linkedType);
    assert.isDefined(warning, "expected a warning for unresolved link");
    assert.strictEqual(warning!.itemType, InfoItemType.warning);
  });

  it("emits both a recommendation and a warning when an item has mixed vanilla and non-vanilla relationships", async () => {
    const linkedType = ProjectItemType.entityTypeResource;
    const item = createStubProjectItem({
      itemType: ProjectItemType.entityTypeBehavior,
      unfulfilledRelationships: [
        {
          parentItem: null as any,
          itemType: linkedType,
          path: "textures/entity/zombie",
          isVanillaDependent: true,
        },
        {
          parentItem: null as any,
          itemType: linkedType,
          path: "textures/entity/custom_mob",
          isVanillaDependent: false,
        },
      ],
    });
    const results = await gen.generate(item, noOpContentIndex);

    const rec = results.find((r) => r.generatorIndex === UnlinkedItemInfoGeneratorTest.avoidLinksToVanillaItems);
    assert.isDefined(rec, "expected recommendation for vanilla-dependent link");
    assert.strictEqual(rec!.itemType, InfoItemType.recommendation);

    const warning = results.find((r) => r.generatorIndex === UnlinkedItemNotFoundByType + linkedType);
    assert.isDefined(warning, "expected warning for non-vanilla unresolved link");
    assert.strictEqual(warning!.itemType, InfoItemType.warning);
  });
});
