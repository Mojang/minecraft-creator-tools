// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VanillaModelSnapshotTests - Comprehensive tests for all vanilla block and mob renders.
 *
 * These tests render all vanilla blocks and mobs using the `mct rendervanilla` CLI command
 * (batch mode) and compare the results against baseline snapshots stored in debugoutput/res/snapshots/.
 *
 * The batch rendering is MUCH faster (~1-2s/item vs ~10s/item) because it:
 * - Starts the server once
 * - Keeps the browser open between renders
 * - Only navigates between pages instead of restarting everything
 *
 * Each block and mob gets its own individual test case for clear reporting.
 *
 * These tests are NOT run at check-in time because they:
 * - Take a significant amount of time to run (several minutes)
 * - Require a browser to be available (Chrome, Edge, or Playwright Chromium)
 * - Are primarily for verifying rendering consistency during development
 *
 * To run these tests:
 *   npm run test-extra                           # Run all optional tests
 *   npm run test-extra -- --grep "Block"         # Run only block tests
 *   npm run test-extra -- --grep "Mob"           # Run only mob tests
 *   npm run test-extra -- --grep "oak_stairs"    # Run a specific block test
 *   npm run test-extra -- --grep "pig"           # Run a specific mob test
 *
 * To update snapshots (regenerate baselines from current renders):
 *   npm run test-extra-update                    # Update all snapshots
 *   npm run test-extra-update -- --grep "Block"  # Update only block snapshots
 *   npm run test-extra-update -- --grep "Mob"    # Update only mob snapshots
 *
 * Prerequisites:
 *   - Build the CLI tool first: npm run jsncorebuild
 *   - Ensure a browser is available (Chrome/Edge or run: npx playwright install chromium)
 */

import { assert } from "chai";
import { spawn } from "child_process";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";
import { chunksToLinesAsync } from "@rauschma/stringio";

// Import test utilities
import { getSnapshotBlockNames, getSnapshotMobNames, SNAPSHOTS_DIR } from "../test-extra/TestExtraUtilities";

/** Check if we're in update mode (regenerate snapshots instead of comparing) */
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === "true";

/** Threshold for pixel color difference (0-255 per channel) */
const PIXEL_THRESHOLD = 15;

/** Maximum percentage of pixels allowed to differ */
const MAX_DIFF_PERCENT = 5;

/** Output directory for test results */
const RESULTS_DIR = path.join(__dirname, "../../test/results/vanilla-snapshots");

/** Path to the CLI tool */
const CLI_PATH = path.join(__dirname, "../../toolbuild/jsn/cli/index.mjs");

/** Track render results from batch rendering */
const blockRenderResults: Map<string, { success: boolean; error?: string }> = new Map();
const mobRenderResults: Map<string, { success: boolean; error?: string }> = new Map();

/** Track if browser is available */
let browserAvailable = true;

/** Track if batch rendering has been done */
let blocksRendered = false;
let mobsRendered = false;

/**
 * Ensure results directory exists
 */
function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Collect output lines from a readable stream
 */
async function collectLines(readable: Readable, data: string[], printProgress: boolean = false) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      let lineUp = line.replace(/\\n/g, "").replace(/\\r/g, "");
      if (lineUp.indexOf("ebugger") <= 0) {
        data.push(lineUp);
        // Print progress lines in real-time
        if (printProgress && lineUp.trim().length > 0) {
          // Filter to only show rendering progress lines
          if (lineUp.includes("Rendering") || lineUp.includes("Batch") || lineUp.includes("elapsed")) {
            console.log(`      ${lineUp.trim()}`);
          }
        }
      }
    }
  }
}

/** Chunk size for batch rendering - smaller chunks give more frequent progress updates */
const BATCH_CHUNK_SIZE = 25;

/**
 * Render a single chunk of blocks using the CLI batch command.
 */
