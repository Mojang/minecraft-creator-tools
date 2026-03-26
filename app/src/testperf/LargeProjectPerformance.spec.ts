/**
 * Large Project Performance Tests
 *
 * Loads the vanilla Minecraft project (~thousands of items) into the web editor
 * and measures key loading phase timings. This provides a repeatable baseline
 * for tracking editor performance with large projects.
 *
 * ## What is measured
 *
 * 1. **Editor open** — time from file upload until the ProjectEditor component
 *    appears in the DOM (`[data-testid="project-editor"]`).
 *
 * 2. **UI responsive** — time until the project item list is populated and stable
 *    (items visible in `[role="option"]`, count stabilized over consecutive polls).
 *
 * 3. **Relations complete** — time until `data-relations-complete="true"` is set,
 *    meaning all project item cross-references have been resolved.
 *
 * 4. **Validation complete** — time until `data-validation-complete="true"` is set,
 *    meaning the full info set (linting, schema checks, etc.) has been generated.
 *
 * ## Prerequisites
 *
 * - Vite dev server running: `npm run web` (from app/)
 * - Vanilla zip at: `app/public/res/latest/van/release/vanillarelease.zip`
 *
 * ## Running
 *
 * ```bash
 * cd app
 * npm run test-perf          # headless
 * npm run test-perf-headed   # watch in browser
 * npm run test-perf-debug    # step-through debug
 * ```
 *
 * Results are logged to console and written to `app/test/results/perf-timings.json`.
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import {
  getVanillaZipPath,
  measureFullLoadTimings,
  logTimings,
  writeTimingsToFile,
  uploadFileViaInput,
  waitForEditorOpen,
  getItemCount,
  getLoadingPhase,
  getStatusMessage,
} from "./PerfTestUtilities";
import { waitForAppReady, processMessage } from "../testshared/TestUtilities";

// Results output path
const RESULTS_PATH = path.resolve(__dirname, "../../test/results/perf-timings.json");

// Screenshot output directory
const SCREENSHOT_DIR = path.resolve(__dirname, "../../debugoutput/perf-screenshots");

/**
 * Take a timestamped screenshot.
 */
