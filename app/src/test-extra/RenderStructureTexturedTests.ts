// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Render Structure Tests with Vanilla Textures
 *
 * These tests are duplicates of the render structure tests in src/test/RenderCommandTests.ts,
 * but they run WITHOUT the --isolated flag, meaning they:
 * - Connect to mctools.dev to fetch vanilla textures
 * - Render structures with proper block textures (TNT, pistons, etc.)
 * - Serve as a regression test for vanilla texture loading via HttpStorage
 *
 * NOTE: These tests are in test-extra/ because they:
 * - Require network access to mctools.dev
 * - May take longer to run due to texture downloading
 * - Are supplementary to the isolated (offline) tests
 *
 * To run these tests:
 *   npm run test-extra -- --grep "Textured"
 */

import { assert } from "chai";
import * as path from "path";
import { spawn } from "child_process";
import { chunksToLinesAsync } from "@rauschma/stringio";
import { Readable } from "stream";
import {
  testFolders,
  assertValidPng,
  assertPngMatchesBaseline,
  checkBrowserAvailable,
  filterExpectedStderrLines,
} from "../test/PngTestUtilities";

// Initialize test folders
before(async function () {
  await testFolders.initialize();
});

function removeResultFolder(scenarioName: string) {
  testFolders.removeResultFolder(scenarioName);
}

function ensureResultFolder(scenarioName: string) {
  testFolders.ensureResultFolder(scenarioName);
}

async function collectLines(readable: Readable, data: string[]) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      let lineUp = line.replace(/\\n/g, "");
      lineUp = lineUp.replace(/\\r/g, "");

      if (lineUp.indexOf("ebugger") <= 0) {
        // ignore any lines about the debugger.
        data.push(lineUp);
      }
    }
  }
}

/**
 * Tests for renderstructure command with cannon structure - WITH vanilla textures.
 * This test does NOT use --isolated, so it connects to mctools.dev for textures.
 */
