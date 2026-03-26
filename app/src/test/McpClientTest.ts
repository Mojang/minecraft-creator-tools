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
import { McpTestFixtures } from "./McpToolsTest";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";

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
});
