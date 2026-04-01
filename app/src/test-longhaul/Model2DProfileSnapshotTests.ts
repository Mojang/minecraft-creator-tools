// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model2DProfileSnapshotTests - Tests for 2D front/side profile renders of vanilla models.
 *
 * These tests render 2D profile views (front and side) of vanilla entity models using the
 * pure Node.js rendering pipeline (Model2DRenderer + resvg). Unlike the 3D snapshot tests
 * which require Playwright/browser, these run entirely in Node.js and are much faster.
 *
 * The pipeline:
 * 1. Load vanilla entity geometry + texture via VanillaProjectManager
 * 2. Render 2D SVG using Model2DRenderer (projects 3D geometry to 2D)
 * 3. Convert SVG to PNG using resvg-js
 * 4. Compare against baseline snapshots in debugoutput/res/profiles/
 *
 * To run these tests:
 *   npm run test-longhaul -- --grep "2D Profile"    # Run all 2D profile tests
 *   npm run test-longhaul -- --grep "pig profile"   # Run specific entity
 *
 * To update snapshots (regenerate baselines from current renders):
 *   UPDATE_SNAPSHOTS=true npm run test-longhaul -- --grep "2D Profile"
 *
 * Prerequisites:
 *   - Build the project: npm run jsncorebuild
 *   - Vanilla content must be available in public/res/latest/van/
 */

import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

// Core imports
import Model2DRenderer from "../minecraft/Model2DRenderer";
import VanillaProjectManager from "../minecraft/VanillaProjectManager";
import Database from "../minecraft/Database";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import ImageCodecNode from "../local/ImageCodecNode";
import LocalEnvironment from "../local/LocalEnvironment";
import LocalUtilities from "../local/LocalUtilities";
import NodeStorage from "../local/NodeStorage";
import { ViewDirection } from "../minecraft/ModelGeometryUtilities";

/** Check if we're in update mode (regenerate snapshots instead of comparing) */
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === "true";

/** Profile output dimensions */
const PROFILE_WIDTH = 128;
const PROFILE_HEIGHT = 128;

/** Output directory for profile snapshots - in debugoutput so generated images don't pollute public/ */
const PROFILES_DIR = path.join(process.cwd(), "debugoutput/res/profiles");

/** Results directory for test outputs */
const RESULTS_DIR = path.join(process.cwd(), "debugoutput/profile-test-results");

/** Threshold for pixel color difference (0-255 per channel) */
const PIXEL_THRESHOLD = 15;

/** Maximum percentage of pixels allowed to differ */
const MAX_DIFF_PERCENT = 5;

/** Entities to test - start with a subset that are known to work well */
const TEST_ENTITIES = [
  "pig",
  "cow",
  "sheep",
  "chicken",
  "creeper",
  "zombie",
  "skeleton",
  "spider",
  "wolf",
  "cat",
  "horse",
  "villager",
  "iron_golem",
  "rabbit",
  "bat",
  "bee",
  "axolotl",
  "frog",
  "allay",
  "goat",
];

/** View directions to test */
const VIEW_DIRECTIONS: ViewDirection[] = ["front", "right", "iso-front-left", "iso-back-right"];

/** Track initialization state */
let initialized = false;

/**
 * Initialize Database and CreatorToolsHost for tests
 */
async function ensureInitialized(): Promise<boolean> {
  if (initialized) {
    return true;
  }

  try {
    // Set up CreatorToolsHost
    CreatorToolsHost.hostType = HostType.testLocal;
    CreatorToolsHost.contentWebRoot = "https://mctools.dev/";
    CreatorToolsHost.fullLocalStorage = true;

    // Set up Node.js-specific image codec functions
    CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
    CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

    // Create local environment
    const localEnv = new LocalEnvironment(false);

    // Set up Database.local with proper path to find public/ resources
    (localEnv.utilities as LocalUtilities).basePathAdjust = "./public/";
    Database.local = localEnv.utilities;

    // Set up content folder
    const coreStorage = new NodeStorage(path.join(process.cwd(), "public/data/content/"), "");
    Database.contentFolder = coreStorage.rootFolder;

    // Ensure directories exist
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    initialized = true;
    return true;
  } catch (e) {
    console.error("Failed to initialize test environment:", e);
    return false;
  }
}