async function takeScreenshot(page: import("@playwright/test").Page, name: string): Promise<void> {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  [PERF] Screenshot: ${screenshotPath}`);
}

test.describe("Large Project Performance", () => {
  // Track console errors throughout the test
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Set up console message tracking
    page.on("console", (msg) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);

      // Forward RelationsIndex and Validation debug messages to test output
      const text = msg.text();
      if (text.includes("[RelationsIndex]") || text.includes("[Validation]")) {
        console.log(`  [BROWSER] ${text}`);
      }
    });
  });

  test("Load vanilla project and measure phase timings", async ({ page }) => {
    // Verify vanilla zip exists
    const zipPath = getVanillaZipPath();
    expect(fs.existsSync(zipPath), `Vanilla zip not found at: ${zipPath}`).toBeTruthy();

    const zipSizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
    console.log(`\n  [PERF] Vanilla zip: ${zipPath} (${zipSizeMb} MB)`);

    // Navigate to home page
    await page.goto("/");
    const isReady = await waitForAppReady(page, 15_000);
    expect(isReady, "App should be ready on home page").toBeTruthy();
    await takeScreenshot(page, "01-home-page");

    // Run the full timing measurement
    const timings = await measureFullLoadTimings(page, zipPath);

    // Take screenshots at current state (validation complete)
    await takeScreenshot(page, "02-editor-loaded");

    // Log structured results
    logTimings("Vanilla Project (vanillarelease.zip)", timings);

    // Write to results file for trend tracking
    writeTimingsToFile(RESULTS_PATH, "vanilla-release", timings);

    // Sanity checks — verify the loading pipeline actually completed.
    expect(timings.editorOpenMs).toBeGreaterThan(0);
    expect(timings.itemCount).toBeGreaterThan(0);
    const finalPhase = await getLoadingPhase(page);
    expect(finalPhase).toBe("ready");

    // ─── Performance thresholds ───────────────────────────────────────
    //
    // Relations processing should complete quickly after the editor opens.
    // The worker-side compute is ~12s; wall-clock adds serialization overhead.
    // We allow a generous budget so tests aren't flaky on slow CI machines,
    // but tight enough to catch major regressions.
    //
    // Threshold rationale (measured on reference hardware):
    //   relationsAfterEditor: typically ~18s, budget 120s
    //   validationAfterEditor: typically ~90s, budget 300s
    //   itemCount: vanilla release has ~15,000 items

    const relationsAfterEditorMs = timings.relationsCompleteMs - timings.editorOpenMs;
    const validationAfterEditorMs = timings.validationCompleteMs - timings.editorOpenMs;

    console.log(`  [PERF] Relations after editor open: ${(relationsAfterEditorMs / 1000).toFixed(1)}s`);
    console.log(`  [PERF] Validation after editor open: ${(validationAfterEditorMs / 1000).toFixed(1)}s`);

    // Relations should complete within 120s of editor opening
    expect(relationsAfterEditorMs).toBeLessThan(120_000);

    // Validation should complete within 300s of editor opening
    expect(validationAfterEditorMs).toBeLessThan(300_000);

    // Vanilla release should have at least 10,000 items
    expect(timings.itemCount).toBeGreaterThan(10_000);

    // Relations must finish before validation
    expect(timings.relationsCompleteMs).toBeLessThanOrEqual(timings.validationCompleteMs);
  });

  test("Measure UI responsiveness during loading", async ({ page }) => {
    // This test uploads the vanilla project and measures how responsive
    // the UI is during the various loading phases by checking rendering latency.

    const zipPath = getVanillaZipPath();
    if (!fs.existsSync(zipPath)) {
      test.skip(true, `Vanilla zip not found at: ${zipPath}`);
      return;
    }

    // Navigate to home page
    await page.goto("/");
    await waitForAppReady(page, 15_000);

    const startTime = Date.now();
    await uploadFileViaInput(page, zipPath);

    // Wait for editor to appear
    await waitForEditorOpen(page, startTime);
    await takeScreenshot(page, "03-responsiveness-editor-open");

    // Now poll loading phase + item count + status message every 2 seconds
    // to create a timeline of the loading experience
    const timeline: {
      elapsedMs: number;
      phase: string;
      itemCount: number;
      statusMessage: string;
      renderLatencyMs: number;
    }[] = [];

    const MAX_POLL_TIME_MS = 600_000; // 10 minutes max
    const POLL_INTERVAL_MS = 2_000;
    const pollDeadline = Date.now() + MAX_POLL_TIME_MS;

    let iteration = 0;
    while (Date.now() < pollDeadline) {
      const pollStart = Date.now();

      // Measure how long it takes to read a DOM attribute (proxy for render responsiveness)
      const renderStart = Date.now();
      const phase = await getLoadingPhase(page);
      const renderLatencyMs = Date.now() - renderStart;

      const itemCount = await getItemCount(page);
      const statusMessage = await getStatusMessage(page);
      const elapsedMs = Date.now() - startTime;

      timeline.push({
        elapsedMs,
        phase,
        itemCount,
        statusMessage: statusMessage.substring(0, 80), // truncate for readability
        renderLatencyMs,
      });

      // Take a screenshot every 30 seconds
      if (iteration % 15 === 0 && iteration > 0) {
        await takeScreenshot(page, `04-timeline-${Math.floor(elapsedMs / 1000)}s`);
      }

      // Stop when validation is complete
      if (phase === "ready") {
        await takeScreenshot(page, "05-validation-complete");
        break;
      }

      iteration++;
      const pollElapsed = Date.now() - pollStart;
      const sleepTime = Math.max(100, POLL_INTERVAL_MS - pollElapsed);
      await page.waitForTimeout(sleepTime);
    }

    // Log the timeline
    console.log(`\n${"=".repeat(80)}`);
    console.log("LOADING TIMELINE");
    console.log(`${"=".repeat(80)}`);
    console.log("  Time       | Phase       | Items   | Render  | Status");
    console.log(`${"─".repeat(80)}`);

    for (const entry of timeline) {
      const time = formatElapsed(entry.elapsedMs);
      const phase = entry.phase.padEnd(11);
      const items = String(entry.itemCount).padStart(7);
      const render = `${entry.renderLatencyMs}ms`.padStart(7);
      const status = entry.statusMessage || "(none)";
      console.log(`  ${time} | ${phase} | ${items} | ${render} | ${status}`);
    }

    console.log(`${"=".repeat(80)}\n`);

    // Check for high render latency spikes (potential jank indicators)
    const renderLatencies = timeline.map((e) => e.renderLatencyMs);
    const maxLatency = Math.max(...renderLatencies);
    const avgLatency = renderLatencies.reduce((a, b) => a + b, 0) / renderLatencies.length;
    const p95Index = Math.floor(renderLatencies.sort((a, b) => a - b).length * 0.95);
    const p95Latency = renderLatencies[p95Index] ?? maxLatency;

    console.log(`  [PERF] DOM read latency: avg=${avgLatency.toFixed(0)}ms, p95=${p95Latency}ms, max=${maxLatency}ms`);

    // Write timeline to results
    const timelinePath = path.resolve(__dirname, "../../test/results/perf-timeline.json");
    const resultsDir = path.dirname(timelinePath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(
      timelinePath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          timeline,
          summary: {
            totalPhases: timeline.length,
            avgRenderLatencyMs: avgLatency,
            p95RenderLatencyMs: p95Latency,
            maxRenderLatencyMs: maxLatency,
            finalItemCount: timeline.length > 0 ? timeline[timeline.length - 1].itemCount : 0,
            totalDurationMs: timeline.length > 0 ? timeline[timeline.length - 1].elapsedMs : 0,
          },
        },
        null,
        2
      )
    );
    console.log(`  [PERF] Timeline written to: ${timelinePath}`);
  });
});

function formatElapsed(ms: number): string {
  if (ms < 1000) {
    return `${String(ms).padStart(5)}ms  `;
  } else if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1).padStart(6)}s  `;
  } else {
    const min = Math.floor(ms / 60_000);
    const sec = ((ms % 60_000) / 1000).toFixed(0);
    return `${min}m ${sec.padStart(2)}s    `;
  }
}
