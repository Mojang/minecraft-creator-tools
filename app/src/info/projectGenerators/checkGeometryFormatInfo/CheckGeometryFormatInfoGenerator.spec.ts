// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckGeometryFormatInfoGenerator from "./CheckGeometryFormatInfoGenerator";
import { CheckGeometryFormatInfoGeneratorTest } from "./CheckGeometryFormatInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

const GEOMETRY_WITH_POLY_MESH = JSON.stringify({
  "minecraft:geometry": [
    {
      description: { identifier: "geometry.test", texture_width: 64, texture_height: 64 },
      bones: [{ name: "root", poly_mesh: { normalized_uvs: false } }],
    },
  ],
});

const GEOMETRY_WITHOUT_POLY_MESH = JSON.stringify({
  "minecraft:geometry": [
    {
      description: { identifier: "geometry.test", texture_width: 64, texture_height: 64 },
      bones: [{ name: "root", cubes: [] }],
    },
  ],
});

const GEOMETRY_NO_BONES = JSON.stringify({
  "minecraft:geometry": [{ description: { identifier: "geometry.test" } }],
});

describe("CheckGeometryFormatInfoGenerator", () => {
  let generator: CheckGeometryFormatInfoGenerator;

  beforeEach(() => {
    generator = new CheckGeometryFormatInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("GEOFMT");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results when isMinecraftCreator is true (first-party content is exempt)", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_WITH_POLY_MESH });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    // isMinecraftCreator defaults to false in stub; here we override to true → no check should run
    const project = createStubProject([item], [], { isMinecraftCreator: true });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should return no results for an empty project", async () => {
    const project = createStubProject([], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should skip items that are not modelGeometryJson type", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_WITH_POLY_MESH });
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior, file });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should skip a modelGeometryJson item with no primaryFile", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should return no results when geometry has no bones", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_NO_BONES });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should return no results when geometry bones have no poly_mesh", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_WITHOUT_POLY_MESH });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should report restrictedPolyMeshFound when a bone has poly_mesh", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_WITH_POLY_MESH });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    const errors = results.filter(
      (r) => r.generatorIndex === CheckGeometryFormatInfoGeneratorTest.restrictedPolyMeshFound
    );
    expect(errors.length).to.equal(1);
  });

  it("should include the bone name in the restrictedPolyMeshFound result data", async () => {
    const file = createStubFile({ name: "model.geo.json", content: GEOMETRY_WITH_POLY_MESH });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const project = createStubProject([item], [], { isMinecraftCreator: false });
    const results = await generator.generate(project);
    expect(results.length).to.equal(1);
    expect(results[0].data).to.equal("root");
  });
});
