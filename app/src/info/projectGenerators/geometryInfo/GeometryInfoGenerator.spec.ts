// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import GeometryInfoGenerator, { GeometryInfoGeneratorTest } from "./GeometryInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

/** Builds a minimal geometry JSON string with the given number of cubes in one bone. */
function makeGeometryJson(cubeCount: number): string {
  const cubes = Array.from({ length: cubeCount }, () => ({ origin: [0, 0, 0], size: [1, 1, 1], uv: [0, 0] }));
  return JSON.stringify({
    format_version: "1.12.0",
    "minecraft:geometry": [
      {
        description: { identifier: "geometry.test_block", texture_width: 16, texture_height: 16 },
        bones: [{ name: "body", cubes }],
      },
    ],
  });
}

describe("GeometryInfoGenerator", () => {
  const gen = new GeometryInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "GEOMETRY");
    assert.strictEqual(gen.title, "Model Geometry Validation");
  });

  it("always returns 3 featureAggregate items for an empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, {} as any);

    assert.lengthOf(results, 3);
    assert.isTrue(
      results.every((r) => r.itemType === InfoItemType.featureAggregate),
      "all returned items should be featureAggregate"
    );
  });

  it("returns featureAggregate items with correct generatorIndices", async () => {
    const project = createStubProject();
    const results = await gen.generate(project, {} as any);

    const indices = results.map((r) => r.generatorIndex);
    assert.include(indices, GeometryInfoGeneratorTest.blockGeometry);
    assert.include(indices, GeometryInfoGeneratorTest.entityGeometry);
    assert.include(indices, GeometryInfoGeneratorTest.itemGeometry);
  });

  it("returns 3 items when project contains only non-geometry items", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, {} as any);

    assert.lengthOf(results, 3);
  });

  it("returns 3 items when geometry item has no primaryFile", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project, {} as any);

    assert.lengthOf(results, 3, "no additional items should be added when primaryFile is absent");
  });

  it("adds overlyComplexBlockGeometry warning for block geometry with more than 50 cubes", async () => {
    // Use a path containing /blocks/ so the generator classifies it as block geometry
    const file = createStubFile({ name: "pack/blocks/test.geo.json", content: makeGeometryJson(51) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item]);

    const results = await gen.generate(project, {} as any);

    const warnings = results.filter((r) => r.generatorIndex === GeometryInfoGeneratorTest.overlyComplexBlockGeometry);
    assert.lengthOf(warnings, 1, "should report exactly one overlyComplexBlockGeometry warning");
    assert.strictEqual(warnings[0].itemType, InfoItemType.warning);
  });

  it("does not add overlyComplexBlockGeometry warning for block geometry with exactly 50 cubes", async () => {
    const file = createStubFile({ name: "pack/blocks/test.geo.json", content: makeGeometryJson(50) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item]);

    const results = await gen.generate(project, {} as any);

    const warnings = results.filter((r) => r.generatorIndex === GeometryInfoGeneratorTest.overlyComplexBlockGeometry);
    assert.lengthOf(warnings, 0, "exactly 50 cubes should not trigger the warning");
  });

  it("does not add overlyComplexBlockGeometry warning for entity geometry with 51 cubes", async () => {
    const file = createStubFile({ name: "pack/entity/test.geo.json", content: makeGeometryJson(51) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item]);

    const results = await gen.generate(project, {} as any);

    const warnings = results.filter((r) => r.generatorIndex === GeometryInfoGeneratorTest.overlyComplexBlockGeometry);
    assert.lengthOf(warnings, 0, "entity geometry should not trigger block cube budget warning");
  });
});
