// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import WorldDataInfoGenerator from "./WorldDataInfoGenerator";
import { WorldDataInfoGeneratorTest } from "./WorldDataInfoData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";
import Log from "../../../core/Log";

const noOpContentIndex = { insert: () => {} } as any;

describe("WorldDataInfoGenerator", () => {
  const gen = new WorldDataInfoGenerator();
  let originalDebugAlert: typeof Log.debugAlert;

  // Suppress noise from test results, in the future, ideally we would build a more testable/stubbable way of building MCWorld instances
  before(() => {
    originalDebugAlert = Log.debugAlert.bind(Log);
    Log.debugAlert = () => {};
  });

  after(() => {
    Log.debugAlert = originalDebugAlert;
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "WORLDDATA");
    assert.strictEqual(gen.title, "World Data Validation");
  });

  it("returns [] for an item type that is not a world, dialogue, animation, or MCFunction", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("MCWorld item returns 6 featureAggregate items before world data loads", async () => {
    // MCWorld passes the type guard and pushes 4 world aggregates + 2 command aggregates,
    // then returns early when MCWorld.ensureOnItem() returns undefined for a stub item.
    const item = createStubProjectItem({ itemType: ProjectItemType.MCWorld });
    const results = await gen.generate(item, noOpContentIndex);
    assert.lengthOf(results, 6);
    assert.isTrue(results.every((r) => r.itemType === InfoItemType.featureAggregate));
    assert.strictEqual(results[0].generatorIndex, WorldDataInfoGeneratorTest.blocks);
    assert.strictEqual(results[1].generatorIndex, WorldDataInfoGeneratorTest.blockData);
    assert.strictEqual(results[4].generatorIndex, WorldDataInfoGeneratorTest.command);
    assert.strictEqual(results[5].generatorIndex, WorldDataInfoGeneratorTest.executeSubCommand);
  });

  it("MCFunction item with no string content returns 2 featureAggregate items", async () => {
    // getStringContent() returns undefined → generator skips processListOfCommands.
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction });
    const results = await gen.generate(item, noOpContentIndex);
    assert.lengthOf(results, 2);
    assert.isTrue(results.every((r) => r.itemType === InfoItemType.featureAggregate));
    assert.strictEqual(results[0].generatorIndex, WorldDataInfoGeneratorTest.command);
    assert.strictEqual(results[1].generatorIndex, WorldDataInfoGeneratorTest.executeSubCommand);
  });

  it("MCFunction item with a valid built-in command increments command featureAggregate", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.MCFunction,
      stringContent: "say hello\nteleport @s 0 64 0",
    });
    const results = await gen.generate(item, noOpContentIndex);
    const commandsPi = results.find((r) => r.generatorIndex === WorldDataInfoGeneratorTest.command);
    assert.isDefined(commandsPi);
    assert.isDefined(commandsPi!.featureSets);
  });
});
