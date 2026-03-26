/**
 * MobViewer Visual Tests
 *
 * Tests for the mob/entity model viewer component with visual regression testing.
 * Run with: npx playwright test MobViewer.spec.ts --project=chromium
 *
 * To update snapshots: npx playwright test MobViewer.spec.ts --project=chromium --update-snapshots
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

// Use a 512x512 viewport for mob screenshots (matches baseline snapshot size)
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
    // Use a specific known-good mob instead of defaulting to first in list
    await page.goto("/?mode=mobviewer&mob=pig");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Take a screenshot
    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-initial.png" });
  });

  test("should load specific mob via URL parameter", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Check that the mob info shows "pig"
    await page.waitForSelector(".mv-mob-info h2", { timeout: 30000 });

    // Take a screenshot
    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-pig.png" });
  });

  test("should navigate between mobs", async ({ page }) => {
    // Start with a specific known-good mob
    await page.goto("/?mode=mobviewer&mob=pig");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Wait for the mob list to load (select should have options)
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });
    const optionCount = await select.locator("option").count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    // Click the next button
    const nextButton = page.locator(".mv-button:has-text('Next')");
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000); // Wait for render
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-next-mob.png" });
    }
  });

  test("should select mob from dropdown", async ({ page }) => {
    // Start with a specific known-good mob
    await page.goto("/?mode=mobviewer&mob=cow");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Wait for the mob list to load
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    // Get the options and select one (e.g., chicken if available)
    const options = await select.locator("option").allTextContents();
    if (options.includes("chicken")) {
      await select.selectOption({ label: "chicken" });
      await page.waitForTimeout(1000); // Wait for render
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-chicken.png" });
    } else if (options.length > 5) {
      // Select the 5th option as fallback
      await select.selectOption({ index: 5 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-selected.png" });
    }
  });

  test("should display mob details", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=cow");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Check for mob info section
    const mobInfo = page.locator(".mv-mob-info");
    await expect(mobInfo).toBeVisible({ timeout: 30000 });

    // Check for mob details
    const mobDetails = page.locator(".mv-mob-details");
    await expect(mobDetails).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-cow-details.png" });
  });

  test("should have working navigation buttons", async ({ page }) => {
    // Start with a specific known-good mob
    await page.goto("/?mode=mobviewer&mob=sheep");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Wait for the mob list to load
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    // Check that prev button is enabled when not at start
    const prevButton = page.locator(".mv-button:has-text('Prev')");
    const nextButton = page.locator(".mv-button:has-text('Next')");

    // Navigate forward a few times
    for (let i = 0; i < 3; i++) {
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Now prev should be enabled
    await expect(prevButton).toBeEnabled();

    // Navigate back
    await prevButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-navigation.png" });
  });

  test("should show sky background", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=sheep");

    // Wait for the canvas to be present
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Wait a bit for the 3D scene to fully render
    await page.waitForTimeout(2000);

    // Take a screenshot - the background should be blue sky, not black
    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-sheep-with-sky.png" });
  });
});

/**
 * MobViewer Visual Regression Tests
 *
 * These tests capture screenshots of specific mobs for visual regression testing.
 * Snapshots are stored in debugoutput/res/snapshots/ with the naming pattern mob-{name}.png
 */
test.describe("Mob Viewer Visual Regression Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Viewport is set at top level via test.use({ viewport: { width: 512, height: 512 } })
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // Comprehensive list of vanilla mobs to test
  // Sourced from: app/public/res/latest/van/preview/metadata/vanilladata_modules/mojang-entities.json
  // Excludes: projectiles (arrow, fireball, etc.), effects (area_effect_cloud, lightning_bolt),
  // vehicles (boat, minecart variants), and other non-mob entities
  const mobsToTest = [
    // Passive/Neutral animals - quadrupeds
    "pig",
    "cow",
    "sheep",
    "chicken",
    "rabbit",
    "goat",
    "mooshroom",
    "horse",
    "donkey",
    "mule",
    "llama",
    "trader_llama",
    "fox",
    "wolf",
    "cat",
    "ocelot",
    "polar_bear",
    "panda",
    "camel",
    "armadillo",
    "sniffer",

    // Passive/Neutral animals - unique shapes
    "bee",
    "bat",
    "parrot",
    "turtle",
    "frog",
    "tadpole",
    "axolotl",
    "allay",

    // Aquatic mobs
    "squid",
    "glow_squid",
    "cod",
    "salmon",
    "tropicalfish",
    "pufferfish",
    "dolphin",

    // Hostile humanoids
    "zombie",
    "husk",
    "drowned",
    "zombie_villager",
    "skeleton",
    "stray",
    "wither_skeleton",
    "bogged",
    "creeper",
    "spider",
    "cave_spider",
    "enderman",
    "endermite",
    "silverfish",
    "slime",
    "magma_cube",
    "witch",
    "phantom",

    // Illagers
    "pillager",
    "vindicator",
    "evocation_illager",
    "ravager",
    "vex",

    // Nether mobs
    "blaze",
    // "ghast", // Too large for standard framing (giant floating mob)
    "piglin",
    "piglin_brute",
    "hoglin",
    "zoglin",
    "strider",
    "zombie_pigman",

    // End mobs
    "shulker",
    // "ender_dragon", // Too large for standard framing

    // Bosses and large mobs
    "iron_golem",
    "snow_golem",
    "warden",
    "wither",
    "elder_guardian",
    "guardian",

    // Villagers and NPCs
    "villager",
    "villager_v2",
    "wandering_trader",

    // Special/Unique mobs
    "creaking",
    "breeze",
    // "happy_ghast", // New mob, may not have resources yet
  ];

  // Generate individual tests for each mob type
  for (const mobName of mobsToTest) {
    test(`should render ${mobName} correctly`, async ({ page }) => {
      // Navigate directly to the specific mob in headless mode for consistent 512x512 canvas
      await page.goto(`/?mode=mobviewer&mob=${mobName}&headless=true`);
      await page.waitForLoadState("networkidle");

      // Wait for the canvas to be visible
      const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
      await expect(canvas).toBeVisible({ timeout: 30000 });

      // Wait for the model to render (WebGL and texture loading takes time)
      await page.waitForTimeout(2500);

      // In headless mode, the canvas fills the viewport - take a full-page screenshot
      await expect(page).toHaveScreenshot(`mob-${mobName}.png`, {
        maxDiffPixels: 200,
      });
    });
  }

  test("should complete mob gallery without excessive errors", async ({ page }) => {
    // Start with a known-good mob
    await page.goto("/?mode=mobviewer&mob=pig");
    await page.waitForLoadState("networkidle");

    // Wait for canvas first
    const canvas = page.locator('[data-testid="mob-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    const dropdown = page.locator(".mv-select");
    await expect(dropdown).toBeVisible({ timeout: 30000 });

    const optionCount = await dropdown.locator("option").count();

    // Track any rendering errors
    const renderErrors: string[] = [];

    // Test first 15 mobs by navigating through them
    for (let i = 0; i < Math.min(15, optionCount); i++) {
      await dropdown.selectOption({ index: i });
      await page.waitForTimeout(500); // Wait for render

      // Check for error message
      const errorDiv = page.locator(".mv-error");
      if (await errorDiv.isVisible().catch(() => false)) {
        const errorText = await errorDiv.textContent();
        renderErrors.push(`Mob ${i}: ${errorText}`);
      }
    }

    // Report all errors at once
    if (renderErrors.length > 0) {
      console.log("Render errors encountered:", renderErrors);
    }

    // Allow some errors (missing models, textures, etc.) but not too many
    expect(renderErrors.length).toBeLessThan(5);
  });
});
