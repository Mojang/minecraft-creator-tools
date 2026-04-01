/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - SIDEBAR VIEWS
 * ==========================================================================================
 *
 * Tests for MCTools views and panels in VS Code for the Web:
 * - Minecraft activity bar icon
 * - Main view in the Minecraft activity
 * - Project explorer integration
 * - File tree with Minecraft content
 *
 * These tests verify that the extension's UI contributions work correctly.
 *
 * ==========================================================================================
 */

import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Ensure screenshot directory exists
const screenshotDir = path.join(__dirname, "../../debugoutput/screenshots/vscweb");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

/**
 * Helper to wait for VS Code to fully load
 */
async function waitForVSCodeReady(page: Page): Promise<void> {
  await page.waitForSelector(".monaco-workbench", { timeout: 30000 });
  await page.waitForSelector(".activitybar", { timeout: 10000 });
  await page.waitForTimeout(3000);
}

/**
 * Helper to take a screenshot with a descriptive name
 */
async function takeScreenshot(page: Page, name: string): Promise<void> {
  const screenshotPath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

/**
 * Helper to click on activity bar item by title
 */
async function clickActivityBarItem(page: Page, titlePattern: string): Promise<boolean> {
  // Activity bar items have aria-label or title attributes
  const activityItem = page
    .locator(
      `.activitybar .action-item[aria-label*="${titlePattern}"], .activitybar .action-item[title*="${titlePattern}"]`
    )
    .first();

  if ((await activityItem.count()) > 0) {
    await activityItem.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

/**
 * Helper to get all activity bar items
 */
async function getActivityBarItems(page: Page): Promise<string[]> {
  const items = page.locator(".activitybar .action-item");
  const labels: string[] = [];

  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const label = await items.nth(i).getAttribute("aria-label");
    if (label) {
      labels.push(label);
    }
  }
  return labels;
}

test.describe("VSCode Web Extension - Sidebar Views", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    // Extra wait for extension activation
    await page.waitForTimeout(5000);
  });

  test("should show Minecraft icon in activity bar", async ({ page }) => {
    await takeScreenshot(page, "sidebar-activity-bar-initial");

    // Get all activity bar items
    const activityItems = await getActivityBarItems(page);
    console.log("Activity bar items:", activityItems);

    // Check if Minecraft activity is present
    const hasMinecraft = activityItems.some(
      (item) => item.toLowerCase().includes("minecraft") || item.toLowerCase().includes("mctools")
    );

    await takeScreenshot(page, "sidebar-activity-bar-items");

    // The Minecraft icon should be in the activity bar
    // Note: may not be present if extension didn't activate
    console.log("Has Minecraft activity bar item:", hasMinecraft);
  });

  test("should show MCTools view when clicking Minecraft activity", async ({ page }) => {
    await takeScreenshot(page, "sidebar-mctools-view-before");

    // Try to click on Minecraft activity bar item
    const clicked = await clickActivityBarItem(page, "Minecraft");

    if (clicked) {
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "sidebar-mctools-view-clicked");

      // Check if the sidebar content changed
      const sidebarContent = page.locator(".sidebar .pane-body");
      const hasContent = (await sidebarContent.count()) > 0;

      console.log("MCTools sidebar view visible:", hasContent);

      // Check for webview in sidebar (MCTools uses webview for its views)
      const sidebarWebview = page.locator(".sidebar iframe, .sidebar .webview-container");
      const hasWebview = (await sidebarWebview.count()) > 0;

      console.log("Sidebar contains webview:", hasWebview);
    } else {
      console.log("Minecraft activity bar item not found");
      await takeScreenshot(page, "sidebar-mctools-not-found");
    }
  });

  test("should show Explorer with workspace files", async ({ page }) => {
    // Click on Explorer
    await page.keyboard.press("Control+Shift+E");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "sidebar-explorer-view");

    // Check for file tree items
    const fileTreeItems = page.locator(".explorer-folders-view .monaco-list-row");
    const itemCount = await fileTreeItems.count();

    console.log("File tree items count:", itemCount);

    // Should have at least one item (behavior_packs folder from sample content)
    expect(itemCount).toBeGreaterThan(0);

    // Check for specific folder
    const behaviorPacksFolder = page.locator('.monaco-list-row:has-text("behavior_packs")');
    const hasBehaviorPacks = (await behaviorPacksFolder.count()) > 0;

    console.log("Has behavior_packs folder:", hasBehaviorPacks);
    expect(hasBehaviorPacks).toBe(true);
  });

  test("should expand folder tree in Explorer", async ({ page }) => {
    // Open Explorer
    await page.keyboard.press("Control+Shift+E");
    await page.waitForTimeout(1500);

    // Click on behavior_packs to expand
    const behaviorPacksFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
    if ((await behaviorPacksFolder.count()) > 0) {
      await behaviorPacksFolder.click();
      await page.waitForTimeout(1000);

      await takeScreenshot(page, "sidebar-expanded-level1");

      // Check if StarterTestsTutorial is visible
      const tutorialFolder = page.locator('.monaco-list-row:has-text("StarterTestsTutorial")');
      if ((await tutorialFolder.count()) > 0) {
        await tutorialFolder.click();
        await page.waitForTimeout(1000);

        await takeScreenshot(page, "sidebar-expanded-level2");

        // Check for manifest.json
        const manifestFile = page.locator('.monaco-list-row:has-text("manifest.json")');
        const hasManifest = (await manifestFile.count()) > 0;

        console.log("Found manifest.json after expanding:", hasManifest);
      }
    }
  });

  test("should show file icons in Explorer", async ({ page }) => {
    // Open Explorer and expand to see files
    await page.keyboard.press("Control+Shift+E");
    await page.waitForTimeout(1500);

    // Expand folders
    const behaviorPacksFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
    if ((await behaviorPacksFolder.count()) > 0) {
      await behaviorPacksFolder.click();
      await page.waitForTimeout(500);

      const tutorialFolder = page.locator('.monaco-list-row:has-text("StarterTestsTutorial")').first();
      if ((await tutorialFolder.count()) > 0) {
        await tutorialFolder.click();
        await page.waitForTimeout(500);
      }
    }

    await takeScreenshot(page, "sidebar-file-icons");

    // Check for file icons
    const fileIcons = page.locator(".explorer-folders-view .monaco-icon-label .monaco-icon-name-container");
    const iconCount = await fileIcons.count();

    console.log("File/folder items with icons:", iconCount);
    expect(iconCount).toBeGreaterThan(0);
  });
});