describe("renderStructureCommandCannonTextured", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(async function () {
    this.timeout(180000); // Longer timeout for network texture fetching

    removeResultFolder("renderStructureCommandCannonTextured");
    ensureResultFolder("renderStructureCommandCannonTextured");

    // Note: NO --isolated flag - this will fetch textures from mctools.dev
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "cannon.mcstructure",
      "./test/results/renderStructureCommandCannonTextured/cannon.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
    ]);

    // Collect stdout/stderr lines - these promises resolve when streams end
    const stdoutPromise = collectLines(process.stdout, stdoutLines);
    const stderrPromise = collectLines(process.stderr, stderrLines);

    // Wait for process to exit
    exitCode = await new Promise<number | null>((resolve) => {
      process.on("exit", (code) => resolve(code));
    });

    // Wait for streams to fully drain
    await Promise.all([stdoutPromise, stderrPromise]);

    browserAvailable = checkBrowserAvailable(stdoutLines, stderrLines);
  });

  it("should find the structure file", async function () {
    const foundStructure = stdoutLines.some((line) => line.includes("Found structure:"));
    assert(foundStructure, "Should find the structure file. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should start rendering", async function () {
    // Check that rendering started (the verbose "Server started at" messages no longer appear in normal mode)
    const renderingStarted = stdoutLines.some(
      (line) => line.includes("Rendering") || line.includes("Rendered image saved to:")
    );
    assert(renderingStarted, "Rendering should start. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should save rendered image", async function () {
    const imageSaved = stdoutLines.some((line) => line.includes("Rendered image saved to:"));
    assert(
      imageSaved,
      "Should save rendered image. Output: " + stdoutLines.join("\n") + "\n\nStderr: " + stderrLines.join("\n")
    );
  }).timeout(10000);

  it("should have no unexpected stderr lines", async function () {
    const actualErrors = filterExpectedStderrLines(stderrLines);
    assert.equal(actualErrors.length, 0, "Error: |" + actualErrors.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async function () {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should create output PNG file if browser available", async function () {
    if (!browserAvailable) {
      console.log("Skipping PNG validation - no browser available for rendering");
      this.skip();
    }

    const outputPath = path.resolve("test/results/renderStructureCommandCannonTextured/cannon.png");
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline (with textures)", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = path.resolve("test/results/renderStructureCommandCannonTextured/cannon.png");
    const scenarioPath = path.resolve("test/scenarios/renderStructureCommandCannonTextured/cannon.png");

    // Higher tolerance for textured rendering due to texture compression variations
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 25);
  }).timeout(10000);
});

/**
 * Tests for renderstructure command with piston double extender - WITH vanilla textures.
 * This test does NOT use --isolated, so it connects to mctools.dev for textures.
 */
describe("renderStructureCommandDoubleExtenderTextured", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(async function () {
    this.timeout(180000); // Longer timeout for network texture fetching

    removeResultFolder("renderStructureCommandDoubleExtenderTextured");
    ensureResultFolder("renderStructureCommandDoubleExtenderTextured");

    // Note: NO --isolated flag - this will fetch textures from mctools.dev
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "double_extender.mcstructure",
      "./test/results/renderStructureCommandDoubleExtenderTextured/double_extender.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
    ]);

    // Collect stdout/stderr lines - these promises resolve when streams end
    const stdoutPromise = collectLines(process.stdout, stdoutLines);
    const stderrPromise = collectLines(process.stderr, stderrLines);

    // Wait for process to exit
    exitCode = await new Promise<number | null>((resolve) => {
      process.on("exit", (code) => resolve(code));
    });

    // Wait for streams to fully drain
    await Promise.all([stdoutPromise, stderrPromise]);

    browserAvailable = checkBrowserAvailable(stdoutLines, stderrLines);
  });

  it("should find the structure file", async function () {
    const foundStructure = stdoutLines.some((line) => line.includes("Found structure:"));
    assert(foundStructure, "Should find the structure file. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should start rendering", async function () {
    // Check that rendering started (the verbose "Server started at" messages no longer appear in normal mode)
    const renderingStarted = stdoutLines.some(
      (line) => line.includes("Rendering") || line.includes("Rendered image saved to:")
    );
    assert(renderingStarted, "Rendering should start. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("exit code should be zero", async function () {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should create output PNG file if browser available", async function () {
    if (!browserAvailable) {
      console.log("Skipping PNG validation - no browser available for rendering");
      this.skip();
      return;
    }

    const outputPath = path.resolve("test/results/renderStructureCommandDoubleExtenderTextured/double_extender.png");
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline (with textures)", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = path.resolve("test/results/renderStructureCommandDoubleExtenderTextured/double_extender.png");
    const scenarioPath = path.resolve(
      "test/scenarios/renderStructureCommandDoubleExtenderTextured/double_extender.png"
    );

    // Higher tolerance for textured rendering due to texture compression and piston rendering variations
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 25);
  }).timeout(10000);
});

/**
 * Tests for renderstructure command with redstone repeater clock - WITH vanilla textures.
 * This test does NOT use --isolated, so it connects to mctools.dev for textures.
 */
describe("renderStructureCommandRepeaterClockTextured", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(async function () {
    this.timeout(180000); // Longer timeout for network texture fetching

    removeResultFolder("renderStructureCommandRepeaterClockTextured");
    ensureResultFolder("renderStructureCommandRepeaterClockTextured");

    // Note: NO --isolated flag - this will fetch textures from mctools.dev
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "repeater_clock.mcstructure",
      "./test/results/renderStructureCommandRepeaterClockTextured/repeater_clock.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
    ]);

    // Collect stdout/stderr lines - these promises resolve when streams end
    const stdoutPromise = collectLines(process.stdout, stdoutLines);
    const stderrPromise = collectLines(process.stderr, stderrLines);

    // Wait for process to exit
    exitCode = await new Promise<number | null>((resolve) => {
      process.on("exit", (code) => resolve(code));
    });

    // Wait for streams to fully drain
    await Promise.all([stdoutPromise, stderrPromise]);

    browserAvailable = checkBrowserAvailable(stdoutLines, stderrLines);
  });

  it("should find the structure file", async function () {
    const foundStructure = stdoutLines.some((line) => line.includes("Found structure:"));
    assert(foundStructure, "Should find the structure file. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should start rendering", async function () {
    // Check that rendering started (the verbose "Server started at" messages no longer appear in normal mode)
    const renderingStarted = stdoutLines.some(
      (line) => line.includes("Rendering") || line.includes("Rendered image saved to:")
    );
    assert(renderingStarted, "Rendering should start. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("exit code should be zero", async function () {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should create output PNG file if browser available", async function () {
    if (!browserAvailable) {
      console.log("Skipping PNG validation - no browser available for rendering");
      this.skip();
      return;
    }

    const outputPath = path.resolve("test/results/renderStructureCommandRepeaterClockTextured/repeater_clock.png");
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline (with textures)", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = path.resolve("test/results/renderStructureCommandRepeaterClockTextured/repeater_clock.png");
    const scenarioPath = path.resolve("test/scenarios/renderStructureCommandRepeaterClockTextured/repeater_clock.png");

    // Higher tolerance for textured rendering due to texture compression and redstone rendering variations
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 25);
  }).timeout(10000);
});
