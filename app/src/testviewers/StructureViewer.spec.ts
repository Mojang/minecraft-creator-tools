/**
 * StructureViewer Visual Regression Tests
 *
 * Renders diverse .mcstructure files with vanilla textures and captures screenshots
 * for visual review. Covers structures with varied block types:
 * doors, redstone, pistons, slabs, glass, flying machines, and general builds.
 *
 * Run with: npx playwright test StructureViewer.spec.ts --project=chromium
 *
 * Screenshots saved to debugoutput/structure-screenshots/ (not the shared snapshots dir).
 *
 * STRUCTURE TEST FILES (in app/public/res/test/):
 *   cannon.mcstructure        — TNT cannon, diverse blocks
 *   mediumglass.mcstructure   — Glass panes, transparency
 *   flat_5x5x5.mcstructure    — Simple flat platform
 *   door_maze_crowded.mcstructure — Doors, walls, complex shapes
 *   torch_nor.mcstructure     — Redstone torches, wiring
 *   sticky_extend.mcstructure — Pistons, mechanical blocks
 *   waterlogged_slab.mcstructure — Slabs with water
 *   machine_i.mcstructure     — Flying machine, observers/pistons
 *   sample_structure.mcstructure — Comprehensive sample
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

// Use 512x512 viewport for consistent screenshot baselines
test.use({ viewport: { width: 512, height: 512 } });

const SCREENSHOT_DIR = "debugoutput/structure-screenshots";

/** Navigate to the structure viewer in headless mode with vanilla textures. */
async function openStructure(
  page: import("@playwright/test").Page,
  structureFile: string,
  options?: { cameraX?: number; cameraY?: number; cameraZ?: number }
): Promise<void> {
  let url = `/?mode=structureviewer&structure=/res/test/${structureFile}&skipVanillaResources=false&hideChrome=true`;

  if (options?.cameraX !== undefined && options.cameraY !== undefined && options.cameraZ !== undefined) {
    url += `&cameraX=${options.cameraX}&cameraY=${options.cameraY}&cameraZ=${options.cameraZ}`;
  }

  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Wait for the Babylon.js canvas to render. */
async function waitForRender(page: import("@playwright/test").Page, timeoutMs: number = 15000): Promise<void> {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: timeoutMs });

  // Give Babylon.js time to render block meshes and load textures
  await page.waitForTimeout(3000);
}

test.describe("Structure Viewer Visual Regression Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // Structures to test with rendering-appropriate camera positions.
  const structuresToTest: [string, string, { cameraX?: number; cameraY?: number; cameraZ?: number }?][] = [
    ["cannon.mcstructure", "cannon"],
    ["mediumglass.mcstructure", "glass"],
    ["flat_5x5x5.mcstructure", "flat-5x5x5"],
    ["door_maze_crowded.mcstructure", "door-maze"],
    ["torch_nor.mcstructure", "redstone-torch"],
    ["sticky_extend.mcstructure", "piston"],
    ["waterlogged_slab.mcstructure", "waterlogged-slab"],
    ["machine_i.mcstructure", "flying-machine"],
    ["sample_structure.mcstructure", "sample-structure"],
  ];

  for (const [filename, displayName, cameraOverrides] of structuresToTest) {
    test(`should render structure: ${displayName}`, async ({ page }) => {
      test.setTimeout(45000);

      await openStructure(page, filename, cameraOverrides);
      await waitForRender(page);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/structure-${displayName}.png` });
    });
  }

  test("should render cannon from multiple angles", async ({ page }) => {
    test.setTimeout(60000);

    // Default angle
    await openStructure(page, "cannon.mcstructure");
    await waitForRender(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/structure-cannon-default.png` });

    // Top-down angle
    await openStructure(page, "cannon.mcstructure", { cameraX: 8, cameraY: 25, cameraZ: 8 });
    await waitForRender(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/structure-cannon-topdown.png` });

    // Close-up side angle
    await openStructure(page, "cannon.mcstructure", { cameraX: -5, cameraY: 5, cameraZ: 8 });
    await waitForRender(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/structure-cannon-side.png` });
  });

  test("should not produce critical console errors", async ({ page }) => {
    test.setTimeout(30000);

    await openStructure(page, "cannon.mcstructure");
    await waitForRender(page);

    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.error.includes("WebGL") &&
        !e.error.includes("swiftshader") &&
        !e.error.includes("GroupMarker") &&
        !e.error.includes("404")
    );

    expect(criticalErrors.length).toBe(0);
  });
});
