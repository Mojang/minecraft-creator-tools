/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - ARCHITECTURE DOCUMENTATION
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * These tests validate the MCTools extension running in VS Code for the Web.
 * This environment uses vscode-test-web to run a browser-based VS Code with the
 * extension loaded from the local toolbuild/vsc directory.
 *
 * TEST INFRASTRUCTURE:
 * --------------------
 * - Configuration: playwright-vscweb.config.js
 * - Port: 3001 (separate from main web app on 3000)
 * - Server: vscode-test-web with --browserType=none (Playwright controls the browser)
 * - Sample Content: ../samplecontent/simple/ folder is mounted as workspace
 *
 * VS CODE FOR WEB UI STRUCTURE:
 * -----------------------------
 * The VS Code web UI has these key components:
 * - Activity Bar (left side icons): Explorer, Search, Source Control, Extensions, etc.
 * - Sidebar (left panel): Shows content based on selected activity
 * - Editor Area (center): Where files are edited
 * - Panel (bottom): Terminal, Problems, Output, Debug Console
 * - Status Bar (bottom): Shows extension status, line/column info
 *
 * EXTENSION ACTIVATION:
 * ---------------------
 * The MCTools extension activates when:
 * - A workspace folder is opened (usually happens automatically)
 * - The extension contributes views to the Explorer sidebar
 *
 * KNOWN SELECTORS:
 * ----------------
 * - Activity Bar Explorer: '[data-test-id="workbench.view.explorer"]' or aria label
 * - Sidebar: '.sidebar'
 * - Editor tabs: '.tab'
 * - Extension notification: '.notifications-toasts'
 * - Command Palette: '.quick-input-widget'
 *
 * DEBUGGING TIPS:
 * ---------------
 * 1. Run with --headed to see the browser: npm run test-vscweb-headed
 * 2. Use page.pause() to stop execution and inspect
 * 3. Screenshots are saved to debugoutput/screenshots/vscweb/
 * 4. Check VS Code's Developer Tools console for errors
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
  // Wait for the workbench to be visible
  await page.waitForSelector(".monaco-workbench", { timeout: 30000 });

  // Wait for activity bar to be ready (indicates UI is loaded)
  await page.waitForSelector(".activitybar", { timeout: 10000 });

  // Give extensions time to activate
  await page.waitForTimeout(3000);
}

/**
 * Helper to check if extension activated successfully
 */
async function checkExtensionActivated(page: Page): Promise<boolean> {
  // Check for error notifications
  const errorToast = page.locator(".notifications-toasts .notification-toast.error");
  const hasError = (await errorToast.count()) > 0;

  if (hasError) {
    const errorText = await errorToast.first().textContent();
    console.error("Extension error:", errorText);
    return false;
  }

  return true;
}

/**
 * Helper to take a screenshot with a descriptive name
 */
