/**
 * World View Modes Tests
 *
 * Exercises the three world-viewing surfaces of the standalone world route,
 * driven entirely by the `view` query param so each layout is reachable (and
 * screenshot-able) without navigating the in-app View menu:
 *
 *   ?mode=worldviewer&world=...&view=3d      -> 3D-only (WorldViewer canvas)
 *   ?mode=worldviewer&world=...&view=map     -> 2D-only (Leaflet map)
 *   ?mode=worldviewer&world=...&view=split   -> 3D left + 2D map right
 *   ?mode=worldviewer&world=...&view=mapleft -> 2D map left + 3D right
 *
 * When no `view` param is present the route keeps the legacy 3D-only
 * WorldViewer (covered by WorldViewIntegration.spec.ts).
 *
 * Uses the 2000world.mcworld sample from samplecontent/ (served at
 * /res/test/2000world.mcworld after `npm run preparedevenv`).
 *
 * Run with: npx playwright test WorldViewModes.spec.ts --project=chromium
 * Screenshots saved to debugoutput/worldview-modes-screenshots/
 */

import { test, expect, ConsoleMessage, Page, Locator } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.use({ viewport: { width: 1280, height: 720 } });

const SCREENSHOT_DIR = "debugoutput/worldview-modes-screenshots";
const WORLD_FILE = "2000world.mcworld";

// Selectors shared across tests.
const SEL = {
  standalone: '[data-testid="standalone-world-display"]',
  loading: '[data-testid="standalone-world-display-loading"]',
  error: '[data-testid="standalone-world-display-error"]',
  canvas3d: '[data-testid="world-viewer-canvas"]',
  leaflet: ".leaflet-container",
};

type WorldViewParam = "3d" | "map" | "split" | "mapleft";

/**
 * Navigate to the standalone world route in a particular view layout.
 */
async function openWorldViewMode(page: Page, view: WorldViewParam, options?: { hideChrome?: boolean }): Promise<void> {
  let url = `/?mode=worldviewer&world=/res/test/${WORLD_FILE}&view=${view}`;
  if (options?.hideChrome) {
    url += "&hideChrome=true";
  }
  await page.goto(url);
  // NOTE: do NOT wait for "networkidle" here. The Babylon 3D viewer streams
  // chunks continuously, so the network never goes idle for the 3D/split/mapleft
  // layouts and the wait would hang until the test timeout. "domcontentloaded"
  // plus the explicit element waits below are the reliable readiness signals.
  await page.waitForLoadState("domcontentloaded");
}

/**
 * Wait for the standalone WorldDisplay wrapper to finish loading the .mcworld.
 * Returns false (rather than throwing) so the caller can attach a diagnostic
 * screenshot before asserting.
 */
async function waitForWorldDisplay(page: Page, timeoutMs: number = 60000): Promise<boolean> {
  try {
    await expect(page.locator(SEL.standalone)).toBeVisible({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for the Leaflet 2D map to mount and have at least one rendered tile.
 */
async function waitForMapTiles(page: Page, timeoutMs: number = 60000): Promise<boolean> {
  try {
    await expect(page.locator(SEL.leaflet)).toBeVisible({ timeout: timeoutMs });
    // Tiles are rendered asynchronously from chunk data; give them time to fill.
    await page.waitForTimeout(8000);
    const tileCount = await page.locator(`${SEL.leaflet} canvas`).count();
    return tileCount > 0;
  } catch {
    return false;
  }
}

/**
 * Wait for the 3D WorldViewer canvas to mount and render.
 */
async function waitFor3DCanvas(page: Page, canvas: Locator, timeoutMs: number = 60000): Promise<boolean> {
  try {
    await expect(canvas).toBeVisible({ timeout: timeoutMs });
    // Allow chunk streaming + mesh generation to populate the scene.
    await page.waitForTimeout(8000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Poll the on-canvas info overlay (.wvr-info shows "Chunks: N") until the 3D
 * viewer reports at least one rendered chunk. This guards against regressions
 * in atlas/template initialization (e.g. the serial texture-load stall that
 * left the canvas black with "Chunks: 0") which a plain canvas-visibility
 * check would not catch.
 */
async function waitForRenderedChunks(page: Page, timeoutMs: number = 30000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  while (Date.now() < deadline) {
    const text = await page
      .locator(".wvr-info")
      .first()
      .textContent({ timeout: 2000 })
      .catch(() => null);
    const match = text?.match(/Chunks:\s*(\d+)/);
    if (match) {
      lastCount = parseInt(match[1], 10);
      if (lastCount > 0) {
        return lastCount;
      }
    }
    await page.waitForTimeout(500);
  }
  return lastCount;
}

test.describe("World View Modes", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("3D view renders the WorldViewer canvas", async ({ page }) => {
    test.setTimeout(150000);

    await openWorldViewMode(page, "3d", { hideChrome: true });

    const loaded = await waitForWorldDisplay(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/3d-after-load.png`, fullPage: false });
    expect(loaded).toBe(true);

    const canvasOk = await waitFor3DCanvas(page, page.locator(SEL.canvas3d));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/3d-rendered.png`, fullPage: false });
    expect(canvasOk).toBe(true);

    // The viewer must actually render chunks, not just mount a black canvas.
    const chunkCount = await waitForRenderedChunks(page);
    expect(chunkCount).toBeGreaterThan(0);

    // No Leaflet map should be present in the 3D-only layout.
    await expect(page.locator(SEL.leaflet)).toHaveCount(0);
  });

  test("2D view renders the Leaflet map with tiles", async ({ page }) => {
    test.setTimeout(150000);

    await openWorldViewMode(page, "map", { hideChrome: true });

    const loaded = await waitForWorldDisplay(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/2d-after-load.png`, fullPage: false });
    expect(loaded).toBe(true);

    const tilesOk = await waitForMapTiles(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/2d-rendered.png`, fullPage: false });
    expect(tilesOk).toBe(true);

    // No 3D canvas should be present in the map-only layout.
    await expect(page.locator(SEL.canvas3d)).toHaveCount(0);
  });

  test("split view renders 3D and 2D side by side", async ({ page }) => {
    test.setTimeout(150000);

    await openWorldViewMode(page, "split", { hideChrome: true });

    const loaded = await waitForWorldDisplay(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/split-after-load.png`, fullPage: false });
    expect(loaded).toBe(true);

    // Both surfaces must be present simultaneously.
    const canvasOk = await waitFor3DCanvas(page, page.locator(SEL.canvas3d));
    const mapVisible = await page
      .locator(SEL.leaflet)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/split-rendered.png`, fullPage: false });

    expect(canvasOk).toBe(true);
    expect(mapVisible).toBe(true);

    // The side-by-side container should be present.
    await expect(page.locator(".wv-worldViewer3D")).toBeVisible({ timeout: 5000 });
  });

  test("mapleft view renders 2D and 3D side by side", async ({ page }) => {
    test.setTimeout(150000);

    await openWorldViewMode(page, "mapleft", { hideChrome: true });

    const loaded = await waitForWorldDisplay(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mapleft-after-load.png`, fullPage: false });
    expect(loaded).toBe(true);

    const canvasOk = await waitFor3DCanvas(page, page.locator(SEL.canvas3d));
    const mapVisible = await page
      .locator(SEL.leaflet)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mapleft-rendered.png`, fullPage: false });

    expect(canvasOk).toBe(true);
    expect(mapVisible).toBe(true);

    await expect(page.locator(".wv-worldViewerMapOnLeft")).toBeVisible({ timeout: 5000 });
  });
});
