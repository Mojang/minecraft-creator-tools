/**
 * Render Command Tests (Isolated Mode)
 *
 * These tests use the --isolated flag, which means:
 * - No network access to mctools.dev for vanilla textures
 * - Blocks render with fuchsia "missing texture" placeholder
 * - Tests are faster and work offline
 *
 * For tests WITH vanilla textures loaded from mctools.dev, see:
 * - src/test-extra/RenderStructureTexturedTests.ts (run with `npm run test-extra -- --grep Textured`)
 *
 * The isolated mode baselines show geometry/structure correctly but without block textures.
 * The textured tests verify that vanilla texture loading works via HttpStorage proxy.
 *
 * BROWSER INITIALIZATION NOTE:
 * The first render test (renderStructureCommandCannon) has a 5-minute timeout to handle
 * browser initialization on cold CI runners. Subsequent tests benefit from the already-
 * initialized browser and use shorter timeouts.
 *
 * Model rendering tests (biceson, sheepomelon) have been moved to test-extra because:
 * - They were running after structure tests and still experiencing timing issues
 * - Entity models with noise textures can vary across platforms
 * See: src/test-extra/RenderModelTests.ts
 */

import { assert } from "chai";
import { spawn } from "child_process";
import { chunksToLinesAsync } from "@rauschma/stringio";
import { Readable } from "stream";
import {
  testFolders,
  assertValidPng,
  assertPngMatchesBaseline,
  checkBrowserAvailable,
  filterExpectedStderrLines,
} from "./PngTestUtilities";

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

describe("renderStructureCommandCannon", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(function (done) {
    // First render test needs longer timeout for browser initialization on CI
    // This includes potential browser download time if Playwright browsers aren't installed
    this.timeout(300000); // 5 minutes

    removeResultFolder("renderStructureCommandCannon");
    ensureResultFolder("renderStructureCommandCannon");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "cannon.mcstructure",
      "./test/results/renderStructureCommandCannon/cannon.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
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

    const outputPath = __dirname + "/../../test/results/renderStructureCommandCannon/cannon.png";
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = __dirname + "/../../test/results/renderStructureCommandCannon/cannon.png";
    const scenarioPath = __dirname + "/../../test/scenarios/renderStructureCommandCannon/cannon.png";

    assertPngMatchesBaseline(this, resultPath, scenarioPath);
  }).timeout(10000);
});

/**
 * Tests for renderstructure command with piston double extender structure.
 * This structure has more visual variety: pistons, slime blocks, redstone components.
 */
describe("renderStructureCommandDoubleExtender", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(function (done) {
    this.timeout(120000);

    removeResultFolder("renderStructureCommandDoubleExtender");
    ensureResultFolder("renderStructureCommandDoubleExtender");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "double_extender.mcstructure",
      "./test/results/renderStructureCommandDoubleExtender/double_extender.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
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

    const outputPath = __dirname + "/../../test/results/renderStructureCommandDoubleExtender/double_extender.png";
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = __dirname + "/../../test/results/renderStructureCommandDoubleExtender/double_extender.png";
    const scenarioPath = __dirname + "/../../test/scenarios/renderStructureCommandDoubleExtender/double_extender.png";

    // Use higher tolerance (10%) for this structure as redstone/piston rendering can vary slightly across platforms
    assertPngMatchesBaseline(this, resultPath, scenarioPath, 10, 10);
  }).timeout(10000);
});

/**
 * Tests for renderstructure command with redstone repeater clock structure.
 * This structure has redstone dust, repeaters, and other redstone components.
 */
describe("renderStructureCommandRepeaterClock", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let browserAvailable = true;

  before(function (done) {
    this.timeout(120000);

    removeResultFolder("renderStructureCommandRepeaterClock");
    ensureResultFolder("renderStructureCommandRepeaterClock");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "renderstructure",
      "repeater_clock.mcstructure",
      "./test/results/renderStructureCommandRepeaterClock/repeater_clock.png",
      "-i",
      "./../samplecontent/vanilla_gametest",
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

    const outputPath = __dirname + "/../../test/results/renderStructureCommandRepeaterClock/repeater_clock.png";
    assertValidPng(outputPath);
  }).timeout(10000);

  it("output PNG should match scenario baseline", async function () {
    if (!browserAvailable) {
      this.skip();
      return;
    }

    const resultPath = __dirname + "/../../test/results/renderStructureCommandRepeaterClock/repeater_clock.png";
    const scenarioPath = __dirname + "/../../test/scenarios/renderStructureCommandRepeaterClock/repeater_clock.png";

    assertPngMatchesBaseline(this, resultPath, scenarioPath);
  }).timeout(10000);
});