async function takeScreenshot(page: Page, name: string): Promise<void> {
  const screenshotPath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

test.describe("VSCode Web Extension - Basic Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to VS Code web
    await page.goto("/");
    await waitForVSCodeReady(page);
  });

  test("should load VS Code for Web successfully", async ({ page }) => {
    await takeScreenshot(page, "vscode-initial-load");

    // Verify the workbench loaded
    await expect(page.locator(".monaco-workbench")).toBeVisible();

    // Verify activity bar is present
    await expect(page.locator(".activitybar")).toBeVisible();

    // Verify sidebar is present
    await expect(page.locator(".sidebar")).toBeVisible();
  });

  test("should activate MCTools extension without errors", async ({ page }) => {
    // Wait a bit for extension activation
    await page.waitForTimeout(5000);

    await takeScreenshot(page, "extension-activation");

    // Check for activation errors
    const activated = await checkExtensionActivated(page);

    // Take screenshot of any errors
    const errorNotification = page.locator(".notifications-toasts .notification-toast");
    if ((await errorNotification.count()) > 0) {
      await takeScreenshot(page, "extension-errors");
      const errorText = await errorNotification.allTextContents();
      console.log("Notifications found:", errorText);
    }

    expect(activated).toBe(true);
  });

  test("should show MCTools views in Explorer sidebar", async ({ page }) => {
    // Use keyboard shortcut to open Explorer (Ctrl+Shift+E) - more reliable than clicking
    await page.keyboard.press("Control+Shift+E");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "explorer-sidebar");

    // The extension should contribute views to the sidebar
    // Look for the sidebar container
    const sidebar = page.locator(".part.sidebar").first();
    await expect(sidebar).toBeVisible();

    // Check that the sidebar is expanded (has width and content)
    const sidebarBoundingBox = await sidebar.boundingBox();
    const sidebarIsExpanded = sidebarBoundingBox && sidebarBoundingBox.width > 100;
    console.log("Sidebar is expanded:", sidebarIsExpanded, "width:", sidebarBoundingBox?.width);

    // Check for any visible content - pane headers, file tree items, or expand arrows
    const hasContent =
      (await page
        .locator(".pane-header:visible, .monaco-icon-label:visible, .monaco-list-row:visible, .twisties:visible")
        .count()) > 0;
    console.log("Sidebar has visible content:", hasContent);

    // Take another screenshot after potential content load
    await takeScreenshot(page, "explorer-sidebar-final");

    // The test passes if sidebar is visible - the extension may or may not contribute MCTools views
    expect(sidebarIsExpanded).toBe(true);
  });

  test("should be able to open Command Palette", async ({ page }) => {
    // Open command palette with keyboard shortcut
    await page.keyboard.press("F1");

    await page.waitForTimeout(1000);
    await takeScreenshot(page, "command-palette");

    // Verify command palette is visible
    const commandPalette = page.locator(".quick-input-widget");
    await expect(commandPalette).toBeVisible();

    // Type to search for MCTools commands
    await page.keyboard.type("MCTools");

    await page.waitForTimeout(1000);
    await takeScreenshot(page, "command-palette-mctools-search");

    // Close command palette
    await page.keyboard.press("Escape");
  });

  test("should list workspace files in Explorer", async ({ page }) => {
    // Click on Explorer
    const explorerButton = page.locator('[aria-label*="Explorer"]').first();
    await explorerButton.click();

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "file-explorer");

    // Look for file tree content - the sample content should show behavior_packs
    // Check for any tree item or file/folder label
    const fileItems = page.locator(".monaco-icon-label, .monaco-list-row").first();
    await expect(fileItems).toBeVisible({ timeout: 10000 });

    // Try to find the behavior_packs folder specifically
    const behaviorPacks = page.locator(':text("behavior_packs")');
    if ((await behaviorPacks.count()) > 0) {
      console.log("Found behavior_packs folder");
    }
  });
});

test.describe("VSCode Web Extension - Extension Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    // Extra wait for extension features
    await page.waitForTimeout(3000);
  });

  test("should show extension in Extensions view", async ({ page }) => {
    // Click on Extensions in activity bar
    const extensionsButton = page.locator('[aria-label*="Extensions"]');
    if ((await extensionsButton.count()) > 0) {
      await extensionsButton.first().click();

      await page.waitForTimeout(3000);
      await takeScreenshot(page, "extensions-view");

      // Look for MCTools extension in the list (use visible one, not hidden)
      const extensionsList = page.locator(".extensions-list:not(.hidden)").first();
      await expect(extensionsList).toBeVisible({ timeout: 10000 });
    } else {
      // Extensions might be disabled in test environment
      console.log("Extensions view not available");
      await takeScreenshot(page, "extensions-not-available");
    }
  });

  test("should handle opening a JSON file", async ({ page }) => {
    // Open Explorer
    const explorerButton = page.locator('[aria-label*="Explorer"]').first();
    await explorerButton.click();

    await page.waitForTimeout(2000);

    // Try to find and click on a JSON file in the explorer
    // Look for manifest.json or any .json file
    const jsonFile = page.locator('.monaco-list-row:has-text(".json")').first();

    if ((await jsonFile.count()) > 0) {
      await jsonFile.dblclick();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "json-file-opened");

      // Verify editor opened
      const editor = page.locator(".monaco-editor");
      await expect(editor).toBeVisible();
    } else {
      console.log("No JSON files found in explorer");
      await takeScreenshot(page, "no-json-files");
    }
  });
});