async function renderBlockChunk(
  blockNames: string[],
  chunkIndex: number,
  totalChunks: number
): Promise<{ success: boolean; browserNotAvailable?: boolean; error?: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // Create a temp file with the block names
  const tempFile = path.join(RESULTS_DIR, `_blocks_chunk${chunkIndex}.txt`);
  fs.writeFileSync(tempFile, blockNames.join("\n"));

  console.log(`      Chunk ${chunkIndex + 1}/${totalChunks}: Rendering ${blockNames.length} blocks...`);

  const proc = spawn("node", [CLI_PATH, "rendervanilla", "block", `@${tempFile}`, RESULTS_DIR]);

  // Stream output in real-time to show progress - capture promises
  const stdoutPromise = collectLines(proc.stdout, stdoutLines, true);
  const stderrPromise = collectLines(proc.stderr, stderrLines, false);

  // Wait for process to exit
  const code = await new Promise<number | null>((resolve, reject) => {
    proc.on("exit", (code) => resolve(code));
    proc.on("error", (err) => reject(err));
  }).catch((err) => {
    return { error: `Process error: ${err.message}` } as any;
  });

  // Wait for streams to fully drain
  await Promise.all([stdoutPromise, stderrPromise]);

  // Clean up temp file
  try {
    fs.unlinkSync(tempFile);
  } catch {}

  // Handle process error
  if (typeof code === "object" && code?.error) {
    return { success: false, error: code.error };
  }

  const allOutput = [...stdoutLines, ...stderrLines].join("\n");

  // Check if the failure was due to no browser being available
  const noBrowser =
    allOutput.includes("No browser available") ||
    allOutput.includes("npx playwright install") ||
    allOutput.includes("Could not initialize headless renderer");

  if (noBrowser) {
    return { success: false, browserNotAvailable: true, error: "No browser available" };
  }

  // Mark each block as rendered or failed based on file existence
  for (const blockName of blockNames) {
    const snapshotFileName = blockName.replace(/_/g, "-");
    const resultPath = path.join(RESULTS_DIR, `block-${snapshotFileName}.png`);
    if (fs.existsSync(resultPath)) {
      blockRenderResults.set(blockName, { success: true });
    } else {
      blockRenderResults.set(blockName, { success: false, error: "Render file not created" });
    }
  }

  if (code !== 0) {
    console.log(`      Chunk ${chunkIndex + 1} finished with code ${code}`);
  }

  return { success: true };
}

/**
 * Render all blocks in chunks using the CLI batch command.
 * Breaks into smaller batches for more frequent progress updates.
 */
async function renderAllBlocksViaBatch(
  blockNames: string[]
): Promise<{ success: boolean; browserNotAvailable?: boolean; error?: string }> {
  // Split into chunks
  const chunks: string[][] = [];
  for (let i = 0; i < blockNames.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(blockNames.slice(i, i + BATCH_CHUNK_SIZE));
  }

  console.log(`      Rendering ${blockNames.length} blocks in ${chunks.length} chunks of up to ${BATCH_CHUNK_SIZE}...`);

  for (let i = 0; i < chunks.length; i++) {
    const result = await renderBlockChunk(chunks[i], i, chunks.length);
    if (result.browserNotAvailable) {
      return result;
    }
    if (!result.success) {
      console.log(`      Warning: Chunk ${i + 1} had issues: ${result.error}`);
    }
  }

  return { success: true };
}

/**
 * Render a single chunk of mobs using the CLI batch command.
 */
async function renderMobChunk(
  mobNames: string[],
  chunkIndex: number,
  totalChunks: number
): Promise<{ success: boolean; browserNotAvailable?: boolean; error?: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // Create a temp file with the mob names
  const tempFile = path.join(RESULTS_DIR, `_mobs_chunk${chunkIndex}.txt`);
  fs.writeFileSync(tempFile, mobNames.join("\n"));

  console.log(`      Chunk ${chunkIndex + 1}/${totalChunks}: Rendering ${mobNames.length} mobs...`);

  const proc = spawn("node", [CLI_PATH, "rendervanilla", "mob", `@${tempFile}`, RESULTS_DIR]);

  // Stream output in real-time to show progress - capture promises
  const stdoutPromise = collectLines(proc.stdout, stdoutLines, true);
  const stderrPromise = collectLines(proc.stderr, stderrLines, false);

  // Wait for process to exit
  const code = await new Promise<number | null>((resolve, reject) => {
    proc.on("exit", (code) => resolve(code));
    proc.on("error", (err) => reject(err));
  }).catch((err) => {
    return { error: `Process error: ${err.message}` } as any;
  });

  // Wait for streams to fully drain
  await Promise.all([stdoutPromise, stderrPromise]);

  // Clean up temp file
  try {
    fs.unlinkSync(tempFile);
  } catch {}

  // Handle process error
  if (typeof code === "object" && code?.error) {
    return { success: false, error: code.error };
  }

  const allOutput = [...stdoutLines, ...stderrLines].join("\n");

  // Check if the failure was due to no browser being available
  const noBrowser =
    allOutput.includes("No browser available") ||
    allOutput.includes("npx playwright install") ||
    allOutput.includes("Could not initialize headless renderer");

  if (noBrowser) {
    return { success: false, browserNotAvailable: true, error: "No browser available" };
  }

  // Mark each mob as rendered or failed based on file existence
  for (const mobName of mobNames) {
    const snapshotFileName = mobName.replace(/_/g, "-");
    const resultPath = path.join(RESULTS_DIR, `mob-${snapshotFileName}.png`);
    if (fs.existsSync(resultPath)) {
      mobRenderResults.set(mobName, { success: true });
    } else {
      mobRenderResults.set(mobName, { success: false, error: "Render file not created" });
    }
  }

  if (code !== 0) {
    console.log(`      Chunk ${chunkIndex + 1} finished with code ${code}`);
  }

  return { success: true };
}