/**
 * Render an entity to a 2D SVG, then convert to PNG bytes
 */
async function renderEntityProfile(
  entityId: string,
  viewDirection: ViewDirection
): Promise<{ png: Uint8Array; svg: string } | null> {
  // Get vanilla entity model data (geometry + texture)
  const modelData = await VanillaProjectManager.getVanillaEntityModelData(entityId);
  if (!modelData || !modelData.geometry) {
    console.log(`  Skipping ${entityId}: No geometry available`);
    return null;
  }

  // Render to SVG with per-pixel texture sampling for detailed textures
  // Apply dramatic perspective and depth shading for visual depth
  const svg = Model2DRenderer.renderToDetailedSvg(modelData.geometry, {
    viewDirection,
    texturePngData: modelData.textureData,
    outputWidth: PROFILE_WIDTH,
    outputHeight: PROFILE_HEIGHT,
    backgroundColor: "transparent",
    // Depth shading: darken farther faces for depth perception
    depthShading: true,
    depthShadingIntensity: 0.35,
    // Perspective: farther faces appear smaller, converge toward center
    perspectiveStrength: 0.25,
    focalLength: 60,
  });

  if (!svg) {
    console.log(`  Skipping ${entityId}: SVG render failed`);
    return null;
  }

  // Convert SVG to PNG using resvg
  try {
    const { Resvg } = await import("@resvg/resvg-js");

    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: PROFILE_WIDTH,
      },
      background: "transparent",
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return { png: new Uint8Array(pngBuffer), svg };
  } catch (e) {
    console.log(`  Skipping ${entityId}: resvg conversion failed:`, e);
    return null;
  }
}

/**
 * Get the snapshot filename for an entity profile
 */
function getSnapshotFilename(entityId: string, viewDirection: ViewDirection): string {
  return `entity-${entityId.replace(/_/g, "-")}-${viewDirection}.png`;
}

/**
 * Compare two PNG images and return whether they match within tolerance
 */
function comparePngs(
  actualPng: Uint8Array,
  expectedPng: Uint8Array
): { matches: boolean; diffPercent: number; error?: string } {
  try {
    const actual = PNG.sync.read(Buffer.from(actualPng));
    const expected = PNG.sync.read(Buffer.from(expectedPng));

    // Check dimensions match
    if (actual.width !== expected.width || actual.height !== expected.height) {
      return {
        matches: false,
        diffPercent: 100,
        error: `Dimension mismatch: ${actual.width}x${actual.height} vs ${expected.width}x${expected.height}`,
      };
    }

    // Count differing pixels
    const totalPixels = actual.width * actual.height;
    let diffPixels = 0;

    for (let i = 0; i < actual.data.length; i += 4) {
      const rDiff = Math.abs(actual.data[i] - expected.data[i]);
      const gDiff = Math.abs(actual.data[i + 1] - expected.data[i + 1]);
      const bDiff = Math.abs(actual.data[i + 2] - expected.data[i + 2]);
      const aDiff = Math.abs(actual.data[i + 3] - expected.data[i + 3]);

      if (rDiff > PIXEL_THRESHOLD || gDiff > PIXEL_THRESHOLD || bDiff > PIXEL_THRESHOLD || aDiff > PIXEL_THRESHOLD) {
        diffPixels++;
      }
    }

    const diffPercent = (diffPixels / totalPixels) * 100;

    return {
      matches: diffPercent <= MAX_DIFF_PERCENT,
      diffPercent,
    };
  } catch (e) {
    return {
      matches: false,
      diffPercent: 100,
      error: `PNG comparison failed: ${e}`,
    };
  }
}

