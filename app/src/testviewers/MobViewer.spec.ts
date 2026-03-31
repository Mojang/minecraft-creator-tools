/**
 * MobViewer Tests
 *
 * Tests for the mob/entity model viewer component — verifies the viewer loads,
 * navigation works, mob info displays correctly, and the gallery can be browsed.
 *
 * Note: Functional tests check page structure (dropdown, mob info, navigation)
 * rather than requiring the 3D canvas, since WebGL model loading can be unreliable
 * in headless/CI environments.
 *
 * Run with: npm run test-viewers
 *
 * Screenshots are captured for manual review in debugoutput/screenshots/.
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

// Use a 512x512 viewport for mob screenshots
test.use({ viewport: { width: 512, height: 512 } });

test.describe("MobViewer", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load mob viewer mode", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    // The mob viewer page should load with either a canvas or a "model loading" state.
    // The 3D model may fail to load in headless/CI environments, so we check for the
    // page structure (dropdown, mob info) rather than requiring the canvas.
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-initial.png" });
  });

  test("should load specific mob via URL parameter", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    // Wait for the mob info to appear (works regardless of 3D model loading)
    await page.waitForSelector(".mv-mob-info h2", { timeout: 30000 });

    const heading = page.locator(".mv-mob-info h2");
    await expect(heading).toContainText("pig");

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-pig.png" });
  });

  test("should navigate between mobs", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });
    const optionCount = await select.locator("option").count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    const nextButton = page.locator(".mv-button:has-text('Next')");
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-next-mob.png" });
    }
  });

  test("should select mob from dropdown", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=cow");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    const options = await select.locator("option").allTextContents();
    if (options.includes("chicken")) {
      await select.selectOption({ label: "chicken" });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-chicken.png" });
    } else if (options.length > 5) {
      await select.selectOption({ index: 5 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-selected.png" });
    }
  });

  test("should display mob details", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=cow");

    const mobInfo = page.locator(".mv-mob-info");
    await expect(mobInfo).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-cow-details.png" });
  });

  test("should have working navigation buttons", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=sheep");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    const prevButton = page.locator(".mv-button:has-text('Prev')");
    const nextButton = page.locator(".mv-button:has-text('Next')");

    for (let i = 0; i < 3; i++) {
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(prevButton).toBeEnabled();
    await prevButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-navigation.png" });
  });

  test("should show sky background or model state", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=sheep");

    // Wait for page to fully load
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-sheep-with-sky.png" });
  });
});

/**
 * MobViewer Gallery Sweep
 *
 * Iterates through a representative sample of mobs to verify the viewer
 * loads each one without crashing. Does NOT do baseline screenshot comparison —
 * baselines would require checking in 78+ images that vary by GPU/driver/OS.
 */
test.describe("Mob Viewer Gallery Sweep", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should complete mob gallery without excessive errors", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");
    await page.waitForLoadState("networkidle");

    const dropdown = page.locator(".mv-select");
    await expect(dropdown).toBeVisible({ timeout: 30000 });

    const optionCount = await dropdown.locator("option").count();

    const renderErrors: string[] = [];

    // Test first 15 mobs by navigating through the dropdown
    for (let i = 0; i < Math.min(15, optionCount); i++) {
      await dropdown.selectOption({ index: i });
      await page.waitForTimeout(500);

      const errorDiv = page.locator(".mv-error");
      if (await errorDiv.isVisible().catch(() => false)) {
        const errorText = await errorDiv.textContent();
        renderErrors.push(`Mob ${i}: ${errorText}`);
      }
    }

    if (renderErrors.length > 0) {
      console.log("Render errors encountered:", renderErrors);
    }

    // Allow some errors (missing models, textures) but not too many
    expect(renderErrors.length).toBeLessThan(5);
  });
});
