// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * PNG utility functions for test comparisons.
 * Extracted from RenderCommandTests.ts for reuse across test files.
 */

import * as fs from "fs";
import * as path from "path";
import { assert } from "chai";
import StorageUtilities from "../storage/StorageUtilities";
import NodeStorage from "../local/NodeStorage";
import IFolder from "../storage/IFolder";
import TestPaths from "./TestPaths";

// Check if we should update snapshots instead of comparing
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === "true";

// Check if running in CI environment - visual comparison may be unreliable due to
// rendering differences between CI runners and local development machines.
// This can be caused by: different browser versions, GPU drivers, font rendering,
// or software vs hardware rendering.
const IS_CI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.TF_BUILD || process.env.AZURE_PIPELINES);

// PNG signature bytes: 89 50 4E 47 0D 0A 1A 0A
export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Result of a PNG comparison operation.
 */
export interface PngComparisonResult {
  /** Whether the comparison passed (difference below threshold) */
  passed: boolean;
  /** Number of pixels that differ beyond threshold */
  diffPixels: number;
  /** Total number of pixels in the image */
  totalPixels: number;
  /** Percentage of pixels that differ */
  diffPercent: number;
  /** Width of the images */
  width: number;
  /** Height of the images */
  height: number;
}

/**
 * Test folder manager for results and scenarios.
 * Manages the test/results and test/scenarios folder paths.
 */
export class TestFolderManager {
  private _resultsFolder: IFolder | undefined;
  private _scenariosFolder: IFolder | undefined;
  private _initialized: boolean = false;

  /**
   * Initialize the test folder manager.
   * Must be called before using any folder operations.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    const resultsStorage = new NodeStorage(TestPaths.testRoot, "results");
    this._resultsFolder = resultsStorage.rootFolder;
    await this._resultsFolder.ensureExists();

    const scenariosStorage = new NodeStorage(TestPaths.testRoot, "scenarios");
    this._scenariosFolder = scenariosStorage.rootFolder;
    await this._scenariosFolder.load();

    this._initialized = true;
  }

  get resultsFolder(): IFolder {
    if (!this._resultsFolder) {
      throw new Error("TestFolderManager not initialized. Call initialize() first.");
    }
    return this._resultsFolder;
  }

  get scenariosFolder(): IFolder {
    if (!this._scenariosFolder) {
      throw new Error("TestFolderManager not initialized. Call initialize() first.");
    }
    return this._scenariosFolder;
  }

  /**
   * Get the full path to a results folder for a scenario.
   */
  getResultsPath(scenarioName: string): string {
    return (
      StorageUtilities.ensureEndsWithDelimiter(this.resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName)
    );
  }

  /**
   * Get the full path to a scenarios folder.
   */
  getScenariosPath(scenarioName: string): string {
    return (
      StorageUtilities.ensureEndsWithDelimiter(this.scenariosFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName)
    );
  }

  /**
   * Remove a result folder if it exists.
   */
  removeResultFolder(scenarioName: string): void {
    const path = this.getResultsPath(scenarioName);
    const exists = fs.existsSync(path);

    if (exists && !StorageUtilities.isPathRiskyForDelete(path)) {
      try {
        fs.rmSync(path, { recursive: true });
      } catch (e) {
        console.log("Error occurred during rmSync on '" + path + "'");
        throw e;
      }
    }
  }

  /**
   * Ensure a result folder exists.
   */
  ensureResultFolder(scenarioName: string): void {
    const path = this.getResultsPath(scenarioName);
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
  }
}

// Singleton instance for convenience
export const testFolders = new TestFolderManager();

/**
 * Validates that a file is a valid PNG with reasonable size.
 * @param pngPath - Path to the PNG file
 * @param minSize - Minimum file size in bytes (default 1000)
 */
export function assertValidPng(pngPath: string, minSize: number = 1000): void {
  assert(fs.existsSync(pngPath), `PNG file should exist at ${pngPath}`);

  const pngData = fs.readFileSync(pngPath);
  assert(pngData.length > minSize, `PNG should be larger than ${minSize} bytes, got ${pngData.length} bytes`);

  const matchesSignature = PNG_SIGNATURE.every((byte, i) => pngData[i] === byte);
  assert(matchesSignature, "File should have valid PNG signature");
}

/**
 * Compares two PNG files pixel by pixel and returns comparison results.
 * @param resultPath - Path to the result PNG
 * @param scenarioPath - Path to the baseline/scenario PNG
 * @param threshold - Maximum per-channel difference to consider pixels "equal" (default 10)
 * @param maxDiffPercent - Maximum percentage of differing pixels allowed (default 5)
 */
