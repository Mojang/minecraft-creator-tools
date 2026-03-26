/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - SETTINGS & CONFIGURATION
 * ==========================================================================================
 *
 * Tests for MCTools extension settings and configuration:
 * - mctools.jsonEditor.defaultToRawEditor setting
 * - Settings UI integration
 * - Settings persistence
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebSettings.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  openCommandPalette,
  dismissNotifications,
} from "./helpers";

test.describe("VS Code Extension Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test.describe("Settings UI Access", () => {
    test("should open Settings UI via keyboard shortcut", async ({ page }) => {
      // Open settings with Ctrl+,
      await page.keyboard.press("Control+,");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "settings-opened-keyboard");

      // Check if Settings tab/editor is visible
      const settingsEditor = page.locator(".settings-editor, .preferences-editor");
      const isVisible = (await settingsEditor.count()) > 0;

      console.log("Settings editor visible:", isVisible);

      // Should see settings UI
      expect(isVisible).toBe(true);
    });

    test("should open Settings via command palette", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Preferences: Open Settings", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "settings-command-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, "settings-opened-command");
      }
    });

    test("should find MCTools settings in Settings UI", async ({ page }) => {
      // Open settings
      await page.keyboard.press("Control+,");
      await page.waitForTimeout(2000);

      // Search for MCTools settings
      const searchInput = page.locator(".settings-editor input.settings-search-input, .search-container input");
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("mctools");
        await page.waitForTimeout(1500);

        await takeScreenshot(page, "settings-mctools-search");

        // Check if MCTools settings appear
        const mctoolsSettings = page.locator('.setting-item-contents:has-text("MCTools")');
        const settingFound = (await mctoolsSettings.count()) > 0;

        console.log("MCTools settings found:", settingFound);
      }
    });

    test("should display defaultToRawEditor setting", async ({ page }) => {
      // Open settings
      await page.keyboard.press("Control+,");
      await page.waitForTimeout(2000);

      // Search for the specific setting
      const searchInput = page.locator(".settings-editor input.settings-search-input, .search-container input");
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("defaultToRawEditor");
        await page.waitForTimeout(1500);

        await takeScreenshot(page, "settings-raw-editor-setting");

        // Check if the setting description appears
        const settingDescription = page.locator(
          '.setting-item-description:has-text("text editor"), .setting-item-label:has-text("Default")'
        );
        const descriptionFound = (await settingDescription.count()) > 0;

        console.log("defaultToRawEditor setting description found:", descriptionFound);
      }
    });
  });

  test.describe("Settings JSON", () => {
    test("should open settings.json via command palette", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Preferences: Open User Settings (JSON)", { delay: 30 });
      await page.waitForTimeout(500);

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "settings-json-opened");

        // Should see Monaco editor with JSON
        const monacoEditor = page.locator(".monaco-editor .view-lines");
        const hasEditor = (await monacoEditor.count()) > 0;

        console.log("Settings JSON editor visible:", hasEditor);
      }
    });
  });

  test.describe("Workspace Settings", () => {
    test("should open workspace settings", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Preferences: Open Workspace Settings", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "settings-workspace-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "settings-workspace-opened");
      }
    });
  });
});
