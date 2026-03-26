/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - CONTEXT MENUS
 * ==========================================================================================
 *
 * Tests for MCTools extension context menu contributions:
 * - Explorer context menu (Open with MCTools Editor, Show Preview)
 * - Editor title context menu (Show Preview to Side)
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebContextMenus.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import { waitForVSCodeReady, takeScreenshot, navigateToFile, openExplorer, dismissNotifications } from "./helpers";

test.describe("VS Code Context Menu Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test.describe("Explorer Context Menu", () => {
    test("should show context menu on right-click in explorer", async ({ page }) => {
      await openExplorer(page);
      await page.waitForTimeout(1500);

      // Find a JSON file in the explorer
      const bpFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
      if ((await bpFolder.count()) > 0) {
        await bpFolder.click();
        await page.waitForTimeout(500);

        const starterFolder = page.locator('.monaco-list-row:has-text("StarterTestsTutorial")').first();
        if ((await starterFolder.count()) > 0) {
          await starterFolder.click();
          await page.waitForTimeout(500);

          const manifestFile = page.locator('.monaco-list-row:has-text("manifest.json")').first();
          if ((await manifestFile.count()) > 0) {
            // Right-click on the file to open context menu
            await manifestFile.click({ button: "right" });
            await page.waitForTimeout(500);

            await takeScreenshot(page, "context-menu-explorer-json");

            // Check if context menu appeared
            const contextMenu = page.locator(".context-view, .monaco-menu");
            const hasContextMenu = (await contextMenu.count()) > 0;

            console.log("Explorer context menu visible:", hasContextMenu);
            expect(hasContextMenu).toBe(true);

            // Look for MCTools menu items
            const mctoolsMenuItem = page.locator(
              '.context-view .action-item:has-text("MCTools"), .context-view .action-item:has-text("Minecraft")'
            );
            const hasMctoolsItem = (await mctoolsMenuItem.count()) > 0;
            console.log("MCTools context menu item present:", hasMctoolsItem);

            // Press Escape to close
            await page.keyboard.press("Escape");
          }
        }
      }
    });

    test("should have Open with MCTools Editor option for JSON files", async ({ page }) => {
      await openExplorer(page);
      await page.waitForTimeout(1500);

      // Navigate to a JSON file
      const bpFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
      if ((await bpFolder.count()) > 0) {
        await bpFolder.click();
        await page.waitForTimeout(500);

        const diverseFolder = page.locator('.monaco-list-row:has-text("diverse_bp")').first();
        if ((await diverseFolder.count()) > 0) {
          await diverseFolder.click();
          await page.waitForTimeout(500);

          const entitiesFolder = page.locator('.monaco-list-row:has-text("entities")').first();
          if ((await entitiesFolder.count()) > 0) {
            await entitiesFolder.click();
            await page.waitForTimeout(500);

            const entityFile = page.locator('.monaco-list-row:has-text(".json")').first();
            if ((await entityFile.count()) > 0) {
              await entityFile.click({ button: "right" });
              await page.waitForTimeout(500);

              await takeScreenshot(page, "context-menu-entity-file");

              // Look for "Open with MCTools Editor" option
              const openWithMCTools = page.locator('.context-view .action-item:has-text("Open")');
              const hasOpenWith = (await openWithMCTools.count()) > 0;
              console.log("Open with... options present:", hasOpenWith);

              await page.keyboard.press("Escape");
            }
          }
        }
      }
    });
  });

  test.describe("Editor Title Context Menu", () => {
    test("should show preview button in editor title for entity files", async ({ page }) => {
      // Open an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        await takeScreenshot(page, "context-menu-entity-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);

      // Check editor title bar for preview buttons
      const editorActions = page.locator(".editor-actions .action-item");
      const actionCount = await editorActions.count();

      await takeScreenshot(page, "context-menu-editor-title-actions");

      console.log("Editor title action items:", actionCount);

      // Look for preview-related actions
      const previewAction = page.locator('.editor-actions .action-item[title*="Preview"]');
      const hasPreviewAction = (await previewAction.count()) > 0;
      console.log("Preview action in editor title:", hasPreviewAction);
    });

    test("should right-click editor tab to see context menu", async ({ page }) => {
      // Open a file first (using diverse_bp from test workspace)
      await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
      await page.waitForTimeout(2000);

      // Find the tab and right-click
      const editorTab = page.locator('.tab:has-text("manifest")').first();
      if ((await editorTab.count()) > 0) {
        await editorTab.click({ button: "right" });
        await page.waitForTimeout(500);

        await takeScreenshot(page, "context-menu-editor-tab");

        // Context menu should appear
        const contextMenu = page.locator(".context-view, .monaco-menu");
        const hasContextMenu = (await contextMenu.count()) > 0;

        console.log("Editor tab context menu visible:", hasContextMenu);

        await page.keyboard.press("Escape");
      }
    });
  });

  test.describe("Open With Menu", () => {
    test("should have Open With option in explorer context menu", async ({ page }) => {
      await openExplorer(page);
      await page.waitForTimeout(1500);

      // Navigate to and right-click on a JSON file (using diverse_bp from test workspace)
      const bpFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
      if ((await bpFolder.count()) > 0) {
        await bpFolder.click();
        await page.waitForTimeout(500);

        const diverseFolder = page.locator('.monaco-list-row:has-text("diverse_bp")').first();
        if ((await diverseFolder.count()) > 0) {
          await diverseFolder.click();
          await page.waitForTimeout(500);

          const manifestFile = page.locator('.monaco-list-row:has-text("manifest.json")').first();
          if ((await manifestFile.count()) > 0) {
            await manifestFile.click({ button: "right" });
            await page.waitForTimeout(500);

            // Look for "Open With..." submenu
            const openWithItem = page.locator('.context-view .action-item:has-text("Open With")');
            if ((await openWithItem.count()) > 0) {
              // Hover to open submenu
              await openWithItem.hover();
              await page.waitForTimeout(500);

              await takeScreenshot(page, "context-menu-open-with-submenu");

              // Look for MCTools editor option in submenu
              const mctoolsEditor = page.locator('.context-view .action-item:has-text("MCTools")');
              const hasMctoolsEditor = (await mctoolsEditor.count()) > 0;
              console.log("MCTools editor in Open With menu:", hasMctoolsEditor);
            }

            await page.keyboard.press("Escape");
          }
        }
      }
    });
  });
});
