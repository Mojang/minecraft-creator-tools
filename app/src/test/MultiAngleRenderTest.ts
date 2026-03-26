// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Multi-Angle Render Debug Tests
 *
 * These tests specifically target the multi-angle rendering functionality in the MCP server.
 * The issue is that when rendering multiple angles, some renders fail silently resulting
 * in missing panels in the final stitched image.
 *
 * Known failing patterns:
 * 1. Models with overlay effect arrays (e.g., mossy_stone with [cracks, moss])
 * 2. Models with sparkle overlay effect (e.g., potion_bottle, magic_wand, crystal_block)
 * 3. Tall/thin models may have different failure patterns
 *
 * These tests validate the fixtures can be converted to geometry without errors.
 * The actual rendering tests are in McpServerIntegrationTest.ts (test-extra).
 */

import { expect, assert } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { McpTestFixtures } from "./McpToolsTest";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import { IMcpModelDesign } from "../minecraft/IMcpModelDesign";
import { testFolders } from "./PngTestUtilities";

const SCENARIO_NAME = "multiangle_render_debug";

/**
 * Test fixtures that specifically failed in multi-angle rendering
 */
export const MultiAngleFailingFixtures = {
  /**
   * Mossy stone - fails with overlay effect array
   */
  MOSSY_STONE: McpTestFixtures.MOSSY_STONE_BLOCK,

  /**
   * Crystal block - fails with pillow lighting + sparkle overlay
   */
  CRYSTAL_BLOCK: McpTestFixtures.CRYSTAL_BLOCK,

  /**
   * Potion bottle - multi-bone model that fails with sparkle overlay
   */
  POTION_BOTTLE: McpTestFixtures.POTION_BOTTLE_ITEM,

  /**
   * Magic wand - tall thin model that fails with sparkle overlay
   */
  MAGIC_WAND: McpTestFixtures.MAGIC_WAND_ITEM,

  /**
   * Simple colored cube - should always work (baseline)
   */
  SIMPLE_CUBE: McpTestFixtures.SIMPLE_COLORED_CUBE,
};

