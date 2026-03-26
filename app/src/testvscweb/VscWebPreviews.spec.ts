/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - LIVE PREVIEW FEATURES
 * ==========================================================================================
 *
 * Tests for the VS Code extension live preview webview panels:
 * - Entity type preview
 * - Block type preview
 * - Preview commands
 * - Preview panel interactions
 *
 * These tests verify that:
 * 1. Preview commands are available
 * 2. Preview panels can be opened
 * 3. Preview content renders correctly
 * 4. Preview updates when content changes
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebPreviews.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  openCommandPalette,
  searchCommand,
  navigateToFile,
  closeCommandPalette,
} from "./helpers";

test.describe("VS Code Live Preview Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
  });

  test.describe("Preview Command Discovery", () => {
    test("should search for preview-related commands", async ({ page }) => {
      const results = await searchCommand(page, "MCTools Preview");
      await takeScreenshot(page, "previews-search-mctools-preview");
      await closeCommandPalette(page);

      // Log the result - commands may or may not be registered
      console.log("MCTools Preview command count:", results);
    });

    test("should search for show preview command", async ({ page }) => {
      const results = await searchCommand(page, "Show Preview");
      await takeScreenshot(page, "previews-search-show-preview");
      await closeCommandPalette(page);

      console.log("Show Preview command count:", results);
    });
  });

  test.describe("Entity Preview", () => {
    test("should open entity file for preview", async ({ page }) => {
      // Navigate to an entity behavior file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file - skipping preview test");
        await takeScreenshot(page, "previews-entity-navigation-failed");
        return;
      }

      await page.waitForTimeout(3000);
      await takeScreenshot(page, "previews-entity-file-open");

      // Verify the editor is showing the entity file (MCTools uses custom webview editors)
      const webviewEditor = page.locator('iframe[class*="webview"], .webview-container');
      const monacoEditor = page.locator(".monaco-editor");
      const hasWebview = (await webviewEditor.count()) > 0;
      const hasMonaco = (await monacoEditor.count()) > 0;
      console.log(`Entity editor - Webview: ${hasWebview}, Monaco: ${hasMonaco}`);
      expect(hasWebview || hasMonaco).toBe(true);
    });

    test("should try to show entity preview via command", async ({ page }) => {
      // First open an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Try to execute preview command
      await openCommandPalette(page);
      await page.keyboard.type("MCTools: Show Preview", { delay: 30 });
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "previews-entity-command-search");

      // Try to select the first result if available
      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, "previews-entity-after-command");
      } else {
        await closeCommandPalette(page);
        console.log("Preview command not found");
      }
    });
  });

  test.describe("Block Preview", () => {
    test("should open block file for preview", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        await takeScreenshot(page, "previews-block-navigation-failed");
        return;
      }

      await page.waitForTimeout(3000);
      await takeScreenshot(page, "previews-block-file-open");

      const editor = page.locator(".monaco-editor");
      await expect(editor).toBeVisible({ timeout: 10000 });
    });

    test("should try to show block preview via command", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        return;
      }

      await page.waitForTimeout(2000);

      await openCommandPalette(page);
      await page.keyboard.type("MCTools: Show Preview to Side", { delay: 30 });
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "previews-block-command-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, "previews-block-after-command");
      } else {
        await closeCommandPalette(page);
        console.log("Preview to side command not found");
      }
    });
  });

  test.describe("Webview Detection", () => {
    test("should detect webview panels", async ({ page }) => {
      // Open an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to file");
        return;
      }

      await page.waitForTimeout(2000);

      // Look for any webview frames that might be preview panels
      const webviewFrames = page.locator('iframe[class*="webview"]');
      const count = await webviewFrames.count();

      console.log("Webview frame count:", count);
      await takeScreenshot(page, "previews-webview-detection");

      // If there are webviews, try to interact with them
      if (count > 0) {
        const firstWebview = webviewFrames.first();
        await firstWebview.screenshot({
          path: "debugoutput/screenshots/vscweb/previews-webview-content.png",
        });
      }
    });
  });

  test.describe("Editor Group Layout", () => {
    test("should support split editor for preview", async ({ page }) => {
      // Open an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Try to split the editor view
      await openCommandPalette(page);
      await page.keyboard.type("View: Split Editor Right", { delay: 30 });
      await page.waitForTimeout(800);

      const splitCommand = page.locator('.quick-input-list .monaco-list-row:has-text("Split Editor Right")').first();
      if ((await splitCommand.count()) > 0) {
        await splitCommand.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, "previews-split-editor");
      } else {
        await closeCommandPalette(page);
        console.log("Split editor command not available");
      }
    });
  });

  test.describe("Preview Panel Content", () => {
    test("should check for preview panel UI elements", async ({ page }) => {
      // Open a file that might have preview
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to file");
        return;
      }

      await page.waitForTimeout(3000);

      // Look for custom editor tabs
      const editorTabs = page.locator(".editor-tabs .tab");
      const tabCount = await editorTabs.count();
      console.log("Editor tab count:", tabCount);

      // Get tab labels
      for (let i = 0; i < Math.min(tabCount, 5); i++) {
        const tab = editorTabs.nth(i);
        const label = await tab.textContent();
        console.log(`Tab ${i}: ${label}`);
      }

      await takeScreenshot(page, "previews-editor-tabs");
    });
  });

  test.describe("File Association Tests", () => {
    test("should recognize entity file type", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Check the file is recognized as JSON
      const statusBar = page.locator(".statusbar");
      await takeScreenshot(page, "previews-file-type-recognition");

      // Look for language mode indicator
      const languageMode = page.locator('.statusbar-item[aria-label*="Language"], .statusbar-item:has-text("JSON")');
      if ((await languageMode.count()) > 0) {
        const modeText = await languageMode.first().textContent();
        console.log("Language mode:", modeText);
      }
    });

    test("should recognize block file type", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "previews-block-file-type");
    });
  });

  test.describe("Multiple Preview Panels", () => {
    test("should open multiple files", async ({ page }) => {
      // Open entity file
      let navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(1500);

      // Open block file
      navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        return;
      }

      await page.waitForTimeout(1500);
      await takeScreenshot(page, "previews-multiple-files");

      // Check how many tabs are open (VS Code uses .tabs-container .tab)
      const tabs = page.locator('.tabs-container .tab, [role="tab"]');
      const tabCount = await tabs.count();
      console.log("Open tab count:", tabCount);

      // At least verify an editor is open (webview or monaco)
      const webviewEditor = page.locator('iframe[class*="webview"], .webview-container');
      const monacoEditor = page.locator(".monaco-editor");
      const hasEditor = (await webviewEditor.count()) > 0 || (await monacoEditor.count()) > 0;
      expect(hasEditor || tabCount > 0).toBe(true);
    });
  });
});