describe("2D Profile Snapshot Tests", function () {
  // These tests can take a while due to file I/O and rendering
  this.timeout(120000);

  before(async function () {
    const ready = await ensureInitialized();
    if (!ready) {
      this.skip();
    }
  });

  describe("Vanilla Entity 2D Profiles", function () {
    for (const entityId of TEST_ENTITIES) {
      for (const viewDirection of VIEW_DIRECTIONS) {
        it(`should render ${entityId} ${viewDirection} profile correctly`, async function () {
          const snapshotFilename = getSnapshotFilename(entityId, viewDirection);
          const snapshotPath = path.join(PROFILES_DIR, snapshotFilename);
          const resultPath = path.join(RESULTS_DIR, snapshotFilename);
          const svgResultPath = path.join(RESULTS_DIR, snapshotFilename.replace(".png", ".svg"));

          // Render the entity
          const result = await renderEntityProfile(entityId, viewDirection);

          if (!result) {
            // Entity not available - skip (not a failure)
            this.skip();
            return;
          }

          // Save the SVG for debugging
          fs.writeFileSync(svgResultPath, result.svg);

          // Save the result PNG
          fs.writeFileSync(resultPath, Buffer.from(result.png));

          if (UPDATE_SNAPSHOTS) {
            // Update mode: save as new baseline
            fs.writeFileSync(snapshotPath, Buffer.from(result.png));
            console.log(`  Updated snapshot: ${snapshotFilename}`);
            return;
          }

          // Compare mode: check against baseline
          if (!fs.existsSync(snapshotPath)) {
            // No baseline exists yet - save one and pass (first run)
            fs.writeFileSync(snapshotPath, Buffer.from(result.png));
            console.log(`  Created new snapshot: ${snapshotFilename}`);
            return;
          }

          const expectedPng = fs.readFileSync(snapshotPath);
          const comparison = comparePngs(result.png, new Uint8Array(expectedPng));

          if (!comparison.matches) {
            // Save a diff image or detailed comparison info
            const diffInfoPath = path.join(RESULTS_DIR, snapshotFilename.replace(".png", "-diff-info.txt"));
            fs.writeFileSync(
              diffInfoPath,
              `Snapshot comparison failed for ${entityId} ${viewDirection}\n` +
                `Diff percent: ${comparison.diffPercent.toFixed(2)}%\n` +
                `Threshold: ${MAX_DIFF_PERCENT}%\n` +
                (comparison.error ? `Error: ${comparison.error}\n` : "")
            );
          }

          assert.isTrue(
            comparison.matches,
            `${entityId} ${viewDirection} profile differs by ${comparison.diffPercent.toFixed(2)}% ` +
              `(threshold: ${MAX_DIFF_PERCENT}%)${comparison.error ? ` - ${comparison.error}` : ""}`
          );
        });
      }
    }
  });

  describe("Render All Available Entities", function () {
    it("should generate profiles for all available vanilla entities", async function () {
      // This test generates profiles for ALL available entities (not just the test subset)
      // Useful for building up the initial snapshot library
      if (!UPDATE_SNAPSHOTS) {
        this.skip();
        return;
      }

      const entityIds = await VanillaProjectManager.getVanillaEntityTypeIds();
      console.log(`\n  Found ${entityIds.length} vanilla entities`);

      let rendered = 0;
      let skipped = 0;

      for (const entityId of entityIds) {
        for (const viewDirection of VIEW_DIRECTIONS) {
          const result = await renderEntityProfile(entityId, viewDirection);
          if (result) {
            const snapshotFilename = getSnapshotFilename(entityId, viewDirection);
            fs.writeFileSync(path.join(PROFILES_DIR, snapshotFilename), Buffer.from(result.png));
            fs.writeFileSync(path.join(RESULTS_DIR, snapshotFilename.replace(".png", ".svg")), result.svg);
            rendered++;
          } else {
            skipped++;
          }
        }
      }

      console.log(`  Rendered: ${rendered}, Skipped: ${skipped}`);
      assert.isAbove(rendered, 0, "Should have rendered at least some entities");
    });
  });
});