describe("Multi-Angle Render Debug Tests", function () {
  // Increase timeout for rendering tests
  this.timeout(60000);

  /**
   * Test that all fixtures can at least convert to geometry JSON
   * This validates the fixtures before testing rendering
   */
  describe("Fixture Validation", function () {
    it("should convert MOSSY_STONE to valid geometry", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.MOSSY_STONE);
      expect(result.geometry["minecraft:geometry"]).to.be.an("array");
      expect(result.geometry["minecraft:geometry"][0].bones).to.have.length.greaterThan(0);
      expect(result.warnings).to.have.length(0);
    });

    it("should convert CRYSTAL_BLOCK to valid geometry", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.CRYSTAL_BLOCK);
      expect(result.geometry["minecraft:geometry"]).to.be.an("array");
      expect(result.warnings).to.have.length(0);
    });

    it("should convert POTION_BOTTLE to valid geometry", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.POTION_BOTTLE);
      expect(result.geometry["minecraft:geometry"]).to.be.an("array");
      // Potion bottle has 3 bones: cork, neck, body
      expect(result.geometry["minecraft:geometry"][0].bones).to.have.length(3);
      expect(result.warnings).to.have.length(0);
    });

    it("should convert MAGIC_WAND to valid geometry", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.MAGIC_WAND);
      expect(result.geometry["minecraft:geometry"]).to.be.an("array");
      // Magic wand has 2 bones: crystal, staff
      expect(result.geometry["minecraft:geometry"][0].bones).to.have.length(2);
      expect(result.warnings).to.have.length(0);
    });

    it("should convert SIMPLE_CUBE to valid geometry (baseline)", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.SIMPLE_CUBE);
      expect(result.geometry["minecraft:geometry"]).to.be.an("array");
      // Note: SIMPLE_COLORED_CUBE may generate warnings due to solid colors - that's OK for this baseline test
    });
  });

  /**
   * Test atlas region generation for each fixture
   * This ensures the textures regions are properly calculated
   */
  describe("Atlas Region Generation", function () {
    it("should generate atlas regions for MOSSY_STONE", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.MOSSY_STONE);
      expect(result.atlasRegions).to.be.an("array");
      expect(result.atlasRegions.length).to.be.greaterThan(0);
      expect(result.textureSize[0]).to.be.greaterThan(0);
      expect(result.textureSize[1]).to.be.greaterThan(0);
    });

    it("should generate atlas regions for CRYSTAL_BLOCK", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.CRYSTAL_BLOCK);
      expect(result.atlasRegions).to.be.an("array");
      expect(result.atlasRegions.length).to.be.greaterThan(0);
    });

    it("should generate atlas regions for POTION_BOTTLE", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.POTION_BOTTLE);
      expect(result.atlasRegions).to.be.an("array");
      // Multiple bones with different textures
      expect(result.atlasRegions.length).to.be.greaterThan(1);
    });

    it("should generate atlas regions for MAGIC_WAND", function () {
      const result = ModelDesignUtilities.convertToGeometry(MultiAngleFailingFixtures.MAGIC_WAND);
      expect(result.atlasRegions).to.be.an("array");
      // Two texture types: crystal and wood
      expect(result.atlasRegions.length).to.be.greaterThan(0);
    });
  });

  /**
   * Export geometry JSON to files for manual inspection
   */
  describe("Export Geometry for Inspection", function () {
    let outputDir: string;

    before(function () {
      // Initialize testFolders if not already done
      testFolders.initialize();
      outputDir = testFolders.getResultsPath(SCENARIO_NAME);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    });

    function exportGeometry(design: IMcpModelDesign, name: string): string {
      const result = ModelDesignUtilities.convertToGeometry(design);
      const geometryPath = path.join(outputDir, `${name}.geo.json`);
      fs.writeFileSync(geometryPath, JSON.stringify(result.geometry, null, 2));
      return geometryPath;
    }

    it("should export MOSSY_STONE geometry for inspection", function () {
      const geometryPath = exportGeometry(MultiAngleFailingFixtures.MOSSY_STONE, "mossy_stone");
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = JSON.parse(fs.readFileSync(geometryPath, "utf-8"));
      expect(content["minecraft:geometry"]).to.be.an("array");
    });

    it("should export CRYSTAL_BLOCK geometry for inspection", function () {
      const geometryPath = exportGeometry(MultiAngleFailingFixtures.CRYSTAL_BLOCK, "crystal_block");
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should export POTION_BOTTLE geometry for inspection", function () {
      const geometryPath = exportGeometry(MultiAngleFailingFixtures.POTION_BOTTLE, "potion_bottle");
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should export MAGIC_WAND geometry for inspection", function () {
      const geometryPath = exportGeometry(MultiAngleFailingFixtures.MAGIC_WAND, "magic_wand");
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });
  });
});

/**
 * JSON payloads that can be used to debug the MCP server directly
 * Copy these into MCP tool calls to reproduce failing behavior
 */
export const MultiAngleDebugPayloads = {
  /**
   * previewModelDesign call with MOSSY_STONE that fails
   */
  MOSSY_STONE_PREVIEW: {
    name: "previewModelDesign",
    arguments: {
      design: MultiAngleFailingFixtures.MOSSY_STONE,
      width: 768,
      height: 768,
      multiAngle: true,
      anglePresets: ["front-right", "front-left"],
    },
  },

  /**
   * previewModelDesign call with CRYSTAL_BLOCK that fails
   */
  CRYSTAL_BLOCK_PREVIEW: {
    name: "previewModelDesign",
    arguments: {
      design: MultiAngleFailingFixtures.CRYSTAL_BLOCK,
      width: 768,
      height: 768,
      multiAngle: true,
      anglePresets: ["front-right", "front-left"],
    },
  },

  /**
   * previewModelDesign call with simple cube (baseline that should work)
   */
  SIMPLE_CUBE_PREVIEW: {
    name: "previewModelDesign",
    arguments: {
      design: MultiAngleFailingFixtures.SIMPLE_CUBE,
      width: 768,
      height: 768,
      multiAngle: true,
      anglePresets: ["front-right", "front-left"],
    },
  },
};

export default MultiAngleFailingFixtures;
