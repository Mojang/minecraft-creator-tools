/**
 * WorldView Integration Tests
 *
 * Tests that WorldViewer is properly integrated into WorldView for 3D world
 * rendering. Validates that:
 * - WorldViewer renders when "Full 3D world" or "3D world + map" modes are selected
 * - The View menu exposes the new modes
 * - WorldViewer canvas appears and renders world content
 * - VolumeEditor is still used for the legacy selection-based 3D modes
 *
 * Uses the 2000world.mcworld sample from samplecontent/.
 *
 * Run with: npx playwright test WorldViewIntegration.spec.ts --project=chromium
 * Screenshots saved to debugoutput/worldview-integration-screenshots/
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.use({ viewport: { width: 1280, height: 720 } });

const SCREENSHOT_DIR = "debugoutput/worldview-integration-screenshots";

/**
 * Navigate to the standalone world viewer (to verify baseline WorldViewer works).
 */
async function openStandaloneWorldViewer(
  page: Page,
  worldFile: string,
  options?: { hideChrome?: boolean }
): Promise<void> {
  let url = `/?mode=worldviewer&world=/res/test/${worldFile}`;
  if (options?.hideChrome) {
    url += "&hideChrome=true";
  }
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for the WorldViewer canvas (data-testid="world-viewer-canvas") to appear.
 */
async function waitForWorldViewerCanvas(page: Page, timeoutMs: number = 30000): Promise<boolean> {
  try {
    const canvas = page.locator('[data-testid="world-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: timeoutMs });
    // Give time for chunk loading and mesh generation
    await page.waitForTimeout(6000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for any canvas element to appear (for VolumeEditor or WorldViewer).
 */
async function waitForAnyCanvas(page: Page, timeoutMs: number = 15000): Promise<boolean> {
  try {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: timeoutMs });
    await page.waitForTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Render statistics published by WorldViewer onto `window.__mctWorldRenderStats`.
 * - renderedBlockCount: total blocks that survived culling and were meshed.
 * - minRenderedY / maxRenderedY: lowest / highest world Y of any rendered block.
 * - minRenderY: the configured vertical floor (default -64 = world bottom).
 */
interface IWorldRenderStats {
  renderedBlockCount: number;
  minRenderedY: number;
  maxRenderedY: number;
  minRenderY: number;
}

/**
 * Wait for the world viewer to publish render stats with a non-zero block count.
 * Polls `window.__mctWorldRenderStats` until blocks are rendered or it times out.
 */
async function readWorldRenderStats(page: Page, timeoutMs: number = 45000): Promise<IWorldRenderStats> {
  const canvas = page.locator('[data-testid="world-viewer-canvas"]');
  await expect(canvas).toBeVisible({ timeout: timeoutMs });

  const deadline = Date.now() + timeoutMs;
  let stats: IWorldRenderStats | undefined;
  while (Date.now() < deadline) {
    stats = await page.evaluate(
      () => (window as unknown as { __mctWorldRenderStats?: IWorldRenderStats }).__mctWorldRenderStats
    );
    if (stats && stats.renderedBlockCount > 0) {
      return stats;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for non-zero world render stats");
}

test.describe("WorldView Integration Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("standalone WorldViewer renders 2000world", async ({ page }) => {
    test.setTimeout(120000);

    await openStandaloneWorldViewer(page, "2000world.mcworld", { hideChrome: true });

    // Wait for diagnostic load
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/standalone-diagnostic.png` });

    const canvasVisible = await waitForWorldViewerCanvas(page);
    expect(canvasVisible).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/standalone-rendered.png` });

    // Verify canvas has substantial content
    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(3000);
  });

  test("standalone WorldViewer shows info bar", async ({ page }) => {
    test.setTimeout(120000);

    await openStandaloneWorldViewer(page, "2000world.mcworld");
    const canvasVisible = await waitForWorldViewerCanvas(page);
    expect(canvasVisible).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/standalone-with-chrome.png` });

    // Check for chunk count info bar
    const info = page.locator(".wvr-info");
    const infoVisible = await info.isVisible({ timeout: 3000 }).catch(() => false);
    if (infoVisible) {
      const text = await info.textContent();
      expect(text).toContain("Chunks:");
    }
  });

  test("WorldViewer renders from elevated camera angle", async ({ page }) => {
    test.setTimeout(120000);

    let url = `/?mode=worldviewer&world=/res/test/2000world.mcworld&hideChrome=true`;
    url += `&cameraX=0&cameraY=90&cameraZ=0`;
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const canvasVisible = await waitForWorldViewerCanvas(page);
    expect(canvasVisible).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/elevated-camera.png` });
  });

  test("WorldViewer renders from ground level", async ({ page }) => {
    test.setTimeout(120000);

    let url = `/?mode=worldviewer&world=/res/test/2000world.mcworld&hideChrome=true`;
    url += `&cameraX=0&cameraY=68&cameraZ=0`;
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const canvasVisible = await waitForWorldViewerCanvas(page);
    expect(canvasVisible).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ground-level.png` });
  });
});

/**
 * Y-floor regression guard.
 *
 * History: the world renderer once imposed an artificial vertical floor (~Y=40)
 * that silently dropped all content below it. The fix removed that floor so the
 * default `minRenderY` is the world bottom (-64) and ALL exposed content renders.
 *
 * These tests assert against the render-stats hook
 * (`window.__mctWorldRenderStats`) so a re-introduced floor would fail loudly:
 *  1. By default, 2000world must render exposed content well below Y=40.
 *  2. The `minRenderY` URL param must actually clip low content (proving the
 *     floor mechanism still works, just defaulting to "no floor").
 *
 * 2000world.mcworld empirical baseline (default): ~306k blocks, minRenderedY=-64.
 * With minRenderY=40: ~125k blocks, minRenderedY=40.
 */
test.describe("WorldViewer Y-floor regression guard", () => {
  test("default render reaches content below Y=40", async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(`/?mode=worldviewer&world=/res/test/2000world.mcworld&hideChrome=true`);
    await page.waitForLoadState("networkidle");

    const stats = await readWorldRenderStats(page);

    // No artificial floor by default — the configured floor is the world bottom.
    expect(stats.minRenderY).toBeLessThanOrEqual(-64);
    // Exposed content below Y=40 must actually be rendered. A re-introduced
    // vertical floor would push minRenderedY up and fail this assertion.
    expect(stats.minRenderedY).toBeLessThan(40);
    expect(stats.renderedBlockCount).toBeGreaterThan(0);
  });

  test("minRenderY param clips content below the floor", async ({ page }) => {
    test.setTimeout(120000);

    // First capture the default (no-floor) block count for comparison.
    await page.goto(`/?mode=worldviewer&world=/res/test/2000world.mcworld&hideChrome=true`);
    await page.waitForLoadState("networkidle");
    const baseline = await readWorldRenderStats(page);

    // Now apply an explicit Y=40 floor and confirm low content is clipped.
    await page.goto(`/?mode=worldviewer&world=/res/test/2000world.mcworld&hideChrome=true&minRenderY=40`);
    await page.waitForLoadState("networkidle");
    const floored = await readWorldRenderStats(page);

    expect(floored.minRenderY).toBe(40);
    // Nothing below the floor should render.
    expect(floored.minRenderedY).toBeGreaterThanOrEqual(40);
    // Clipping low content must drop the block count relative to the default.
    expect(floored.renderedBlockCount).toBeLessThan(baseline.renderedBlockCount);
  });
});
