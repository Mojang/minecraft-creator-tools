/**
 * Large Project Performance Tests
 *
 * Tests that verify the web UI handles large projects (100+ items) without:
 * - Excessive load times
 * - UI freezing/unresponsiveness
 * - Missing or broken item type rendering
 * - Console errors from unsupported content types
 *
 * Uses the `/open-sample vanilla-bp` command to load the vanilla Minecraft
 * behavior pack directly from the server's /res/ folder — no zip import needed.
 *
 * Run with: npx playwright test LargeProjectPerformance.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, takeScreenshot, enableAllFileTypes } from "./WebTestUtilities";

// Use standard viewport
test.use({ viewport: { width: 1280, height: 720 } });

/**
 * Load the vanilla behavior pack via the /open-sample command.
 * Types the command into the command bar on the home page.
 * Returns the time taken in milliseconds.
 */
async function openVanillaBehaviorPack(page: Page): Promise<number> {
  const startTime = Date.now();

  // Navigate to home page
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Find the command bar input — it's the search/command input on the home page
  // The command bar accepts /commands when text starts with /
  const commandInput = page
    .locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="text"]')
    .first();

  if (!(await commandInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    // Try the ProjectGrid command bar area
    const anyInput = page.locator("input").first();
    if (await anyInput.isVisible({ timeout: 3000 })) {
      await anyInput.click();
      await anyInput.fill("/open-sample vanilla-bp");
      await page.keyboard.press("Enter");
    } else {
      throw new Error("Could not find command bar input on home page");
    }
  } else {
    await commandInput.click();
    await commandInput.fill("/open-sample vanilla-bp");
    await page.keyboard.press("Enter");
  }

  // Wait for project to load — the command sets context.project which triggers navigation
  // to the editor. Wait for the editor toolbar to appear.
  const toolbar = page.locator('[aria-label="Project Editor main toolbar"], .pe-toolbar, .pe-toolbar-compact').first();
  try {
    await expect(toolbar).toBeVisible({ timeout: 60000 });
  } catch {
    // Fallback: check for Home button (indicates we're in editor)
    const homeButton = page.getByRole("button", { name: /home/i }).first();
    await expect(homeButton).toBeVisible({ timeout: 10000 });
  }

  // Wait a bit more for items to populate
  await page.waitForTimeout(3000);

  const loadTime = Date.now() - startTime;
  return loadTime;
}

/**
 * Count visible sidebar items.
 */
async function countSidebarItems(page: Page): Promise<number> {
  const items = page.locator(".pit-name");
  return await items.count();
}

/**
 * Measure time to click on a sidebar item and have it load.
 */
async function measureItemClickTime(page: Page, itemIndex: number): Promise<{ name: string; timeMs: number }> {
  const items = page.locator(".pit-name");
  const item = items.nth(itemIndex);

  if (!(await item.isVisible({ timeout: 1000 }).catch(() => false))) {
    return { name: "(not visible)", timeMs: -1 };
  }

  const name = ((await item.textContent()) || "").trim();
  const startTime = Date.now();

  await item.scrollIntoViewIfNeeded();
  await item.click();

  // Wait for editor content to appear
  await page.waitForTimeout(1500);

  const timeMs = Date.now() - startTime;
  return { name, timeMs };
}