/**
 * Render all mobs in chunks using the CLI batch command.
 * Breaks into smaller batches for more frequent progress updates.
 */
async function renderAllMobsViaBatch(
  mobNames: string[]
): Promise<{ success: boolean; browserNotAvailable?: boolean; error?: string }> {
  // Split into chunks
  const chunks: string[][] = [];
  for (let i = 0; i < mobNames.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(mobNames.slice(i, i + BATCH_CHUNK_SIZE));
  }

  console.log(`      Rendering ${mobNames.length} mobs in ${chunks.length} chunks of up to ${BATCH_CHUNK_SIZE}...`);

  for (let i = 0; i < chunks.length; i++) {
    const result = await renderMobChunk(chunks[i], i, chunks.length);
    if (result.browserNotAvailable) {
      return result;
    }
    if (!result.success) {
      console.log(`      Warning: Chunk ${i + 1} had issues: ${result.error}`);
    }
  }

  return { success: true };
}

/**
 * Compare a rendered image against the snapshot baseline.
 */
function compareWithSnapshot(
  resultPath: string,
  snapshotPath: string
): { matches: boolean; diffPercent: number; diffPixels: number; error?: string } {
  if (!fs.existsSync(snapshotPath)) {
    return { matches: false, diffPercent: 100, diffPixels: -1, error: "Snapshot file not found" };
  }

  if (!fs.existsSync(resultPath)) {
    return { matches: false, diffPercent: 100, diffPixels: -1, error: "Result file not found" };
  }

  const resultBuffer = fs.readFileSync(resultPath);
  const snapshotBuffer = fs.readFileSync(snapshotPath);

  const resultPng = PNG.sync.read(resultBuffer);
  const snapshotPng = PNG.sync.read(snapshotBuffer);

  // Check dimensions match
  if (resultPng.width !== snapshotPng.width || resultPng.height !== snapshotPng.height) {
    return {
      matches: false,
      diffPercent: 100,
      diffPixels: -1,
      error: `Dimension mismatch: result=${resultPng.width}x${resultPng.height}, snapshot=${snapshotPng.width}x${snapshotPng.height}`,
    };
  }

  const totalPixels = resultPng.width * resultPng.height;
  let diffPixels = 0;

  for (let i = 0; i < resultPng.data.length; i += 4) {
    const rDiff = Math.abs(resultPng.data[i] - snapshotPng.data[i]);
    const gDiff = Math.abs(resultPng.data[i + 1] - snapshotPng.data[i + 1]);
    const bDiff = Math.abs(resultPng.data[i + 2] - snapshotPng.data[i + 2]);
    const aDiff = Math.abs(resultPng.data[i + 3] - snapshotPng.data[i + 3]);

    if (rDiff > PIXEL_THRESHOLD || gDiff > PIXEL_THRESHOLD || bDiff > PIXEL_THRESHOLD || aDiff > PIXEL_THRESHOLD) {
      diffPixels++;
    }
  }

  const diffPercent = (diffPixels / totalPixels) * 100;
  const matches = diffPercent < MAX_DIFF_PERCENT;

  return { matches, diffPercent, diffPixels };
}

/**
 * Convert a block/mob identifier (with underscores) to a snapshot filename format (with hyphens).
 */
function toSnapshotName(identifier: string): string {
  return identifier.replace(/_/g, "-");
}

// Get snapshot names at module load time for dynamic test generation
const blockNames = getSnapshotBlockNames();
const mobNames = getSnapshotMobNames();

// ============================================================================
// Block Snapshot Tests - Individual test per block
// ============================================================================

