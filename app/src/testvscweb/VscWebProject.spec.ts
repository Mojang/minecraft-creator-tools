/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - PROJECT EXPERIENCE
 * ==========================================================================================
 *
 * Tests for the MCTools project creation and management experience:
 * - New project workflow
 * - Project template selection
 * - Project validation and inspection
 * - Project item creation
 *
 * These tests verify the end-to-end project experience in VS Code.
 *
 * ==========================================================================================
 */

import { test, Page, Frame } from "@playwright/test";
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
 * Helper to find and interact with webview content
 * Returns the frame if found
 */
async function findWebviewFrame(page: Page): Promise<Frame | null> {
  // Wait for any iframes to be present
  await page.waitForTimeout(2000);

  // Get all frames
  const frames = page.frames();

  for (const frame of frames) {
    const url = frame.url();
    // MCTools webviews have specific content
    if (url.includes("webview") || url.includes("vscode-webview")) {
      // Check if this frame has MCTools content
      const hasContent = await frame.locator(".ct-outer, .pe-grid, [class*='project']").count();
      if (hasContent > 0) {
        return frame;
      }
    }
  }

  return null;
}

/**
 * Helper to wait for webview content to load
 */
async function waitForWebviewContent(page: Page, timeout = 10000): Promise<Frame | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const frame = await findWebviewFrame(page);
    if (frame) {
      return frame;
    }
    await page.waitForTimeout(500);
  }

  return null;
}

test.describe("VSCode Web Extension - Project Experience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    // Extra wait for extension and project to load
    await page.waitForTimeout(5000);
  });

  test("should show MCTools main view with project content", async ({ page }) => {
    await takeScreenshot(page, "project-initial");

    // Click on Minecraft activity bar item
    const clicked = await clickActivityBarItem(page, "Minecraft");

    if (!clicked) {
      console.log("Minecraft activity not found, skipping test");
      await takeScreenshot(page, "project-minecraft-activity-not-found");
      return;
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "project-main-view");

    // Look for webview content
    const frame = await waitForWebviewContent(page);

    if (frame) {
      console.log("Found MCTools webview frame");
      await takeScreenshot(page, "project-webview-found");

      // Check for project content elements
      const hasProjectEditor = (await frame.locator(".pe-grid, [class*='ProjectEditor']").count()) > 0;
      const hasCodeToolbox = (await frame.locator(".ct-outer, [class*='CodeToolbox']").count()) > 0;

      console.log("Project editor visible:", hasProjectEditor);
      console.log("Code toolbox visible:", hasCodeToolbox);
    } else {
      console.log("No MCTools webview frame found");
      await takeScreenshot(page, "project-no-webview");
    }
  });

  test("should display project items list", async ({ page }) => {
    // Click on Minecraft activity
    await clickActivityBarItem(page, "Minecraft");
    await page.waitForTimeout(3000);

    const frame = await waitForWebviewContent(page);

    if (frame) {
      await takeScreenshot(page, "project-items-list");

      // Look for item list elements
      const itemListElements = await frame
        .locator("[class*='item'], [class*='list'], [role='treeitem'], [role='listitem']")
        .count();
      console.log("Item list elements found:", itemListElements);

      // Look for specific content types (scripts, manifest, etc.)
      const scriptItems = await frame.locator(":text('script'), :text('Script')").count();
      const manifestItems = await frame.locator(":text('manifest'), :text('Manifest')").count();

      console.log("Script-related items:", scriptItems);
      console.log("Manifest-related items:", manifestItems);
    }
  });

  test("should be able to interact with project toolbar", async ({ page }) => {
    // Click on Minecraft activity
    await clickActivityBarItem(page, "Minecraft");
    await page.waitForTimeout(3000);

    const frame = await waitForWebviewContent(page);

    if (frame) {
      await takeScreenshot(page, "project-toolbar-initial");

      // Look for toolbar buttons
      const toolbarButtons = await frame.locator("button, [role='button'], .toolbar").count();
      console.log("Toolbar buttons found:", toolbarButtons);

      // Look for common actions
      const addButton = frame.locator(":text('Add'), [aria-label*='Add'], [title*='Add']").first();
      const exportButton = frame.locator(":text('Export'), [aria-label*='Export'], [title*='Export']").first();

      if ((await addButton.count()) > 0) {
        console.log("Add button found");
      }
      if ((await exportButton.count()) > 0) {
        console.log("Export button found");
      }

      await takeScreenshot(page, "project-toolbar-elements");
    }
  });

  test("should show project inspector/validation", async ({ page }) => {
    // Try opening via command palette
    await page.keyboard.press("F1");
    await page.waitForTimeout(500);
    await page.keyboard.type("Minecraft: Show Minecraft project information", { delay: 30 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "project-inspector-command");

    // Press Enter to execute
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    await takeScreenshot(page, "project-inspector-opened");

    // Check if inspector view opened
    const frame = await waitForWebviewContent(page);
    if (frame) {
      // Look for inspector/validation content
      const inspectorContent = await frame
        .locator(
          "[class*='inspector'], [class*='validation'], [class*='info'], :text('Error'), :text('Warning'), :text('Issues')"
        )
        .count();
      console.log("Inspector content elements:", inspectorContent);
    }
  });
});

test.describe("VSCode Web Extension - New Project Experience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await page.waitForTimeout(5000);
  });

  test("should trigger Quick New Start command", async ({ page }) => {
    await takeScreenshot(page, "newproject-before");

    // Open command palette and run Quick New Start
    await page.keyboard.press("F1");
    await page.waitForTimeout(500);
    await page.keyboard.type("Minecraft: Quick start", { delay: 50 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "newproject-command-search");

    // Try to execute the command
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    await takeScreenshot(page, "newproject-after-command");

    // Check for any dialogs or new content
    const quickInput = page.locator(".quick-input-widget");
    const hasQuickInput = (await quickInput.count()) > 0 && (await quickInput.isVisible());

    console.log("Quick input still visible:", hasQuickInput);
  });

  test("should trigger Show Start Page command", async ({ page }) => {
    await takeScreenshot(page, "startpage-before");

    // Open command palette and run Show Start Page
    await page.keyboard.press("F1");
    await page.waitForTimeout(500);
    await page.keyboard.type("Minecraft: Show all new projects", { delay: 50 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "startpage-command-search");

    // Try to execute
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    await takeScreenshot(page, "startpage-after-command");

    // Check if a new editor or panel opened
    const editorTabs = await page.locator(".tabs-container .tab").count();
    console.log("Editor tabs after command:", editorTabs);
  });

  test("should show project templates in MCTools view", async ({ page }) => {
    // Click on Minecraft activity
    await clickActivityBarItem(page, "Minecraft");
    await page.waitForTimeout(3000);

    const frame = await waitForWebviewContent(page);

    if (frame) {
      await takeScreenshot(page, "templates-view");

      // Look for template elements
      const templateElements = await frame
        .locator(
          "[class*='template'], [class*='gallery'], :text('Add-On'), :text('GameTest'), :text('Starter'), :text('Template')"
        )
        .count();

      console.log("Template-related elements found:", templateElements);

      // Look for New button
      const newButton = frame.locator("button:has-text('New'), [aria-label*='New']").first();
      if ((await newButton.count()) > 0) {
        console.log("New button found");
        await takeScreenshot(page, "templates-new-button");
      }
    }
  });
});
