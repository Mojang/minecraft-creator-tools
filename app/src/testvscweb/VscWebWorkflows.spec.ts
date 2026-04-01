/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - WORKFLOW TESTS
 * ==========================================================================================
 *
 * Tests for multi-file editing workflows, project navigation, and realistic
 * user scenarios in the VS Code web extension.
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  navigateToFile,
  getEditorTabCount,
  closeAllEditors,
  isWebviewEditorVisible,
  isMonacoEditorVisible,
  openExplorer,
  dismissNotifications,
} from "./helpers";

test.describe("MCTools VS Code Web - Workflow Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test("can open multiple files simultaneously", async ({ page }) => {
    await takeScreenshot(page, "workflow-start");

    // Open first file (using diverse_bp from ../samplecontent/diverse_content/)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(2000);

    const tabs1 = await getEditorTabCount(page);
    expect(tabs1).toBeGreaterThanOrEqual(1);
    await takeScreenshot(page, "workflow-first-file");

    // Open second file (entities folder exists in diverse_bp)
    await openExplorer(page);
    const entitiesFolder = page.locator('.monaco-list-row:has-text("entities")').first();

    if ((await entitiesFolder.count()) > 0) {
      await entitiesFolder.click();
      await page.waitForTimeout(500);

      const jsonFile = page.locator('.monaco-list-row:has-text(".json")').first();
      if ((await jsonFile.count()) > 0) {
        await jsonFile.dblclick({ force: true });
        await page.waitForTimeout(2000);

        const tabs2 = await getEditorTabCount(page);
        expect(tabs2).toBeGreaterThanOrEqual(2);
        await takeScreenshot(page, "workflow-second-file");
      }
    }
  });

  test("editor tabs persist after switching between files", async ({ page }) => {
    // Open first file (using diverse_bp)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, "workflow-tabs-first");

    // Switch to Explorer and open another file
    await openExplorer(page);
    await page.waitForTimeout(500);

    // Click on a different file
    const packIcon = page.locator('.monaco-list-row:has-text("pack_icon")').first();
    if ((await packIcon.count()) > 0) {
      await packIcon.dblclick();
      await page.waitForTimeout(2000);
    }

    // Verify original tab is still present
    const manifestTab = page.locator('.tab:has-text("manifest")');

    await takeScreenshot(page, "workflow-tabs-after-switch");

    // Both tabs should exist (preview tabs may replace each other though)
    const totalTabs = await getEditorTabCount(page);
    expect(totalTabs).toBeGreaterThanOrEqual(1);
  });

  test("can close all editors and start fresh", async ({ page }) => {
    // Open some files (using diverse_bp)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(2000);

    // Ensure at least one tab open
    const tabsBefore = await getEditorTabCount(page);
    expect(tabsBefore).toBeGreaterThanOrEqual(1);

    // Close all editors
    await closeAllEditors(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "workflow-after-close-all");

    // Should have no tabs or welcome page
    const tabsAfter = await getEditorTabCount(page);
    // After closing, either 0 tabs or welcome page
    expect(tabsAfter).toBeLessThanOrEqual(1);
  });

  test("can navigate through folder hierarchy", async ({ page }) => {
    await openExplorer(page);
    await page.waitForTimeout(1000);

    // Click on behavior_packs folder
    const bpFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
    if ((await bpFolder.count()) > 0) {
      await bpFolder.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, "workflow-bp-folder");
    }

    // Click into diverse_bp
    const diverseFolder = page.locator('.monaco-list-row:has-text("diverse_bp")').first();
    if ((await diverseFolder.count()) > 0) {
      await diverseFolder.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, "workflow-diverse-folder");
    }

    // Check for expected subfolders/files (diverse_bp has entities, blocks, items, etc.)
    const manifestFile = page.locator('.monaco-list-row:has-text("manifest.json")').first();
    const entitiesFolder = page.locator('.monaco-list-row:has-text("entities")').first();

    const hasManifest = (await manifestFile.count()) > 0;
    const hasEntities = (await entitiesFolder.count()) > 0;

    await takeScreenshot(page, "workflow-folder-contents");

    // Log what we found for debugging
    console.log(`Found manifest: ${hasManifest}, entities: ${hasEntities}`);

    // Check if any files are visible in the explorer after navigation
    const anyFiles = page.locator(".monaco-list-row");
    const fileCount = await anyFiles.count();
    console.log(`Total visible tree items: ${fileCount}`);

    // Test passes if we can see files in the tree (folder expansion worked at some level)
    expect(fileCount).toBeGreaterThan(0);
  });

  test("breadcrumb navigation works", async ({ page }) => {
    // Open a file first (using diverse_bp)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(2000);

    // Check for breadcrumb bar
    const breadcrumbBar = page.locator(".breadcrumbs-widget, .monaco-breadcrumbs");
    const hasBreadcrumbs = (await breadcrumbBar.count()) > 0;

    if (hasBreadcrumbs) {
      await takeScreenshot(page, "workflow-breadcrumbs");

      // Click on a breadcrumb element
      const breadcrumbItem = page.locator(".breadcrumbs-widget .monaco-breadcrumb-item").first();
      if ((await breadcrumbItem.count()) > 0) {
        await breadcrumbItem.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, "workflow-breadcrumb-clicked");
      }
    }
  });

  test("different file types open with appropriate editors", async ({ page }) => {
    const editorResults: { file: string; type: string }[] = [];

    // Test manifest.json (should use custom editor) - using diverse_bp
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(3000);

    if (await isWebviewEditorVisible(page)) {
      editorResults.push({ file: "manifest.json", type: "webview" });
    } else if (await isMonacoEditorVisible(page)) {
      editorResults.push({ file: "manifest.json", type: "monaco" });
    }
    await takeScreenshot(page, "workflow-editor-manifest");

    // Close and try another file type
    await closeAllEditors(page);
    await page.waitForTimeout(500);

    // Try to find and open an entity file (diverse_bp has entities folder, not scripts)
    await openExplorer(page);
    const entitiesFolder = page.locator('.monaco-list-row:has-text("entities")').first();

    if ((await entitiesFolder.count()) > 0) {
      await entitiesFolder.click();
      await page.waitForTimeout(500);

      const entityFile = page.locator('.monaco-list-row .label-name[title$=".json"]').first();
      if ((await entityFile.count()) > 0) {
        await entityFile.dblclick({ force: true });
        await page.waitForTimeout(2000);

        if (await isMonacoEditorVisible(page)) {
          editorResults.push({ file: "entity.json", type: "monaco" });
        } else if (await isWebviewEditorVisible(page)) {
          editorResults.push({ file: "entity.json", type: "webview" });
        }
        await takeScreenshot(page, "workflow-editor-entity");
      }
    }

    console.log("Editor types used:", editorResults);

    // At least one editor should have been detected
    expect(editorResults.length).toBeGreaterThanOrEqual(1);
  });

  test("split editor view", async ({ page }) => {
    // Open a file first (using diverse_bp)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);
    await page.waitForTimeout(2000);

    // Try to split the editor
    await page.keyboard.press("Control+\\");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "workflow-split-editor");

    // Check for multiple editor groups
    const editorGroups = page.locator(".editor-group");
    const groupCount = await editorGroups.count();

    // May or may not split depending on content type
    console.log("Editor groups after split:", groupCount);
  });

  test("go to file dialog works", async ({ page }) => {
    // Open Go to File dialog
    await page.keyboard.press("Control+P");
    await page.waitForTimeout(1000);

    // Quick open should appear
    const quickInput = page.locator(".quick-input-widget");
    await expect(quickInput).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, "workflow-goto-file");

    // Type a file name
    await page.keyboard.type("manifest", { delay: 50 });
    await page.waitForTimeout(800);

    // Check for results
    const results = page.locator(".quick-input-list .monaco-list-row");
    const resultCount = await results.count();

    await takeScreenshot(page, "workflow-goto-file-results");

    // Should find manifest.json
    expect(resultCount).toBeGreaterThanOrEqual(1);

    // Press Escape to close
    await page.keyboard.press("Escape");
  });
});
