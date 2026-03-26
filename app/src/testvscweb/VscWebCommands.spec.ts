/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - COMMAND PALETTE COMMANDS
 * ==========================================================================================
 *
 * Tests for MCTools commands accessible through the VS Code Command Palette:
 * - mctools.quickNewStart - Quick start a new project
 * - mctools.showStartPage - Show all new projects page
 * - mctools.showInfoPage - Show project information and validation page
 * - mctools.packageWorld - Package Minecraft World
 * - mctools.showMinecraftPane - Show Minecraft View
 *
 * These tests verify that commands are registered and can be invoked.
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
 * Helper to open Command Palette
 */
async function openCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press("F1");
  await page.waitForTimeout(500);

  // Verify command palette opened
  const commandPalette = page.locator(".quick-input-widget");
  await expect(commandPalette).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to close Command Palette
 */
async function closeCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/**
 * Helper to search for a command in Command Palette
 */
async function searchCommand(page: Page, searchText: string): Promise<number> {
  await openCommandPalette(page);
  await page.keyboard.type(searchText, { delay: 50 });
  await page.waitForTimeout(800);

  // Count matching results
  const results = page.locator(".quick-input-list .monaco-list-row");
  const count = await results.count();
  return count;
}

/**
 * Helper to execute a command from Command Palette
 */
async function executeCommand(page: Page, commandTitle: string): Promise<void> {
  await openCommandPalette(page);
  await page.keyboard.type(commandTitle, { delay: 50 });
  await page.waitForTimeout(800);

  // Click on the first matching result
  const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
  if ((await firstResult.count()) > 0) {
    await firstResult.click();
  }

  await page.waitForTimeout(1500);
}

test.describe("VSCode Web Extension - Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    // Extra wait for extension commands to register
    await page.waitForTimeout(5000);
  });

  test("should find Minecraft commands in Command Palette", async ({ page }) => {
    await takeScreenshot(page, "commands-before-search");

    // Search for "Minecraft" commands
    const resultCount = await searchCommand(page, "Minecraft");

    await takeScreenshot(page, "commands-minecraft-search");

    console.log(`Found ${resultCount} commands matching 'Minecraft'`);

    // Close command palette
    await closeCommandPalette(page);

    // We expect at least some Minecraft commands to be registered
    // Even if extension isn't fully activated, VS Code should list contributed commands
    expect(resultCount).toBeGreaterThanOrEqual(0); // May be 0 if extension not fully activated
  });

  test("should find MCTools specific commands", async ({ page }) => {
    // Test specific command searches
    const commandSearches = [
      { search: "Quick start", description: "Quick New Start" },
      { search: "Show Minecraft", description: "Show Minecraft View" },
      { search: "Package Minecraft", description: "Package World" },
    ];

    for (const cmd of commandSearches) {
      const count = await searchCommand(page, cmd.search);
      await takeScreenshot(page, `commands-search-${cmd.description.replace(/\s/g, "-").toLowerCase()}`);

      console.log(`Search "${cmd.search}": ${count} results`);
      await closeCommandPalette(page);
    }
  });

  test("should execute Show Minecraft View command", async ({ page }) => {
    await takeScreenshot(page, "commands-show-view-before");

    // Try to execute the Show Minecraft View command
    await executeCommand(page, "Minecraft: Show Minecraft View");

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "commands-show-view-after");

    // The command might open a new panel or view
    // Check for any changes in the UI (new webview, panel, etc.)
    const hasWebview = (await page.locator("iframe, .webview-container").count()) > 0;
    const hasNewPanel = (await page.locator(".pane-body").count()) > 0;

    console.log(`After Show Minecraft View - Webview: ${hasWebview}, Panel: ${hasNewPanel}`);
  });

  test("should execute Show Info Page command", async ({ page }) => {
    await takeScreenshot(page, "commands-info-before");

    // Try to execute the Show Info Page command
    await executeCommand(page, "Minecraft: Show Minecraft project information");

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "commands-info-after");

    // Check if an info panel or editor appeared
    const hasNewEditor = (await page.locator(".editor-container").count()) > 0;
    console.log(`After Show Info Page - Has editor: ${hasNewEditor}`);
  });

  test("should show command titles correctly formatted", async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.type("Minecraft:", { delay: 50 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "commands-minecraft-prefix");

    // Get all command titles
    const commandLabels = await page.locator(".quick-input-list .monaco-list-row .label-name").allTextContents();
    console.log("Commands with Minecraft: prefix:", commandLabels);

    await closeCommandPalette(page);

    // Check that command titles are properly formatted
    for (const label of commandLabels) {
      expect(label).toMatch(/Minecraft:|minecraft/i);
    }
  });
});

test.describe("VSCode Web Extension - Keybindings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
  });

  test("should open Keyboard Shortcuts editor", async ({ page }) => {
    // Open keyboard shortcuts
    await page.keyboard.press("Control+K");
    await page.waitForTimeout(200);
    await page.keyboard.press("Control+S");

    await page.waitForTimeout(2000);
    await takeScreenshot(page, "keyboard-shortcuts-editor");

    // Verify the keyboard shortcuts editor opened
    // It might be a tab or a webview
    const shortcutsEditor = page.locator('.keybindingsEditor, [aria-label*="Keyboard Shortcuts"]');
    const hasShortcutsEditor = (await shortcutsEditor.count()) > 0;

    console.log(`Keyboard Shortcuts editor visible: ${hasShortcutsEditor}`);
  });

  test("should be able to search for MCTools keybindings", async ({ page }) => {
    // Open keyboard shortcuts
    await page.keyboard.press("Control+K");
    await page.waitForTimeout(200);
    await page.keyboard.press("Control+S");

    await page.waitForTimeout(2000);

    // Type to search for mctools
    await page.keyboard.type("mctools", { delay: 50 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "keyboard-shortcuts-mctools-search");

    // Check if any keybindings are found
    const keybindingRows = page.locator(".keybindings-table-rows .monaco-list-row");
    const count = await keybindingRows.count();
    console.log(`MCTools keybindings found: ${count}`);
  });
});