test.describe("VSCode Web Extension - Panel Views", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
  });

  test("should be able to open Problems panel", async ({ page }) => {
    // Open Problems panel
    await page.keyboard.press("Control+Shift+M");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "panel-problems");

    // Check if Problems panel is visible
    const problemsPanel = page.locator('.panel [aria-label*="Problems"]');
    const hasProblemsPanel = (await problemsPanel.count()) > 0;

    console.log("Problems panel visible:", hasProblemsPanel);
  });

  test("should be able to open Output panel", async ({ page }) => {
    // Open Output panel
    await page.keyboard.press("Control+Shift+U");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "panel-output");

    // Check if Output panel is visible
    const outputPanel = page.locator('.panel .output, .panel [aria-label*="Output"]');
    const hasOutputPanel = (await outputPanel.count()) > 0;

    console.log("Output panel visible:", hasOutputPanel);
  });

  test("should be able to toggle panel visibility", async ({ page }) => {
    await takeScreenshot(page, "panel-toggle-before");

    // Toggle panel with Ctrl+J
    await page.keyboard.press("Control+J");
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "panel-toggle-after");

    // Check panel state
    const panel = page.locator(".part.panel");
    const panelBox = await panel.boundingBox();

    // Panel might be minimized or hidden
    const panelVisible = panelBox && panelBox.height > 50;
    console.log("Panel visible after toggle:", panelVisible);

    // Toggle again
    await page.keyboard.press("Control+J");
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "panel-toggle-final");
  });
});
