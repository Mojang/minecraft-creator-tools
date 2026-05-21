// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import WorldItemInfoGenerator from "./WorldItemInfoGenerator";
import { WorldItemInfoGeneratorTest } from "./WorldItemInfoData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";
import MCWorld from "../../../minecraft/MCWorld";
import Log from "../../../core/Log";
import { after } from "node:test";

function createStubLoadedWorld(): MCWorld {
  const world = new MCWorld();
  (world as any)._isLoaded = true;
  return world;
}

function stubItemWithWorld(world: MCWorld, itemType: ProjectItemType) {
  const stubFolder = { manager: world } as any;
  const item = createStubProjectItem({ itemType, isContentLoaded: true });
  (item as any).defaultFolder = stubFolder;
  return item;
}

describe("WorldItemInfoGenerator", () => {
  let gen: WorldItemInfoGenerator;
  let originalDebugAlert: typeof Log.debugAlert;

  // Suppress noise from test results, in the future, ideally we would build a more testable/stubbable way of building MCWorld instances
  before(() => {
    originalDebugAlert = Log.debugAlert.bind(Log);
    Log.debugAlert = () => {};
  });

  after(() => {
    Log.debugAlert = originalDebugAlert;
  });

  beforeEach(() => {
    gen = new WorldItemInfoGenerator();
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "WORLD");
    assert.strictEqual(gen.title, "World Validation");
  });

  it("returns [] for a non-world item type", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const results = await gen.generate(item);
    assert.deepEqual(results, []);
  });

  describe("world item types return [] when the world cannot be loaded", () => {
    // Suppress noise from test results, in the future, ideally we would build a more testable/stubbable way of building MCWorld instances
    before(() => {
      Log._suppressedLogs["all"] = true;
    });
    after(() => {
      delete Log._suppressedLogs["all"];
    });
    // MCWorld.ensureOnItem() returns undefined for a stub item that has neither
    // defaultFolder nor primaryFile — the generator detects this and returns early.
    const worldItemTypes: [string, ProjectItemType][] = [
      ["MCWorld", ProjectItemType.MCWorld],
      ["MCTemplate", ProjectItemType.MCTemplate],
      ["worldFolder", ProjectItemType.worldFolder],
    ];

    for (const [typeName, itemType] of worldItemTypes) {
      it(`returns [] for ${typeName} when the world cannot be loaded`, async () => {
        const item = createStubProjectItem({ itemType, isContentLoaded: true });
        const results = await gen.generate(item);
        expect(results).to.deep.equal([]);
      });
    }
  });

  describe("loaded world without manifest", () => {
    // A bare MCWorld with no levelData and no manifest produces exactly 3 info items —
    // one per experiment flag — all with data = false (the getter default).
    const worldItemTypes: [string, ProjectItemType][] = [
      ["MCWorld", ProjectItemType.MCWorld],
      ["MCTemplate", ProjectItemType.MCTemplate],
      ["worldFolder", ProjectItemType.worldFolder],
    ];

    for (const [typeName, itemType] of worldItemTypes) {
      it(`returns 3 experiment info items for a loaded ${typeName}`, async () => {
        const world = createStubLoadedWorld();
        const item = stubItemWithWorld(world, itemType);
        const results = await gen.generate(item);
        assert.lengthOf(results, 3);
        assert.isTrue(results.every((r) => r.itemType === InfoItemType.info));
        assert.strictEqual(results[0].generatorIndex, WorldItemInfoGeneratorTest.betaApisExperiment);
        assert.strictEqual(results[1].generatorIndex, WorldItemInfoGeneratorTest.dataDrivenItemsExperiment);
        assert.strictEqual(results[2].generatorIndex, WorldItemInfoGeneratorTest.deferredTechnicalPreviewExperiment);
        assert.strictEqual(results[0].data, false);
        assert.strictEqual(results[1].data, false);
        assert.strictEqual(results[2].data, false);
      });
    }
  });

  describe("loaded world experiment flags", () => {
    it("reflects betaApisExperiment = true in output", async () => {
      const world = createStubLoadedWorld();
      world.betaApisExperiment = true;
      const item = stubItemWithWorld(world, ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const betaItem = results.find((r) => r.generatorIndex === WorldItemInfoGeneratorTest.betaApisExperiment);
      assert.isDefined(betaItem);
      assert.strictEqual(betaItem!.data, true);
    });

    it("reflects dataDrivenItemsExperiment = true in output", async () => {
      const world = createStubLoadedWorld();
      world.dataDrivenItemsExperiment = true;
      const item = stubItemWithWorld(world, ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const ddItem = results.find((r) => r.generatorIndex === WorldItemInfoGeneratorTest.dataDrivenItemsExperiment);
      assert.isDefined(ddItem);
      assert.strictEqual(ddItem!.data, true);
    });

    it("reflects deferredTechnicalPreviewExperiment = true in output", async () => {
      const world = createStubLoadedWorld();
      world.deferredTechnicalPreviewExperiment = true;
      const item = stubItemWithWorld(world, ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const dtpItem = results.find(
        (r) => r.generatorIndex === WorldItemInfoGeneratorTest.deferredTechnicalPreviewExperiment
      );
      assert.isDefined(dtpItem);
      assert.strictEqual(dtpItem!.data, true);
    });
  });

  describe("loaded world with manifest", () => {
    function worldWithManifest(
      overrides?: Partial<{ name: string; description: string; base_game_version: number[] }>
    ) {
      const world = createStubLoadedWorld();
      (world as any)._manifest = {
        format_version: 2,
        header: {
          base_game_version: overrides?.base_game_version ?? [1, 21, 0],
          name: overrides?.name ?? "Test World",
          description: overrides?.description ?? "A test world",
          uuid: "00000000-0000-0000-0000-000000000000",
          version: [1, 0, 0],
        },
        modules: [],
      };
      return world;
    }

    it("returns 6 info items when manifest is present", async () => {
      const item = stubItemWithWorld(worldWithManifest(), ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      assert.lengthOf(results, 6);
    });

    it("reports base game version as a dot-joined string", async () => {
      const item = stubItemWithWorld(worldWithManifest({ base_game_version: [1, 21, 0] }), ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const versionItem = results.find((r) => r.generatorIndex === WorldItemInfoGeneratorTest.baseGameVersion);
      assert.isDefined(versionItem);
      assert.strictEqual(versionItem!.data, "1.21.0");
    });

    it("reports world name from manifest header", async () => {
      const item = stubItemWithWorld(worldWithManifest({ name: "My World" }), ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const nameItem = results.find((r) => r.generatorIndex === WorldItemInfoGeneratorTest.worldName);
      assert.isDefined(nameItem);
      assert.strictEqual(nameItem!.data, "My World");
    });

    it("reports world description from manifest header", async () => {
      const item = stubItemWithWorld(worldWithManifest({ description: "Hello world" }), ProjectItemType.MCWorld);
      const results = await gen.generate(item);
      const descItem = results.find((r) => r.generatorIndex === WorldItemInfoGeneratorTest.worldDescription);
      assert.isDefined(descItem);
      assert.strictEqual(descItem!.data, "Hello world");
    });
  });
});
