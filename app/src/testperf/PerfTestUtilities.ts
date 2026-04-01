/**
 * Performance test utilities for measuring editor loading phase timings.
 *
 * Provides helpers for:
 * - Uploading large projects via the hidden file input on the home page
 * - Polling data-* attributes on ProjectEditor to detect loading phase transitions
 * - Measuring time-to-interactive, relations completion, and validation completion
 * - Recording progress bar samples over time
 * - Structured logging and optional file output of results
 *
 * ## Key Selectors
 * - `[data-testid="project-editor"]` — root ProjectEditor element
 * - `data-loading-phase` — "inferring" | "relations" | "validating" | "ready"
 * - `data-item-count` — number of project items discovered so far
 * - `data-relations-complete` — "true" | "false"
 * - `data-validation-complete` — "true" | "false"
 * - `[data-testid="status-message"]` — status bar message text
 * - `[role="progressbar"]` — validation progress bar with aria-valuenow
 * - `[role="option"]` — individual items in the project item list
 */

import { Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

/** Timing results for a single performance test run. */
export interface PerfTimings {
  /** Milliseconds from upload start until [data-testid="project-editor"] appears */
  editorOpenMs: number;
  /** Milliseconds from upload start until item list has stable item count */
  uiResponsiveMs: number;
  /** Milliseconds from upload start until data-relations-complete="true" */
  relationsCompleteMs: number;
  /** Milliseconds from upload start until data-validation-complete="true" */
  validationCompleteMs: number;
  /** Total project items discovered */
  itemCount: number;
  /** Time-series of progress bar samples: [elapsedMs, percentComplete] */
  progressSamples: [number, number][];
  /** Time-series of item count samples: [elapsedMs, count] */
  itemCountSamples: [number, number][];
  /** Timestamp when the test started (epoch ms) */
  startTimestamp: number;
}

/** Selector for the project editor root element. */
const EDITOR_SELECTOR = '[data-testid="project-editor"]';

/** Selector for project items in the item list. */
const ITEM_SELECTOR = '[role="option"]';

/** Selector for progress bar. */
const PROGRESS_SELECTOR = '[role="progressbar"]';

/** Selector for status message. */
const STATUS_MESSAGE_SELECTOR = '[data-testid="status-message"]';

/**
 * Path to the vanilla release zip used for testing.
 * Resolved relative to the app/ folder.
 */
export function getVanillaZipPath(): string {
  // When running from app/, the public folder is at app/public/
  return path.resolve(__dirname, "../../public/res/latest/van/release/vanillarelease.zip");
}

/**
 * Upload a file to the app via the hidden file input on the home page.
 * This triggers the same code path as drag-and-drop or "Choose File(s)".
 */
export async function uploadFileViaInput(page: Page, filePath: string): Promise<void> {
  // The home page renders a hidden <input type="file" class="file-upload">
  const fileInput = page.locator('input[type="file"].file-upload').first();
  await fileInput.waitFor({ state: "attached", timeout: 10_000 });
  await fileInput.setInputFiles(filePath);
}

/**
 * Wait for the project editor to appear in the DOM.
 * Returns elapsed milliseconds from startTime.
 */
export async function waitForEditorOpen(page: Page, startTime: number, timeoutMs: number = 180_000): Promise<number> {
  await page.locator(EDITOR_SELECTOR).waitFor({ state: "visible", timeout: timeoutMs });
  return Date.now() - startTime;
}

/**
 * Wait for the project item list to stabilize (UI responsive).
 *
 * Strategy: poll item count every 500ms. When the count is > 0 and
 * remains the same for 2 consecutive checks, consider it stable.
 * This indicates the initial item inference is complete and the UI
 * is populated and interactive.
 *
 * Returns elapsed milliseconds from startTime.
 */
export async function waitForUiResponsive(
  page: Page,
  startTime: number,
  timeoutMs: number = 180_000,
  itemCountSamples?: [number, number][]
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;
  let stableChecks = 0;
  const STABLE_THRESHOLD = 2; // consecutive checks with same count
  const POLL_INTERVAL_MS = 500;

  while (Date.now() < deadline) {
    const count = await page.locator(ITEM_SELECTOR).count();
    const elapsed = Date.now() - startTime;

    if (itemCountSamples) {
      itemCountSamples.push([elapsed, count]);
    }

    if (count > 0 && count === lastCount) {
      stableChecks++;
      if (stableChecks >= STABLE_THRESHOLD) {
        return elapsed;
      }
    } else {
      stableChecks = 0;
    }

    lastCount = count;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }

  // Even if we timeout, return the elapsed time
  return Date.now() - startTime;
}

/**
 * Wait for relations processing to complete.
 * Polls data-relations-complete attribute on the project editor.
 * Returns elapsed milliseconds from startTime.
 */
export async function waitForRelationsComplete(
  page: Page,
  startTime: number,
  timeoutMs: number = 300_000
): Promise<number> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const editor = page.locator(EDITOR_SELECTOR);
    if ((await editor.count()) > 0) {
      const relationsComplete = await editor.getAttribute("data-relations-complete");
      if (relationsComplete === "true") {
        return Date.now() - startTime;
      }
    }

    await page.waitForTimeout(500);
  }

  return Date.now() - startTime;
}

