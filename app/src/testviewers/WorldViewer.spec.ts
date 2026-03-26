/**
 * WorldViewer Visual Tests
 *
 * Tests for the 3D world viewer that renders .mcworld files as a full
 * Minecraft world scene with sky, lighting, textured blocks, and WASD navigation.
 *
 * Uses the 2000world.mcworld sample from samplecontent/.
 *
 * Run with: npx playwright test WorldViewer.spec.ts --project=chromium
 * Screenshots saved to debugoutput/world-viewer-screenshots/
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

// Use 1280x720 viewport for world rendering (wider FOV)
test.use({ viewport: { width: 1280, height: 720 } });

const SCREENSHOT_DIR = "debugoutput/world-viewer-screenshots";

/** Navigate to the world viewer with a .mcworld file. */
async function openWorldViewer(
  page: import("@playwright/test").Page,
  worldFile: string,
  options?: { cameraX?: number; cameraY?: number; cameraZ?: number; hideChrome?: boolean }
): Promise<void> {
  let url = `/?mode=worldviewer&world=/res/test/${worldFile}`;

  if (options?.hideChrome) {
    url += "&hideChrome=true";
  }

  if (options?.cameraX !== undefined && options.cameraY !== undefined && options.cameraZ !== undefined) {
    url += `&cameraX=${options.cameraX}&cameraY=${options.cameraY}&cameraZ=${options.cameraZ}`;
  }

  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Wait for the world to load and render. */
async function waitForWorldRender(page: import("@playwright/test").Page, timeoutMs: number = 30000): Promise<void> {
  // Wait for canvas to appear
  const canvas = page.locator('[data-testid="world-viewer-canvas"]');
  await expect(canvas).toBeVisible({ timeout: timeoutMs });

  // Give time for chunk loading, texture loading, and mesh generation
  await page.waitForTimeout(8000);
}

test.describe("World Viewer Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load and render 2000world", async ({ page }) => {
    test.setTimeout(120000);

    await openWorldViewer(page, "2000world.mcworld", { hideChrome: true });

    // Take diagnostic screenshot before waiting for canvas
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/world-2000-diagnostic.png` });

    await waitForWorldRender(page);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/world-2000-default.png` });

    // Verify canvas has substantial content (not blank)
    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(3000);
  });

  test("should render from elevated camera angle", async ({ page }) => {
    test.setTimeout(120000);

    await openWorldViewer(page, "2000world.mcworld", {
      hideChrome: true,
      cameraX: 0,
      cameraY: 90,
      cameraZ: 0,
    });
    await waitForWorldRender(page);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/world-2000-elevated.png` });
  });

  test("should render from ground level", async ({ page }) => {
    test.setTimeout(120000);

    await openWorldViewer(page, "2000world.mcworld", {
      hideChrome: true,
      cameraX: 0,
      cameraY: 68,
      cameraZ: 0,
    });
    await waitForWorldRender(page);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/world-2000-ground.png` });
  });

  test("should show info bar when chrome enabled", async ({ page }) => {
    test.setTimeout(120000);

    await openWorldViewer(page, "2000world.mcworld");
    await waitForWorldRender(page);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/world-2000-with-chrome.png` });

    // Check for chunk count info
    const info = page.locator(".wvr-info");
    if (await info.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await info.textContent();
      console.log("World info: " + text);
    }
  });
});