describe("Vanilla Block Snapshot Tests", function () {
  // Long timeout for the entire suite since batch rendering happens in before()
  // At ~2s/block for ~1200 blocks, this can take 40+ minutes
  this.timeout(7200000); // 2 hours for entire suite

  before(async function () {
    ensureResultsDir();
    if (UPDATE_SNAPSHOTS) {
      console.log(`\n  UPDATE MODE: Will regenerate ${blockNames.length} block snapshots\n`);
    } else {
      console.log(`\n  Found ${blockNames.length} block snapshots to test\n`);
    }

    if (blockNames.length === 0) {
      console.log("  Warning: No block snapshots found in", SNAPSHOTS_DIR);
      return;
    }

    // Verify CLI tool exists
    if (!fs.existsSync(CLI_PATH + "/index.js")) {
      console.log("  Warning: CLI tool not found. Run 'npm run jsncorebuild' first.");
      console.log("  Expected path:", CLI_PATH);
      return;
    }

    // Render all blocks in one batch (MUCH faster)
    const startTime = Date.now();
    const result = await renderAllBlocksViaBatch(blockNames);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.browserNotAvailable) {
      browserAvailable = false;
      console.log("  Browser not available - tests will be skipped");
    } else {
      console.log(`      Batch rendering complete in ${elapsed}s`);
    }

    blocksRendered = true;
  });

  // Generate individual test for each block
  for (const blockName of blockNames) {
    it(`should render block: ${blockName}`, async function () {
      this.timeout(5000); // Individual tests should be fast (just comparison)

      if (!browserAvailable) {
        this.skip();
        return;
      }

      if (!blocksRendered) {
        this.skip();
        return;
      }

      const snapshotFileName = toSnapshotName(blockName);
      const snapshotPath = path.join(SNAPSHOTS_DIR, `block-${snapshotFileName}.png`);
      const resultPath = path.join(RESULTS_DIR, `block-${snapshotFileName}.png`);

      // Check if render succeeded
      const renderResult = blockRenderResults.get(blockName);
      if (!renderResult?.success) {
        assert.fail(`Failed to render block ${blockName}: ${renderResult?.error || "Unknown error"}`);
      }

      if (UPDATE_SNAPSHOTS) {
        // Update mode: copy rendered result to snapshot location
        fs.copyFileSync(resultPath, snapshotPath);
        console.log(`      Updated snapshot: block-${snapshotFileName}.png`);
        return;
      }

      // Compare with snapshot
      const comparison = compareWithSnapshot(resultPath, snapshotPath);

      if (comparison.error) {
        assert.fail(`Comparison error for ${blockName}: ${comparison.error}`);
      }

      assert(
        comparison.matches,
        `Block ${blockName} differs from snapshot by ${comparison.diffPercent.toFixed(2)}% ` +
          `(${comparison.diffPixels} pixels exceed threshold)`
      );
    });
  }
});

// ============================================================================
// Mob Snapshot Tests - Individual test per mob
// ============================================================================

describe("Vanilla Mob Snapshot Tests", function () {
  // Long timeout for the entire suite since batch rendering happens in before()
  // At ~2.5s/mob for ~100 mobs, this can take 5+ minutes
  this.timeout(7200000); // 2 hours for entire suite

  before(async function () {
    ensureResultsDir();
    if (UPDATE_SNAPSHOTS) {
      console.log(`\n  UPDATE MODE: Will regenerate ${mobNames.length} mob snapshots\n`);
    } else {
      console.log(`\n  Found ${mobNames.length} mob snapshots to test\n`);
    }

    if (mobNames.length === 0) {
      console.log("  Warning: No mob snapshots found in", SNAPSHOTS_DIR);
      return;
    }

    // Render all mobs in one batch (MUCH faster)
    const startTime = Date.now();
    const result = await renderAllMobsViaBatch(mobNames);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.browserNotAvailable) {
      browserAvailable = false;
      console.log("  Browser not available - tests will be skipped");
    } else {
      console.log(`      Batch rendering complete in ${elapsed}s`);
    }

    mobsRendered = true;
  });

  // Generate individual test for each mob
  for (const mobName of mobNames) {
    it(`should render mob: ${mobName}`, async function () {
      this.timeout(5000); // Individual tests should be fast (just comparison)

      if (!browserAvailable) {
        this.skip();
        return;
      }

      if (!mobsRendered) {
        this.skip();
        return;
      }

      const snapshotFileName = toSnapshotName(mobName);
      const snapshotPath = path.join(SNAPSHOTS_DIR, `mob-${snapshotFileName}.png`);
      const resultPath = path.join(RESULTS_DIR, `mob-${snapshotFileName}.png`);

      // Check if render succeeded
      const renderResult = mobRenderResults.get(mobName);
      if (!renderResult?.success) {
        assert.fail(`Failed to render mob ${mobName}: ${renderResult?.error || "Unknown error"}`);
      }

      if (UPDATE_SNAPSHOTS) {
        // Update mode: copy rendered result to snapshot location
        fs.copyFileSync(resultPath, snapshotPath);
        console.log(`      Updated snapshot: mob-${snapshotFileName}.png`);
        return;
      }

      // Compare with snapshot
      const comparison = compareWithSnapshot(resultPath, snapshotPath);

      if (comparison.error) {
        assert.fail(`Comparison error for ${mobName}: ${comparison.error}`);
      }

      assert(
        comparison.matches,
        `Mob ${mobName} differs from snapshot by ${comparison.diffPercent.toFixed(2)}% ` +
          `(${comparison.diffPixels} pixels exceed threshold)`
      );
    });
  }
});