/**
 * Wait for validation to complete.
 * Polls data-validation-complete attribute on the project editor.
 * Also collects progress bar samples during the wait.
 *
 * Returns elapsed milliseconds from startTime.
 */
export async function waitForValidationComplete(
  page: Page,
  startTime: number,
  progressSamples: [number, number][],
  timeoutMs: number = 600_000
): Promise<number> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const editor = page.locator(EDITOR_SELECTOR);
    const elapsed = Date.now() - startTime;

    if ((await editor.count()) > 0) {
      // Sample progress bar if visible
      const progressBar = page.locator(PROGRESS_SELECTOR);
      if ((await progressBar.count()) > 0) {
        const value = await progressBar.getAttribute("aria-valuenow");
        if (value !== null) {
          progressSamples.push([elapsed, parseFloat(value)]);
        }
      }

      const validationComplete = await editor.getAttribute("data-validation-complete");
      if (validationComplete === "true") {
        return elapsed;
      }
    }

    await page.waitForTimeout(1_000);
  }

  return Date.now() - startTime;
}

/**
 * Get the final item count from the project editor's data attribute.
 */
export async function getItemCount(page: Page): Promise<number> {
  const editor = page.locator(EDITOR_SELECTOR);

  if ((await editor.count()) > 0) {
    const count = await editor.getAttribute("data-item-count");
    return count ? parseInt(count, 10) : 0;
  }

  return 0;
}

/**
 * Get the current loading phase from the project editor.
 */
export async function getLoadingPhase(page: Page): Promise<string> {
  const editor = page.locator(EDITOR_SELECTOR);

  if ((await editor.count()) > 0) {
    return (await editor.getAttribute("data-loading-phase")) ?? "unknown";
  }

  return "unknown";
}

/**
 * Get the current status message text.
 */
export async function getStatusMessage(page: Page): Promise<string> {
  const statusMsg = page.locator(STATUS_MESSAGE_SELECTOR);

  if ((await statusMsg.count()) > 0) {
    return (await statusMsg.textContent()) ?? "";
  }

  return "";
}

/**
 * Run a full performance measurement cycle:
 * 1. Upload the zip file
 * 2. Wait for editor open → UI responsive → relations complete → validation complete
 * 3. Return all timings
 */
