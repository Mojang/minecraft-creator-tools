// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCP Client Integration Tests
 *
 * These tests validate the MCP model design fixtures and schema compliance.
 * Full subprocess-based MCP protocol tests are planned for the future.
 *
 * Note: Full MCP protocol tests would spawn the MCP server as a subprocess
 * and communicate via stdio transport, but require more complex setup.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { McpTestFixtures } from "./McpToolsTest";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import MinecraftMcpServer from "../local/MinecraftMcpServer";

// These tests validate the MCP model design fixtures
describe("MCP Client Integration Tests", function () {
  // Increase timeout for integration tests
  this.timeout(30000);

  describe("Model Design Schema Validation", function () {
    // These tests verify that the Zod schemas correctly validate input

    it("should accept valid design with texture references", function () {
      // Test that the fixture is valid JSON that matches our schema
      const design = McpTestFixtures.CUBE_WITH_TEXTURE_REFS;

      expect(design.textures).to.not.be.undefined;
      expect(design.textures!["wood_side"]).to.have.property("background");
      expect(design.bones[0].cubes[0].faces.north).to.have.property("textureId");
    });

    it("should handle design with mixed inline and texture references", function () {
      const design = McpTestFixtures.CUBE_WITH_MIXED_TEXTURES;

      // Check mixed texture usage
      expect(design.textures).to.not.be.undefined;
      expect(design.bones[0].cubes[0].faces.north?.textureId).to.equal("wood");
      // Modern format uses background with type:solid instead of inline color
      expect(design.bones[0].cubes[0].faces.east?.background?.type).to.equal("solid");
      expect(design.bones[0].cubes[0].faces.east?.background?.colors[0]).to.equal("#FF0000");
      expect(design.bones[0].cubes[0].faces.up?.svg).to.include("<svg");
    });

    it("should serialize and deserialize design correctly", function () {
      const design = McpTestFixtures.CUBE_WITH_TEXTURE_REFS;

      // Simulate what happens when the design goes through JSON serialization
      const serialized = JSON.stringify(design);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.identifier).to.equal(design.identifier);
      expect(deserialized.textures).to.deep.equal(design.textures);
      expect(deserialized.bones[0].cubes[0].faces.north.textureId).to.equal("bark");
    });
  });

  describe("Design Fixture Validation", function () {
    // Validate all test fixtures are well-formed

    const fixtures = [
      { name: "SIMPLE_COLORED_CUBE", fixture: McpTestFixtures.SIMPLE_COLORED_CUBE },
      { name: "CUBE_WITH_TEXTURE_REFS", fixture: McpTestFixtures.CUBE_WITH_TEXTURE_REFS },
      { name: "CUBE_WITH_DEDUPLICATION", fixture: McpTestFixtures.CUBE_WITH_DEDUPLICATION },
      { name: "CUBE_WITH_MIXED_TEXTURES", fixture: McpTestFixtures.CUBE_WITH_MIXED_TEXTURES },
      { name: "MULTI_BONE_WITH_SHARED_TEXTURES", fixture: McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES },
      { name: "CUBE_WITH_SVG_TEXTURE", fixture: McpTestFixtures.CUBE_WITH_SVG_TEXTURE },
    ];

    for (const { name, fixture } of fixtures) {
      it(`${name} should be valid for conversion`, function () {
        // Should have required fields
        expect(fixture.identifier).to.be.a("string");
        expect(fixture.bones).to.be.an("array");
        expect(fixture.bones.length).to.be.greaterThan(0);

        // Should have at least one cube
        expect(fixture.bones[0].cubes).to.be.an("array");
        expect(fixture.bones[0].cubes.length).to.be.greaterThan(0);

        // Should have faces
        expect(fixture.bones[0].cubes[0].faces).to.be.an("object");

        // Should convert without throwing
        const result = ModelDesignUtilities.convertToGeometry(fixture);
        expect(result.geometry).to.not.be.undefined;
      });
    }
  });

  describe("Error Fixture Validation", function () {
    // Validate that error fixtures produce expected errors

    it("CUBE_WITH_INVALID_REF should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_INVALID_REF);
      expect(errors.length).to.be.greaterThan(0);
    });

    it("CUBE_WITH_REF_NO_DICT should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_REF_NO_DICT);
      expect(errors.length).to.be.greaterThan(0);
    });

    it("TEXTURE_WITHOUT_CONTENT should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.TEXTURE_WITHOUT_CONTENT);
      expect(errors.length).to.be.greaterThan(0);
    });
  });

  // Regression: designModel produced models with the default
  // visible_bounds_width/height of 1, which caused the renderer to cull
  // larger models (e.g. the 2.5-block-long boat) so they appeared invisible.
  // When visibleBoundsSize is omitted, bounds must be auto-computed from cube
  // extents.
  describe("auto-computed visible bounds", function () {
    it("should auto-compute bounds large enough for a 2.5-block-long boat-sized model", function () {
      const design = {
        identifier: "boat_like",
        textureSize: [64, 64] as [number, number],
        pixelsPerUnit: 2,
        textures: {
          hull: { background: { type: "solid", colors: ["#1E90FF"] } },
        },
        bones: [
          {
            name: "hull",
            pivot: [0, 0, 0] as [number, number, number],
            cubes: [
              {
                // 20 wide × 6 tall × 40 long = 1.25 × 0.375 × 2.5 blocks
                origin: [-10, 0, -20] as [number, number, number],
                size: [20, 6, 40] as [number, number, number],
                faces: { up: { textureId: "hull" } },
              },
            ],
          },
        ],
      } as any;

      const result = ModelDesignUtilities.convertToGeometry(design);
      const desc = result.geometry["minecraft:geometry"][0].description;
      expect(desc.visible_bounds_width, "width must cover the longest horizontal extent").to.be.at.least(3);
      expect(desc.visible_bounds_height).to.be.at.least(1);
    });

    it("should respect explicit visibleBoundsSize when provided", function () {
      const design = {
        identifier: "explicit_bounds",
        textureSize: [16, 16] as [number, number],
        pixelsPerUnit: 1,
        textures: { t: { background: { type: "solid", colors: ["#ffffff"] } } },
        bones: [
          {
            name: "b",
            pivot: [0, 0, 0] as [number, number, number],
            cubes: [
              {
                origin: [-100, 0, -100] as [number, number, number],
                size: [200, 200, 200] as [number, number, number],
                faces: { up: { textureId: "t" } },
              },
            ],
          },
        ],
        visibleBoundsSize: [7, 4, 7] as [number, number, number],
      } as any;

      const result = ModelDesignUtilities.convertToGeometry(design);
      const desc = result.geometry["minecraft:geometry"][0].description;
      expect(desc.visible_bounds_width).to.equal(7);
      expect(desc.visible_bounds_height).to.equal(4);
    });
  });

  // Regression: `designModel` was always nesting a new
  // `resource_packs/<auto>/` inside whatever projectPath the caller supplied,
  // so passing a path that already IS a resource pack produced files at
  // `…/<rp>/resource_packs/contoso_*/models/…` and the entity rendered as a
  // generic cube.
  describe("_isResourcePackFolder detection", function () {
    let tmpRoot: string;

    beforeEach(function () {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-rpdetect-"));
    });

    afterEach(function () {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    });

    it("returns true for a folder containing a manifest.json with a resources module", function () {
      fs.writeFileSync(
        path.join(tmpRoot, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: { name: "rp", uuid: "00000000-0000-0000-0000-000000000001", version: [1, 0, 0] },
          modules: [{ type: "resources", uuid: "00000000-0000-0000-0000-000000000002", version: [1, 0, 0] }],
        })
      );
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(true);
    });

    it("returns false for a folder containing a behavior-pack manifest", function () {
      fs.writeFileSync(
        path.join(tmpRoot, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: { name: "bp", uuid: "00000000-0000-0000-0000-000000000003", version: [1, 0, 0] },
          modules: [{ type: "data", uuid: "00000000-0000-0000-0000-000000000004", version: [1, 0, 0] }],
        })
      );
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });

    it("returns false for a folder with no manifest.json", function () {
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });

    it("returns false for a folder with malformed manifest.json", function () {
      fs.writeFileSync(path.join(tmpRoot, "manifest.json"), "{ not valid json");
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });
  });
});
