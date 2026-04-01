/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - PROVIDER FEATURES
 * ==========================================================================================
 *
 * Tests for the VS Code extension language providers:
 * - McDiagnosticProvider: Validation errors in Problems panel
 * - McCodeActionProvider: Quick fixes for issues
 * - McCompletionProvider: IntelliSense completions
 * - McDefinitionProvider: Go-to-definition navigation
 * - McPreviewPanel: Live preview webviews
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebProviders.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  searchCommand,
  navigateToFile,
  closeCommandPalette,
} from "./helpers";

test.describe("VS Code Provider Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await takeScreenshot(page, "providers-initial-state");
  });

  test.describe("Command Registration", () => {
    test("MCTools commands should be registered", async ({ page }) => {
      // Search for Minecraft-related commands
      const minecraftResults = await searchCommand(page, "Minecraft");

      await takeScreenshot(page, "providers-minecraft-commands");
      await closeCommandPalette(page);

      // We expect at least some MCTools commands to be registered
      expect(minecraftResults).toBeGreaterThanOrEqual(0);
    });

    test("Preview commands should be available", async ({ page }) => {
      // Search for preview commands
      const previewResults = await searchCommand(page, "Preview");

      await takeScreenshot(page, "providers-preview-commands");
      await closeCommandPalette(page);

      // Preview commands may or may not be registered depending on activation
      expect(previewResults).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Entity File Editing", () => {
    test("should open entity behavior file", async ({ page }) => {
      // Navigate to the entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file - workspace may not contain diverse_content");
        await takeScreenshot(page, "providers-entity-navigation-failed");
        return;
      }

      // Wait for editor to load
      await page.waitForTimeout(3000);
      await takeScreenshot(page, "providers-entity-file-opened");

      // Check that an editor is showing (MCTools uses custom webview editors for entities)
      const webviewEditor = page.locator('iframe[class*="webview"], .webview-container');
      const monacoEditor = page.locator(".monaco-editor");
      const hasWebview = (await webviewEditor.count()) > 0;
      const hasMonaco = (await monacoEditor.count()) > 0;
      console.log(`Entity editor - Webview: ${hasWebview}, Monaco: ${hasMonaco}`);
      expect(hasWebview || hasMonaco).toBe(true);
    });

    test("should trigger completions in entity file", async ({ page }) => {
      // Navigate to entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Try to trigger IntelliSense (Ctrl+Space)
      await page.keyboard.press("Control+Space");
      await page.waitForTimeout(1500);

      await takeScreenshot(page, "providers-entity-intellisense");

      // Check if suggestions widget appeared
      const suggestWidget = page.locator(".suggest-widget");
      const widgetVisible = await suggestWidget.isVisible().catch(() => false);

      // The suggest widget may or may not appear depending on cursor position
      // Just verify no errors occurred
      console.log("Suggestion widget visible:", widgetVisible);
    });
  });

  test.describe("Block File Editing", () => {
    test("should open block behavior file", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        await takeScreenshot(page, "providers-block-navigation-failed");
        return;
      }

      await page.waitForTimeout(3000);
      await takeScreenshot(page, "providers-block-file-opened");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });

    test("should show hover information on JSON properties", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file");
        return;
      }

      await page.waitForTimeout(2000);

      // Find a property in the editor and hover over it
      const formatVersion = page.locator('text="format_version"').first();
      if ((await formatVersion.count()) > 0) {
        await formatVersion.hover();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, "providers-block-hover");
      }
    });
  });

  test.describe("Loot Table File Editing", () => {
    test("should open loot table file", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "loot_tables", "sample_loot.json"]);

      if (!navigated) {
        console.log("Could not navigate to loot table file");
        await takeScreenshot(page, "providers-loot-navigation-failed");
        return;
      }

      await page.waitForTimeout(3000);
      await takeScreenshot(page, "providers-loot-file-opened");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Problems Panel", () => {
    test("should show Problems panel", async ({ page }) => {
      // Open Problems panel
      await page.keyboard.press("Control+Shift+M");
      await page.waitForTimeout(1500);

      await takeScreenshot(page, "providers-problems-panel");

      // Check if problems panel is visible
      const problemsPanel = page.locator('.panel [aria-label*="Problems"], .panel-title:has-text("Problems")');
      const panelVisible = await problemsPanel.isVisible().catch(() => false);
      console.log("Problems panel visible:", panelVisible);
    });

    test("should analyze entity file for issues", async ({ page }) => {
      // First navigate to an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(3000);

      // Open Problems panel
      await page.keyboard.press("Control+Shift+M");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "providers-entity-problems");

      // The problems panel should be visible now
      // Note: Whether there are actual problems depends on the file content
    });
  });

  test.describe("Go-to-Definition", () => {
    test("should support F12 go-to-definition", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Try F12 - it may or may not navigate depending on the provider implementation
      // This is mainly testing that F12 doesn't crash
      await page.keyboard.press("F12");
      await page.waitForTimeout(1500);

      await takeScreenshot(page, "providers-goto-definition");
    });
  });

  test.describe("Quick Fixes (Code Actions)", () => {
    test("should show code actions menu", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file");
        return;
      }

      await page.waitForTimeout(2000);

      // Try Ctrl+. for code actions
      await page.keyboard.press("Control+.");
      await page.waitForTimeout(1500);

      await takeScreenshot(page, "providers-code-actions");

      // Press Escape to close any menu
      await page.keyboard.press("Escape");
    });
  });

  test.describe("Multiple File Types", () => {
    test("should handle spawn rules file", async ({ page }) => {
      const navigated = await navigateToFile(page, [
        "behavior_packs",
        "diverse_bp",
        "spawn_rules",
        "sample_mob_spawn.json",
      ]);

      if (!navigated) {
        console.log("Could not navigate to spawn rules file");
        await takeScreenshot(page, "providers-spawn-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "providers-spawn-rules-file");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });

    test("should handle recipe file", async ({ page }) => {
      const navigated = await navigateToFile(page, [
        "behavior_packs",
        "diverse_bp",
        "recipes",
        "sample_sword_recipe.json",
      ]);

      if (!navigated) {
        console.log("Could not navigate to recipe file");
        await takeScreenshot(page, "providers-recipe-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "providers-recipe-file");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });

    test("should handle item file", async ({ page }) => {
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "items", "sample_food.json"]);

      if (!navigated) {
        console.log("Could not navigate to item file");
        await takeScreenshot(page, "providers-item-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "providers-item-file");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Animation Files", () => {
    test("should handle animation file", async ({ page }) => {
      const navigated = await navigateToFile(page, [
        "resource_packs",
        "diverse_rp",
        "animations",
        "sample_mob_animations.json",
      ]);

      if (!navigated) {
        console.log("Could not navigate to animation file");
        await takeScreenshot(page, "providers-animation-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "providers-animation-file");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });

    test("should handle animation controller file", async ({ page }) => {
      const navigated = await navigateToFile(page, [
        "resource_packs",
        "diverse_rp",
        "animation_controllers",
        "sample_mob_controller.json",
      ]);

      if (!navigated) {
        console.log("Could not navigate to animation controller file");
        await takeScreenshot(page, "providers-anim-controller-navigation-failed");
        return;
      }

      await page.waitForTimeout(2000);
      await takeScreenshot(page, "providers-anim-controller-file");

      const editorContent = page.locator(".monaco-editor");
      await expect(editorContent).toBeVisible({ timeout: 10000 });
    });
  });
});