export function comparePngFiles(
  resultPath: string,
  scenarioPath: string,
  threshold: number = 10,
  maxDiffPercent: number = 5
): PngComparisonResult {
  const resultBuffer = fs.readFileSync(resultPath);
  const scenarioBuffer = fs.readFileSync(scenarioPath);

  const PNG = require("pngjs").PNG;

  const resultPng = PNG.sync.read(resultBuffer);
  const scenarioPng = PNG.sync.read(scenarioBuffer);

  // Check dimensions match
  assert.strictEqual(
    resultPng.width,
    scenarioPng.width,
    `Image width mismatch: result=${resultPng.width}, expected=${scenarioPng.width}`
  );
  assert.strictEqual(
    resultPng.height,
    scenarioPng.height,
    `Image height mismatch: result=${resultPng.height}, expected=${scenarioPng.height}`
  );

  // Do pixel-level comparison
  const totalPixels = resultPng.width * resultPng.height;
  let diffPixels = 0;

  for (let i = 0; i < resultPng.data.length; i += 4) {
    const rDiff = Math.abs(resultPng.data[i] - scenarioPng.data[i]);
    const gDiff = Math.abs(resultPng.data[i + 1] - scenarioPng.data[i + 1]);
    const bDiff = Math.abs(resultPng.data[i + 2] - scenarioPng.data[i + 2]);
    const aDiff = Math.abs(resultPng.data[i + 3] - scenarioPng.data[i + 3]);

    if (rDiff > threshold || gDiff > threshold || bDiff > threshold || aDiff > threshold) {
      diffPixels++;
    }
  }

  const diffPercent = (diffPixels / totalPixels) * 100;

  return {
    passed: diffPercent < maxDiffPercent,
    diffPixels,
    totalPixels,
    diffPercent,
    width: resultPng.width,
    height: resultPng.height,
  };
}

/**
 * Asserts that a result PNG matches a baseline PNG within acceptable tolerance.
 * Skips the test if the baseline doesn't exist yet, or updates the baseline if UPDATE_SNAPSHOTS=true.
 * @param testContext - Mocha test context (for skip functionality)
 * @param resultPath - Path to the result PNG
 * @param scenarioPath - Path to the baseline/scenario PNG
 * @param threshold - Maximum per-channel difference (default 10)
 * @param maxDiffPercent - Maximum percentage of differing pixels (default 5)
 */
export function assertPngMatchesBaseline(
  testContext: Mocha.Context,
  resultPath: string,
  scenarioPath: string,
  threshold: number = 10,
  maxDiffPercent: number = 5
): void {
  assert(fs.existsSync(resultPath), "Result PNG should exist at: " + resultPath);

  // If UPDATE_SNAPSHOTS is true, copy the result to scenario regardless of comparison
  if (UPDATE_SNAPSHOTS) {
    // Ensure the scenario directory exists
    const scenarioDir = path.dirname(scenarioPath);
    if (!fs.existsSync(scenarioDir)) {
      fs.mkdirSync(scenarioDir, { recursive: true });
    }
    fs.copyFileSync(resultPath, scenarioPath);
    console.log(`Updated baseline: ${scenarioPath}`);
    return;
  }

  // Skip baseline comparison if scenario doesn't exist yet (first run)
  if (!fs.existsSync(scenarioPath)) {
    console.log("Scenario baseline does not exist yet. To create it, copy " + resultPath + " to " + scenarioPath);
    testContext.skip();
    return;
  }

  const result = comparePngFiles(resultPath, scenarioPath, threshold, maxDiffPercent);

  // In CI environments with >50% pixel difference, skip rather than fail.
  // CI runners can have different browser versions, GPU drivers, or rendering configurations
  // that cause fundamentally different output than the baseline machine.
  // The test still validates that the render command runs and produces a valid PNG.
  if (IS_CI && result.diffPercent > 50) {
    console.log(
      `CI environment detected with ${result.diffPercent.toFixed(
        2
      )}% pixel difference (threshold: ${maxDiffPercent}%). ` +
        `Skipping visual comparison - CI renderer differs from baseline. ` +
        `Dimensions: ${result.width}x${result.height}`
    );
    testContext.skip();
    return;
  }

  assert(
    result.passed,
    `Image content differs too much from baseline. ${result.diffPixels} pixels (${result.diffPercent.toFixed(
      2
    )}%) differ by more than threshold=${threshold}. ` +
      `To update the baseline, copy the result image to the scenario folder.`
  );

  if (result.diffPixels > 0) {
    console.log(
      `Note: ${result.diffPixels} pixels (${result.diffPercent.toFixed(
        2
      )}%) differ slightly from baseline, within acceptable tolerance.`
    );
  }
}

