// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import UnknownItemGenerator from "./UnknownItemGenerator";
import { UnknownItemGeneratorTest } from "./UnknownItemData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("UnknownItemGenerator", () => {
  const gen = new UnknownItemGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "UNKJSON");
    assert.strictEqual(gen.title, "Unknown JSON");
  });

  it("returns [] for a non-unknown-json item type", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("emits unknownItemTypeFound error for unknownJson item", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.unknownJson });
    const results = await gen.generate(item, noOpContentIndex);

    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].itemType, InfoItemType.error);
    assert.strictEqual(results[0].generatorIndex, UnknownItemGeneratorTest.unknownItemTypeFound);
  });
});
