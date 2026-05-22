// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckFeatureDeprecationInfoGenerator from "./CheckFeatureDeprecationInfoGenerator";
import { CheckFeatureDeprecationInfoGeneratorTest } from "./CheckFeatureDeprecationInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";

describe("CheckFeatureDeprecationInfoGenerator", () => {
  let generator: CheckFeatureDeprecationInfoGenerator;

  beforeEach(() => {
    generator = new CheckFeatureDeprecationInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CHECKFEATUREDEPRECATION");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an empty project", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should ignore items with non-matching names", async () => {
    const file = createStubFile({ name: "manifest.json", content: '{"fletching_table": {}}' });
    const item = createStubProjectItem({ name: "manifest.json", file });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  describe("blocks.json", () => {
    it("should report deprecatedBlockOverride for a deprecated block (fletching_table)", async () => {
      const file = createStubFile({ name: "blocks.json", content: '{"fletching_table": {}}' });
      const item = createStubProjectItem({ name: "blocks.json", file });
      const results = await generator.generate(createStubProject([item]));
      const warnings = results.filter(
        (r) => r.generatorIndex === CheckFeatureDeprecationInfoGeneratorTest.deprecatedBlockOverride
      );
      expect(warnings.length).to.equal(1);
    });

    it("should report deprecatedBlockOverride for a deprecated block (smithing_table)", async () => {
      const file = createStubFile({ name: "blocks.json", content: '{"smithing_table": {}}' });
      const item = createStubProjectItem({ name: "blocks.json", file });
      const results = await generator.generate(createStubProject([item]));
      const warnings = results.filter(
        (r) => r.generatorIndex === CheckFeatureDeprecationInfoGeneratorTest.deprecatedBlockOverride
      );
      expect(warnings.length).to.equal(1);
    });

    it("should report two deprecatedBlockOverride warnings when both deprecated blocks are present", async () => {
      const content = JSON.stringify({ fletching_table: {}, smithing_table: {} });
      const file = createStubFile({ name: "blocks.json", content });
      const item = createStubProjectItem({ name: "blocks.json", file });
      const results = await generator.generate(createStubProject([item]));
      const warnings = results.filter(
        (r) => r.generatorIndex === CheckFeatureDeprecationInfoGeneratorTest.deprecatedBlockOverride
      );
      expect(warnings.length).to.equal(2);
    });

    it("should return no results for blocks.json with no deprecated blocks", async () => {
      const file = createStubFile({ name: "blocks.json", content: '{"stone": {}}' });
      const item = createStubProjectItem({ name: "blocks.json", file });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });
  });

  describe("terrain_texture.json", () => {
    it("should report deprecatedTerrainTexture for a deprecated texture entry", async () => {
      const content = JSON.stringify({
        texture_data: { smithing_table_top: { textures: "blocks/smithing_table_top" } },
      });
      const file = createStubFile({ name: "terrain_texture.json", content });
      const item = createStubProjectItem({ name: "terrain_texture.json", file });
      const results = await generator.generate(createStubProject([item]));
      const warnings = results.filter(
        (r) => r.generatorIndex === CheckFeatureDeprecationInfoGeneratorTest.deprecatedTerrainTexture
      );
      expect(warnings.length).to.equal(1);
    });

    it("should return no results for terrain_texture.json with no deprecated entries", async () => {
      const content = JSON.stringify({ texture_data: { grass: { textures: "blocks/grass_carried" } } });
      const file = createStubFile({ name: "terrain_texture.json", content });
      const item = createStubProjectItem({ name: "terrain_texture.json", file });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });

    it("should return no results for terrain_texture.json with empty texture_data", async () => {
      const file = createStubFile({ name: "terrain_texture.json", content: '{"texture_data": {}}' });
      const item = createStubProjectItem({ name: "terrain_texture.json", file });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });
  });

  describe("deprecated texture files in blocks/ folder", () => {
    it("should report deprecatedTexture for a deprecated texture filename in the blocks folder", async () => {
      const item = createStubProjectItem({
        name: "smithing_table_top.png",
        getFolder: () => ({ name: "blocks" }),
      });
      const results = await generator.generate(createStubProject([item]));
      const warnings = results.filter(
        (r) => r.generatorIndex === CheckFeatureDeprecationInfoGeneratorTest.deprecatedTexture
      );
      expect(warnings.length).to.equal(1);
    });

    it("should return no results for a non-deprecated texture in the blocks folder", async () => {
      const item = createStubProjectItem({
        name: "grass_carried.png",
        getFolder: () => ({ name: "blocks" }),
      });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });

    it("should not flag a deprecated texture filename outside the blocks folder", async () => {
      const item = createStubProjectItem({
        name: "smithing_table_top.png",
        getFolder: () => ({ name: "textures" }),
      });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });
  });
});
