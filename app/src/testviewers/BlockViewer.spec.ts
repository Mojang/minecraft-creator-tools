import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

/**
 * BlockViewer Visual Regression Tests
 *
 * These tests render various block types and capture screenshots for visual regression testing.
 * Run with: npx playwright test BlockViewer.spec.ts
 *
 * Snapshots are stored in debugoutput/res/snapshots/.
 */

// Use a 512x512 viewport for block screenshots (matches baseline snapshot size)
test.use({ viewport: { width: 512, height: 512 } });

test.describe("Block Viewer Visual Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // List of blocks to test - covers different rendering types
  const blocksToTest = [
    // Standard cubes
    "stone",
    "dirt",
    "grass_block",
    "cobblestone",
    "oak_planks",
    "bricks",

    // Multi-textured blocks
    "oak_log",
    "crafting_table",
    "furnace",

    // Transparent/semi-transparent
    "glass",
    "oak_leaves",
    "ice",

    // Slabs
    "stone_slab",
    "oak_slab",

    // Stairs
    "oak_stairs",
    "stone_stairs",

    // Fences
    "oak_fence",
    "cobblestone_wall",

    // Doors and trapdoors
    "wooden_door",
    "oak_trapdoor",

    // Small blocks
    "oak_button",
    "stone_pressure_plate",
    "torch",
    "lantern",

    // Rails and wires
    "rail",
    "redstone_wire",

    // Plants
    "dandelion",
    "poppy",
    "oak_sapling",
    "tall_grass",

    // Special shapes
    "anvil",
    "chain",
    "end_rod",
    "lever",
    "ladder",

    // Glass panes
    "glass_pane",
    "iron_bars",

    // Amethyst clusters and buds
    "amethyst_cluster",
    "large_amethyst_bud",
    "medium_amethyst_bud",
    "small_amethyst_bud",
  ];

  test("should render block viewer without errors", async ({ page }) => {
    // Navigate to the block viewer page
    await page.goto("/?mode=blockviewer");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Check that the canvas is visible
    const canvas = page.locator('[data-testid="block-viewer-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Check for any console errors
    expect(consoleErrors.length).toBe(0);
  });

  test("should have block selection dropdown", async ({ page }) => {
    await page.goto("/?mode=blockviewer");
    await page.waitForLoadState("networkidle");

    // Check that the dropdown exists and has options
    const dropdown = page.locator(".bv-select");
    await expect(dropdown).toBeVisible();

    // Wait for the dropdown to become enabled (blocks loaded)
    await expect(dropdown).toBeEnabled({ timeout: 15000 });

    // Wait for options to populate (blocks load asynchronously)
    await expect(dropdown.locator("option")).not.toHaveCount(0, { timeout: 15000 });

    // Should have multiple options
    const optionCount = await dropdown.locator("option").count();
    expect(optionCount).toBeGreaterThan(10); // Should have many blocks
  });

  test("should navigate between blocks", async ({ page }) => {
    await page.goto("/?mode=blockviewer");
    await page.waitForLoadState("networkidle");

    // Get initial block name
    const blockInfo = page.locator(".bv-block-info h2");
    const initialBlockName = await blockInfo.textContent();

    // Click next button
    const nextButton = page.locator("button:has-text('Next')");
    await nextButton.click();

    // Wait a moment for the mesh to render
    await page.waitForTimeout(500);

    // Check that the block name changed
    const newBlockName = await blockInfo.textContent();
    expect(newBlockName).not.toBe(initialBlockName);
  });

  // Generate individual tests for each block type
  for (const blockName of blocksToTest) {
    test(`should render ${blockName} correctly`, async ({ page }) => {
      // Navigate directly to the specific block in headless mode for consistent 512x512 canvas
      await page.goto(`/?mode=blockviewer&block=${blockName}&headless=true`);
      await page.waitForLoadState("networkidle");

      // Wait for the canvas to be visible
      const canvas = page.locator('[data-testid="block-viewer-canvas"]');
      await expect(canvas).toBeVisible({ timeout: 10000 });

      // Wait for the block to render (WebGL takes a moment; non-deterministic GPU output
      // can cause frame-to-frame jitter, so we wait a bit longer for stability)
      await page.waitForTimeout(2000);

      // In headless mode, the canvas fills the viewport - take a full-page screenshot
      await expect(page).toHaveScreenshot(`block-${blockName}.png`, {
        maxDiffPixels: 500,
      });
    });
  }

  test("should handle missing textures gracefully", async ({ page }) => {
    await page.goto("/?mode=blockviewer&block=unknown_block");
    await page.waitForLoadState("networkidle");

    // Should show error or fallback texture without crashing
    const errorDiv = page.locator(".bv-error");

    // Either we get an error message, or the page renders without crashing
    // Just checking if the page handles this gracefully (no crash)
    await errorDiv.isVisible().catch(() => false);

    // Page should still be functional
    const dropdown = page.locator(".bv-select");
    await expect(dropdown).toBeVisible();
  });

  test("should complete full block gallery render", async ({ page }) => {
    await page.goto("/?mode=blockviewer");
    await page.waitForLoadState("networkidle");

    const dropdown = page.locator(".bv-select");
    const optionCount = await dropdown.locator("option").count();

    // Track any rendering errors
    const renderErrors: string[] = [];

    // Test first 20 blocks by navigating through them
    for (let i = 0; i < Math.min(20, optionCount); i++) {
      await dropdown.selectOption({ index: i });
      await page.waitForTimeout(200); // Wait for render

      // Check for error message
      const errorDiv = page.locator(".bv-error");
      if (await errorDiv.isVisible().catch(() => false)) {
        const errorText = await errorDiv.textContent();
        renderErrors.push(`Block ${i}: ${errorText}`);
      }
    }

    // Report all errors at once
    if (renderErrors.length > 0) {
      console.log("Render errors encountered:", renderErrors);
    }

    // Allow some errors (missing textures, etc.) but not too many
    expect(renderErrors.length).toBeLessThan(5);
  });
});
