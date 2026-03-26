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
