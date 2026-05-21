// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import CrossReferenceIndexGenerator from "./CrossReferenceIndexGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { AnnotationCategory } from "../../../core/ContentIndex";

/** Returns a spy-based ContentIndex stub that records all insert() calls. */
function makeContentIndexSpy() {
  const inserted: { key: string; path: string; annotation: string }[] = [];
  const contentIndex = {
    insert: (key: string, path: string, annotation: string) => {
      inserted.push({ key, path, annotation });
    },
  } as any;
  return { contentIndex, inserted };
}

describe("CrossReferenceIndexGenerator", () => {
  const gen = new CrossReferenceIndexGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "CROSSREFINDEX");
    assert.strictEqual(gen.title, "Cross-Reference Index");
  });

  it("always returns an empty array", async () => {
    const project = createStubProject();
    const { contentIndex } = makeContentIndexSpy();
    const results = await gen.generate(project, contentIndex);
    assert.deepEqual(results, []);
  });

  it("skips items with no projectPath", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.lengthOf(inserted, 0, "nothing should be inserted when projectPath is absent");
  });

  it("skips items with unrecognized item types", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      projectPath: "behavior_pack/manifest.json",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.lengthOf(inserted, 0, "unrecognized item types should not be indexed");
  });

  it("indexes MCFunction path without .mcfunction extension", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.MCFunction,
      projectPath: "functions/my_func.mcfunction",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.deepInclude(inserted, {
      key: "my_func",
      path: "functions/my_func.mcfunction",
      annotation: AnnotationCategory.functionSource,
    });
  });

  it("indexes nested MCFunction path without extension", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.MCFunction,
      projectPath: "functions/gameplay/start_game.mcfunction",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.deepInclude(inserted, {
      key: "gameplay/start_game",
      path: "functions/gameplay/start_game.mcfunction",
      annotation: AnnotationCategory.functionSource,
    });
  });

  it("indexes loot table path from loot_tables/ segment onward", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.lootTableBehavior,
      projectPath: "pack/loot_tables/entities/zombie.json",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.deepInclude(inserted, {
      key: "loot_tables/entities/zombie.json",
      path: "pack/loot_tables/entities/zombie.json",
      annotation: AnnotationCategory.lootTableSource,
    });
  });

  it("does not index loot table path when path lacks loot_tables/ segment", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.lootTableBehavior,
      projectPath: "other/zombie.json",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.lengthOf(inserted, 0);
  });

  it("indexes structure path without .mcstructure extension", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.structure,
      projectPath: "pack/structures/myworld/myhouse.mcstructure",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.deepInclude(inserted, {
      key: "myworld/myhouse",
      path: "pack/structures/myworld/myhouse.mcstructure",
      annotation: AnnotationCategory.structureSource,
    });
  });

  it("indexes dialogue by path with last extension stripped", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.dialogueBehaviorJson,
      projectPath: "dialogues/scene.dialogue.json",
    });
    const project = createStubProject([item]);
    const { contentIndex, inserted } = makeContentIndexSpy();

    await gen.generate(project, contentIndex);

    assert.deepInclude(inserted, {
      key: "dialogues/scene.dialogue",
      path: "dialogues/scene.dialogue.json",
      annotation: AnnotationCategory.dialogueSource,
    });
  });
});
