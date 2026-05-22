// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import LineSizeInfoGenerator from "./LineSizeInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType, ProjectItemStorageType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

describe("LineSizeInfoGenerator", () => {
  const gen = new LineSizeInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "LINESIZE");
    assert.strictEqual(gen.title, "File Line/Size Information");
  });

  it("has canAlwaysProcess set to true", () => {
    assert.isTrue(gen.canAlwaysProcess);
  });

  it("returns empty array for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("creates a featureAggregate item for a singleFile item type", async () => {
    const content = "line1\nline2\nline3";
    const file = createStubFile({ name: "entity.json", content });
    const item = createStubProjectItem({
      itemType: ProjectItemType.entityTypeBehavior,
      file,
      storageType: ProjectItemStorageType.singleFile,
    });
    const project = createStubProject([item]);
    const results = await gen.generate(project, noOpContentIndex);

    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].itemType, InfoItemType.featureAggregate);
  });
});