export async function measureFullLoadTimings(page: Page, zipPath: string): Promise<PerfTimings> {
  const progressSamples: [number, number][] = [];
  const itemCountSamples: [number, number][] = [];
  const startTimestamp = Date.now();

  // Upload the file — this triggers project creation
  await uploadFileViaInput(page, zipPath);

  // Phase 1: Wait for editor to appear
  const editorOpenMs = await waitForEditorOpen(page, startTimestamp);
  console.log(`  [PERF] Editor opened: ${editorOpenMs}ms`);

  // Phase 2: Wait for UI to be responsive (item list populated and stable)
  const uiResponsiveMs = await waitForUiResponsive(page, startTimestamp, 180_000, itemCountSamples);
  console.log(`  [PERF] UI responsive: ${uiResponsiveMs}ms (items stable)`);

  // Phase 3: Wait for relations to complete
  const relationsCompleteMs = await waitForRelationsComplete(page, startTimestamp);
  console.log(`  [PERF] Relations complete: ${relationsCompleteMs}ms`);

  // Phase 4: Wait for validation to complete
  const validationCompleteMs = await waitForValidationComplete(page, startTimestamp, progressSamples);
  console.log(`  [PERF] Validation complete: ${validationCompleteMs}ms`);

  // Final item count
  const itemCount = await getItemCount(page);
  console.log(`  [PERF] Total items: ${itemCount}`);

  return {
    editorOpenMs,
    uiResponsiveMs,
    relationsCompleteMs,
    validationCompleteMs,
    itemCount,
    progressSamples,
    itemCountSamples,
    startTimestamp,
  };
}

/**
 * Log performance timings in a human-readable, structured format.
 */
export function logTimings(label: string, timings: PerfTimings): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`PERFORMANCE RESULTS: ${label}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  Test started:          ${new Date(timings.startTimestamp).toISOString()}`);
  console.log(`  Total items:           ${timings.itemCount}`);
  console.log(`${"─".repeat(70)}`);
  console.log(`  Editor open:           ${formatMs(timings.editorOpenMs)}`);
  console.log(`  UI responsive:         ${formatMs(timings.uiResponsiveMs)}`);
  console.log(`  Relations complete:    ${formatMs(timings.relationsCompleteMs)}`);
  console.log(`  Validation complete:   ${formatMs(timings.validationCompleteMs)}`);
  console.log(`${"─".repeat(70)}`);

  if (timings.progressSamples.length > 0) {
    console.log(`  Validation progress samples (${timings.progressSamples.length} total):`);
    // Show a subset (every ~10th sample) to avoid flooding
    const step = Math.max(1, Math.floor(timings.progressSamples.length / 10));
    for (let i = 0; i < timings.progressSamples.length; i += step) {
      const [elapsed, pct] = timings.progressSamples[i];
      console.log(`    ${formatMs(elapsed)}: ${pct.toFixed(1)}%`);
    }
    // Always show the last sample
    if (timings.progressSamples.length > 1) {
      const last = timings.progressSamples[timings.progressSamples.length - 1];
      console.log(`    ${formatMs(last[0])}: ${last[1].toFixed(1)}% (final)`);
    }
  }

  if (timings.itemCountSamples.length > 0) {
    console.log(`  Item count growth (${timings.itemCountSamples.length} samples):`);
    const step = Math.max(1, Math.floor(timings.itemCountSamples.length / 8));
    for (let i = 0; i < timings.itemCountSamples.length; i += step) {
      const [elapsed, count] = timings.itemCountSamples[i];
      console.log(`    ${formatMs(elapsed)}: ${count} items`);
    }
  }

  console.log(`${"=".repeat(70)}\n`);
}

/**
 * Write performance timings to a JSON file for trend tracking.
 */
export function writeTimingsToFile(outputPath: string, label: string, timings: PerfTimings): void {
  const resultsDir = path.dirname(outputPath);

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Read existing results if file exists
  let allResults: any[] = [];
  if (fs.existsSync(outputPath)) {
    try {
      allResults = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    } catch {
      allResults = [];
    }
  }

  allResults.push({
    label,
    timestamp: new Date(timings.startTimestamp).toISOString(),
    editorOpenMs: timings.editorOpenMs,
    uiResponsiveMs: timings.uiResponsiveMs,
    relationsCompleteMs: timings.relationsCompleteMs,
    validationCompleteMs: timings.validationCompleteMs,
    itemCount: timings.itemCount,
    progressSampleCount: timings.progressSamples.length,
    itemCountSampleCount: timings.itemCountSamples.length,
  });

  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`  [PERF] Results written to: ${outputPath}`);
}

/**
 * Format milliseconds into a human-readable string.
 */
function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60_000);
    const seconds = ((ms % 60_000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}