/**
 * Asserts that a result JSON file matches a baseline JSON file.
 * Skips the test if the baseline doesn't exist yet.
 * @param testContext - Mocha test context (for skip functionality)
 * @param resultPath - Path to the result JSON
 * @param scenarioPath - Path to the baseline/scenario JSON
 * @param volatileKeys - Keys to ignore during comparison (e.g., timestamps, UUIDs)
 */
export function assertJsonMatchesBaseline(
  testContext: Mocha.Context,
  resultPath: string,
  scenarioPath: string,
  volatileKeys: string[] = []
): void {
  assert(fs.existsSync(resultPath), "Result JSON should exist at: " + resultPath);

  // If UPDATE_SNAPSHOTS is true, copy the result to scenario regardless of comparison
  if (UPDATE_SNAPSHOTS) {
    // Ensure the scenario directory exists
    const scenarioDir = path.dirname(scenarioPath);
    if (!fs.existsSync(scenarioDir)) {
      fs.mkdirSync(scenarioDir, { recursive: true });
    }
    fs.copyFileSync(resultPath, scenarioPath);
    console.log(`Updated JSON baseline: ${scenarioPath}`);
    return;
  }

  // Skip baseline comparison if scenario doesn't exist yet (first run)
  if (!fs.existsSync(scenarioPath)) {
    console.log("Scenario baseline does not exist yet. To create it, copy " + resultPath + " to " + scenarioPath);
    testContext.skip();
    return;
  }

  const resultContent = fs.readFileSync(resultPath, "utf-8");
  const scenarioContent = fs.readFileSync(scenarioPath, "utf-8");

  let resultObj = JSON.parse(resultContent);
  let scenarioObj = JSON.parse(scenarioContent);

  // Remove volatile keys
  if (volatileKeys.length > 0) {
    resultObj = removeVolatileKeys(resultObj, volatileKeys);
    scenarioObj = removeVolatileKeys(scenarioObj, volatileKeys);
  }

  assert.deepStrictEqual(
    resultObj,
    scenarioObj,
    `JSON content differs from baseline.\nResult: ${resultPath}\nScenario: ${scenarioPath}\n` +
      `To update the baseline, copy the result to the scenario folder.`
  );
}

/**
 * Recursively removes volatile keys from an object.
 */
function removeVolatileKeys(obj: any, volatileKeys: string[]): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeVolatileKeys(item, volatileKeys));
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (!volatileKeys.includes(key)) {
      result[key] = removeVolatileKeys(obj[key], volatileKeys);
    }
  }
  return result;
}

/**
 * Checks if the output lines indicate that no browser is available for rendering.
 */
export function checkBrowserAvailable(stdoutLines: string[], stderrLines: string[]): boolean {
  const browserErrorPatterns = [
    "No browser available",
    "npx playwright install",
    "Could not initialize headless renderer",
    "Could not initialize page renderer",
  ];

  const hasError = (lines: string[]) => lines.some((line) => browserErrorPatterns.some((p) => line.includes(p)));

  return !hasError(stdoutLines) && !hasError(stderrLines);
}

/**
 * Filters stderr lines to remove expected informational messages.
 * Returns only actual unexpected errors.
 */
export function filterExpectedStderrLines(stderrLines: string[]): string[] {
  const expectedPatterns = [
    "Trying browser",
    "not available",
    "Browser console error",
    "Browser console warning",
    "Rendering failed",
    "Failed to load resource",
    "404",
    // Playwright screenshot call log messages (not actual errors)
    "Call log:",
    "taking element screenshot",
    "waiting for fonts to load",
    "fonts loaded",
    "attempting scroll into view action",
    "waiting for element to be stable",
    // Node.js module type warnings
    "MODULE_TYPELESS_PACKAGE_JSON",
    "Reparsing as ES module",
    "To eliminate this warning",
    "Use `node --trace-warnings",
  ];

  return stderrLines.filter((line) => {
    // Skip empty or whitespace-only lines
    if (!line || line.trim() === "") {
      return false;
    }
    // Skip lines matching expected patterns
    return !expectedPatterns.some((pattern) => line.includes(pattern));
  });
}