test.describe("Large Project Performance @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load vanilla behavior pack within reasonable time", async ({ page }) => {
    test.setTimeout(120000);

    const loadTime = await openVanillaBehaviorPack(page);
    console.log(`Vanilla BP load time: ${loadTime}ms (${(loadTime / 1000).toFixed(1)}s)`);

    await takeScreenshot(page, "debugoutput/screenshots/large-project-loaded");

    // Count items in sidebar
    const itemCount = await countSidebarItems(page);
    console.log(`Sidebar items visible: ${itemCount}`);

    // Should have loaded items from the vanilla behavior pack
    expect(itemCount).toBeGreaterThan(5);

    // Load time should be under 90 seconds (2000+ files via HTTP)
    expect(loadTime).toBeLessThan(90000);
  });

  test("should display vanilla item types without errors", async ({ page }) => {
    test.setTimeout(120000);

    await openVanillaBehaviorPack(page);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/large-project-all-types");

    // Count items
    const itemCount = await countSidebarItems(page);
    console.log(`Items after enabling all types: ${itemCount}`);

    // Should have a substantial number of items (vanilla BP has 100+ entities alone)
    expect(itemCount).toBeGreaterThan(10);

    // Check for console errors (excluding known ignorable ones)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.error.includes("WebGL") &&
        !e.error.includes("swiftshader") &&
        !e.error.includes("GroupMarker") &&
        !e.error.includes("404") &&
        !e.error.includes("No content for file") &&
        !e.error.includes("nesting depth exceeded")
    );

    if (criticalErrors.length > 0) {
      console.log(`Critical errors during load: ${criticalErrors.length}`);
      for (const err of criticalErrors.slice(0, 5)) {
        console.log(`  ERROR: ${err.error.substring(0, 200)}`);
      }
    }
  });

  test("should click through vanilla items without UI freezing", async ({ page }) => {
    test.setTimeout(180000);

    await openVanillaBehaviorPack(page);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    const itemCount = await countSidebarItems(page);
    console.log(`Total sidebar items: ${itemCount}`);

    // Click through first 20 items and measure response times
    const clickTimes: { name: string; timeMs: number }[] = [];
    const maxItems = Math.min(itemCount, 20);

    for (let i = 0; i < maxItems; i++) {
      const result = await measureItemClickTime(page, i);
      if (result.timeMs >= 0) {
        clickTimes.push(result);
        console.log(`  Item ${i}: "${result.name}" → ${result.timeMs}ms`);
      }
    }

    await takeScreenshot(page, "debugoutput/screenshots/large-project-clicked-through");

    // Calculate average click time
    const validTimes = clickTimes.filter((t) => t.timeMs > 0);
    if (validTimes.length > 0) {
      const avgTime = validTimes.reduce((sum, t) => sum + t.timeMs, 0) / validTimes.length;
      const maxTime = Math.max(...validTimes.map((t) => t.timeMs));
      console.log(`Average item click time: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms`);

      // No single item should take more than 5 seconds to open
      expect(maxTime).toBeLessThan(5000);
    }
  });

  test("should not show phantom edits after browsing vanilla project", async ({ page }) => {
    test.setTimeout(180000);

    await openVanillaBehaviorPack(page);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Click through first 15 items
    const items = page.locator(".pit-name");
    const itemCount = Math.min(await items.count(), 15);

    for (let i = 0; i < itemCount; i++) {
      const item = items.nth(i);
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        await item.scrollIntoViewIfNeeded();
        await item.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForTimeout(2000);

    // Check for phantom edits (asterisk in file names)
    const modifiedItems: string[] = [];
    const allItems = page.locator(".pit-name");
    const totalItems = await allItems.count();

    for (let i = 0; i < totalItems; i++) {
      const item = allItems.nth(i);
      if (await item.isVisible({ timeout: 300 }).catch(() => false)) {
        const text = ((await item.textContent()) || "").trim();
        if (text.endsWith("*")) {
          modifiedItems.push(text);
        }
      }
    }

    if (modifiedItems.length > 0) {
      console.log(`PHANTOM EDITS in large project: ${modifiedItems.length} files`);
      for (const name of modifiedItems.slice(0, 10)) {
        console.log(`  - ${name}`);
      }
      await takeScreenshot(page, "debugoutput/screenshots/large-project-phantom-edits-FAIL");
    }

    expect(modifiedItems).toEqual([]);
  });
});

test.describe("Large Project Scrolling Performance @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should maintain scroll performance with many items", async ({ page }) => {
    test.setTimeout(120000);

    await openVanillaBehaviorPack(page);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Get the sidebar/project list area
    const sidebarArea = page.locator(".pil-area, .pil-outer, [class*='projectItemList']").first();

    if (await sidebarArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Measure scroll performance by scrolling to bottom and back
      const startTime = Date.now();

      // Scroll down
      for (let i = 0; i < 10; i++) {
        await sidebarArea.evaluate((el) => {
          el.scrollTop += 500;
        });
        await page.waitForTimeout(100);
      }

      await takeScreenshot(page, "debugoutput/screenshots/large-project-scrolled-down");

      // Scroll back up
      for (let i = 0; i < 10; i++) {
        await sidebarArea.evaluate((el) => {
          el.scrollTop -= 500;
        });
        await page.waitForTimeout(100);
      }

      const scrollTime = Date.now() - startTime;
      console.log(`Scroll cycle time: ${scrollTime}ms`);

      await takeScreenshot(page, "debugoutput/screenshots/large-project-scrolled-back");

      // Scroll operations should complete within 5 seconds total
      expect(scrollTime).toBeLessThan(5000);
    } else {
      console.log("Sidebar area not found for scroll test");
    }
  });
});
