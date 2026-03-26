// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Render Model Tests (Biceson and Sheepomelon)
 *
 * These tests were moved from src/test/RenderCommandTests.ts to test-extra because:
 *
 * 1. BROWSER INITIALIZATION TIMING: The first render test must initialize Playwright
 *    and potentially download browser engines, which can take 2-5+ minutes on cold CI
 *    runners. This caused the first model test to timeout while subsequent tests passed
 *    (benefiting from the already-initialized browser).
 *
 * 2. CROSS-PLATFORM RENDERING DIFFERENCES: Entity geometry models with noise textures
 *    can produce slightly different results across platforms, making visual comparison
 *    tests flaky.
 *
 * The structure render tests (cannon, double_extender, repeater_clock) remain in the
 * main test suite because they run first and have a 5-minute timeout to handle browser
 * initialization.
 *
 * To run these tests:
 *   npm run test-extra -- --grep "renderModelCommand"
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

describe("renderModelCommandBiceson", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(function (done) {
    // First render test needs longer timeout for browser initialization on CI
    // This includes potential browser download time if Playwright browsers aren't installed
    this.timeout(300000); // 5 minutes

    removeResultFolder("renderModelCommandBiceson");
    ensureResultFolder("renderModelCommandBiceson");

    // Test rendermodel command with the biceson geometry from addon_starter samples
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "rendermodel",
      "biceson.geo.json",
      "./test/results/renderModelCommandBiceson/biceson.png",
      "-i",
      "./public/res/samples/microsoft/samples/addon_starter/complete/",
      "--isolated",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      browserAvailable = checkBrowserAvailable(stdoutLines, stderrLines);
      done();
    });
  });

  it("should start rendering", async function () {
    const renderingStarted = stdoutLines.some(
      (line) => line.includes("Rendering") || line.includes("Rendered image saved to:")
    );
    assert(renderingStarted, "Rendering should start. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should save rendered image", async function () {
    const imageSaved = stdoutLines.some((line) => line.includes("Rendered image saved to:"));
    assert(imageSaved, "Should save rendered image. Output: " + stdoutLines.join("\n"));
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
      this.skip();
      return;
    }
    const outputPath = path.resolve("test/results/renderModelCommandBiceson/biceson.png");
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = path.resolve("test/results/renderModelCommandBiceson/biceson.png");
    const scenarioPath = path.resolve("test/scenarios/renderModelCommandBiceson/biceson.png");

    // Higher tolerance for model rendering due to noise textures and cross-platform differences
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 35);
  }).timeout(10000);
});

describe("renderModelCommandSheepomelon", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(function (done) {
    this.timeout(120000);

    removeResultFolder("renderModelCommandSheepomelon");
    ensureResultFolder("renderModelCommandSheepomelon");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "rendermodel",
      "sheepomelon.geo.json",
      "./test/results/renderModelCommandSheepomelon/sheepomelon.png",
      "-i",
      "./public/res/samples/microsoft/samples/addon_starter/complete/",
      "--isolated",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      browserAvailable = checkBrowserAvailable(stdoutLines, stderrLines);
      done();
    });
  });

  it("should start rendering", async function () {
    const renderingStarted = stdoutLines.some(
      (line) => line.includes("Rendering") || line.includes("Rendered image saved to:")
    );
    assert(renderingStarted, "Rendering should start. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should save rendered image", async function () {
    const imageSaved = stdoutLines.some((line) => line.includes("Rendered image saved to:"));
    assert(imageSaved, "Should save rendered image. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("exit code should be zero", async function () {
    assert.equal(exitCode, 0, "Exit code should be zero");
  }).timeout(10000);

  it("should create output PNG file if browser available", async function () {
    if (!browserAvailable) {
      console.log("Skipping PNG validation - no browser available for rendering");
      this.skip();
    }

    const outputPath = path.resolve("test/results/renderModelCommandSheepomelon/sheepomelon.png");
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = path.resolve("test/results/renderModelCommandSheepomelon/sheepomelon.png");
    const scenarioPath = path.resolve("test/scenarios/renderModelCommandSheepomelon/sheepomelon.png");

    // Higher tolerance for model rendering due to noise textures and cross-platform differences
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 35);
  }).timeout(10000);
});
