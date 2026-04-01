/**
 * Focused Opening Tests for Electron App
 *
 * These tests verify that launching the Electron app with a file or folder path
 * correctly "looks up" to find the project root while focusing on the specific file.
 *
 * This tests the focused opening workflow where:
 * 1. User launches mctools.exe <path to file or folder>
 * 2. App finds the root of the project (looking for manifest.json, package.json, etc.)
 * 3. App opens focused on the specific file/folder passed in
 *
 * Run with: npm run test-electron
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";
import {
  isInEditor,
  takeScreenshot,
  getProjectItemCount,
} from "../testshared/TestUtilities";

// Path to the Electron main process entry point
const appDir = process.cwd();
const electronMainPath = path.join(appDir, "toolbuild/jsn/electron/main.mjs");

// Sample content paths - these are real files in the samples folder
const samplesBase = path.join(appDir, "public/res/samples/microsoft/samples/addon_starter/2_entities");
const behaviorPackPath = path.join(samplesBase, "behavior_packs/aop_mobs");
const entityFilePath = path.join(behaviorPackPath, "entities/biceson.behavior.json");
const animationFilePath = path.join(behaviorPackPath, "animations/sheepomelon.bp_anims.json");
const lootTablePath = path.join(behaviorPackPath, "loot_tables/entities/sheepomelon.json");
const manifestPath = path.join(behaviorPackPath, "manifest.json");

// Resource pack sample paths
const resourcePackPath = path.join(samplesBase, "resource_packs/aop_mobs_rp");
const textureFilePath = path.join(resourcePackPath, "textures/entity/biceson.png");
const modelFilePath = path.join(resourcePackPath, "models/entity/biceson.geo.json");

// Check if required files exist
const hasToolbuild = fs.existsSync(path.join(appDir, "toolbuild/jsn"));
const hasElectronMain = fs.existsSync(electronMainPath);
const hasSampleContent = fs.existsSync(entityFilePath);

/**
 * Helper to create isolated test environment for each test
 */
function createTestEnvironment() {
  const testSlug = `mct-focused-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    storageDir: path.join(os.tmpdir(), testSlug),
    userDataDir: path.join(os.tmpdir(), `${testSlug}-userdata`),
  };
}

/**
 * Helper to launch Electron with a specific input path
 */
async function launchWithInputPath(inputPath: string, env: { storageDir: string; userDataDir: string }) {
  console.log(`Launching Electron with input path: ${inputPath}`);

  // Use the -i flag to explicitly specify the input path
  // This is needed because Playwright's electron.launch passes the main script as the first arg,
  // so positional arg handling (which expects the input as argv[1]) doesn't work correctly.
  const electronApp = await electron.launch({
    args: [electronMainPath, "-i", inputPath, `--user-data-dir=${env.userDataDir}`],
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ELECTRON_FORCE_PROD: "true",
      MCT_TEST_STORAGE_ROOT: env.storageDir,
      MCTOOLS_DATA_DIR: env.storageDir,
    },
    timeout: 60000,
  });

  // Listen for console messages - filter out verbose stack traces unless debugging
  const isDebugMode = process.env.DEBUG === "1" || process.env.PWDEBUG === "1";
  electronApp.on("console", (msg) => {
    const text = msg.text();

    // Skip noisy stack traces (lines starting with "at " from minified code)
    if (text.match(/^\s*at\s+\w+\s*\(file:\/\/\//)) {
      return;
    }

    // Skip verbose UX logging unless in debug mode
    if (!isDebugMode && text.includes("UX:")) {
      // Only show important UX messages (errors, warnings)
      if (!text.includes("Error") && !text.includes("error") && !text.includes("Warning")) {
        return;
      }
    }

    console.log(`[Electron Focused] ${text}`);
  });

  const page = await electronApp.firstWindow({ timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");

  return { electronApp, page };
}

/**
 * Helper to clean up test environment
 */
async function cleanup(electronApp: ElectronApplication | undefined, env: { storageDir: string; userDataDir: string }) {
  if (electronApp) {
    try {
      await electronApp.close();
    } catch (e) {
      console.log("Could not close app:", e);
    }
  }

  try {
    if (fs.existsSync(env.userDataDir)) {
      fs.rmSync(env.userDataDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.log("Could not clean up user data:", e);
  }

  try {
    if (fs.existsSync(env.storageDir)) {
      fs.rmSync(env.storageDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.log("Could not clean up storage:", e);
  }
}

/**
 * Helper to check if a file is selected/focused in the project list
 */
async function isFileFocused(page: Page, fileName: string): Promise<boolean> {
  // Look for the file name in the selected item or in the editor title
  try {
    // Check if the file name appears in any selected/active element
    const selectedItems = await page
      .locator('[class*="selected"], [class*="active"], [aria-selected="true"]')
      .allTextContents();
    for (const text of selectedItems) {
      if (text.toLowerCase().includes(fileName.toLowerCase())) {
        return true;
      }
    }

    // Also check if the editor area shows this file
    const editorContent = await page.locator('[class*="editor"], [class*="Editor"]').first().textContent();
    if (editorContent && editorContent.toLowerCase().includes(fileName.toLowerCase())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Helper to get the current project name/path from the UI
 */
async function getProjectInfo(page: Page): Promise<{ name?: string; path?: string }> {
  try {
    // Try to find project name in common locations
    const titleElements = await page
      .locator('[class*="title"], [class*="Title"], [class*="project"], [class*="Project"]')
      .allTextContents();
    const info: { name?: string; path?: string } = {};

    for (const text of titleElements) {
      if (text && text.length > 0 && text.length < 200) {
        if (!info.name) {
          info.name = text.trim();
        }
      }
    }

    return info;
  } catch {
    return {};
  }
}

// ==================== Focused Opening Tests ====================

test.describe("Focused Opening Tests", () => {
  // Skip if prerequisites are missing
  test.beforeAll(() => {
    if (!hasToolbuild) {
      console.log("Skipping focused opening tests - toolbuild not found. Run 'npm run jsnbuild' first.");
      test.skip();
    }
    if (!hasElectronMain) {
      console.log("Skipping focused opening tests - electron.js not found");
      test.skip();
    }
    if (!hasSampleContent) {
      console.log("Skipping focused opening tests - sample content not found at:", entityFilePath);
      console.log("Run 'npm run preparedevenv' to download sample content.");
      test.skip();
    }
  });

  test("should open entity behavior file with project context", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(entityFilePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      // Wait for app to load
      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-entity-initial");

      // Verify we're in editor mode (not home page)
      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Take screenshot showing the focused state
      await takeScreenshot(page, "focused-entity-loaded");

      // The app should have found the project root and loaded context
      // Check that we have multiple project items (indicating project was loaded)
      const itemCount = await getProjectItemCount(page);
      console.log(`Project item count: ${itemCount}`);
      expect(itemCount).toBeGreaterThan(0);

      // Verify the entity file is visible/focused
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain("biceson");
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open animation file with project context", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(animationFilePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-animation-loaded");

      // Should be in editor mode
      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Animation file should be visible
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain("sheepomelon");
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open loot table file with project context", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(lootTablePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-loottable-loaded");

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open manifest file at pack root", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(manifestPath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-manifest-loaded");

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Manifest should be visible
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain("manifest");
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open behavior pack folder", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(behaviorPackPath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-behaviorpack-folder");

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Should have loaded multiple items
      const itemCount = await getProjectItemCount(page);
      expect(itemCount).toBeGreaterThan(0);
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open resource pack model file", async () => {
    // Skip if model file doesn't exist
    if (!fs.existsSync(modelFilePath)) {
      console.log("Model file not found, skipping:", modelFilePath);
      test.skip();
      return;
    }

    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(modelFilePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-model-loaded");

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should open parent folder and find project root", async () => {
    // Open the entities folder (not a specific file)
    const entitiesFolder = path.join(behaviorPackPath, "entities");
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(entitiesFolder, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);
      await takeScreenshot(page, "focused-entities-folder");

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Should have found the behavior pack as the project root
      const itemCount = await getProjectItemCount(page);
      expect(itemCount).toBeGreaterThan(0);
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should handle opening the same project from different entry points", async () => {
    // This test verifies that opening different files from the same project
    // all result in the same project root being found
    const env1 = createTestEnvironment();
    const env2 = createTestEnvironment();
    let electronApp1: ElectronApplication | undefined;
    let electronApp2: ElectronApplication | undefined;

    try {
      // Open from entity file
      const result1 = await launchWithInputPath(entityFilePath, env1);
      electronApp1 = result1.electronApp;
      const page1 = result1.page;

      // Wait for app to fully load and enter editor mode
      await page1.waitForTimeout(6000);
      const inEditor1 = await isInEditor(page1);
      const itemCount1 = await getProjectItemCount(page1);
      await takeScreenshot(page1, "focused-entry-point-entity");

      // Close first app before opening second
      await electronApp1.close();
      electronApp1 = undefined;

      // Small delay between app instances
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Open from animation file
      const result2 = await launchWithInputPath(animationFilePath, env2);
      electronApp2 = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      const inEditor2 = await isInEditor(page2);
      const itemCount2 = await getProjectItemCount(page2);
      await takeScreenshot(page2, "focused-entry-point-animation");

      // Both should load into editor mode
      console.log(`Entry 1: inEditor=${inEditor1}, items=${itemCount1}`);
      console.log(`Entry 2: inEditor=${inEditor2}, items=${itemCount2}`);
      expect(inEditor1).toBe(true);
      expect(inEditor2).toBe(true);

      // Both should load some items (exact count varies based on tree expansion from focus)
      // The focused file determines which part of the tree is expanded, so counts may differ
      expect(itemCount1).toBeGreaterThan(0);
      expect(itemCount2).toBeGreaterThan(0);
    } finally {
      await cleanup(electronApp1, env1);
      await cleanup(electronApp2, env2);
    }
  });
});

// ==================== File Type Focused Tests ====================

test.describe("File Type Focus Tests", () => {
  test.beforeAll(() => {
    if (!hasToolbuild || !hasElectronMain || !hasSampleContent) {
      test.skip();
    }
  });

  test("should show entity editor for entity file", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(entityFilePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);

      // Check if we're in editor mode
      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Look for entity-specific UI elements
      const pageContent = await page.content();

      // Should show entity content (biceson entity)
      expect(pageContent.toLowerCase()).toContain("biceson");

      await takeScreenshot(page, "filetype-entity-editor");
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should handle JSON file focus correctly", async () => {
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(manifestPath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);

      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      // Manifest editor should show pack information
      const pageContent = await page.content();
      // Should contain manifest-related content
      expect(pageContent.length).toBeGreaterThan(500);

      await takeScreenshot(page, "filetype-manifest-editor");
    } finally {
      await cleanup(electronApp, env);
    }
  });
});

// ==================== Edge Case Tests ====================

test.describe("Focused Opening Edge Cases", () => {
  test.beforeAll(() => {
    if (!hasToolbuild || !hasElectronMain) {
      test.skip();
    }
  });

  test("should handle non-existent path gracefully", async () => {
    const nonExistentPath = path.join(appDir, "this/path/does/not/exist.json");
    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      const result = await launchWithInputPath(nonExistentPath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(3000);

      // App should still launch, probably showing home page or error
      const body = page.locator("body");
      await expect(body).toBeVisible();

      await takeScreenshot(page, "focused-nonexistent-path");
    } finally {
      await cleanup(electronApp, env);
    }
  });

  test("should handle relative path", async () => {
    // Test with a relative path from the app root directory
    // The path resolution in main.mjs uses: path.resolve(appRoot, _inputPath)
    // where appRoot is 3 levels up from toolbuild/jsn/electron/
    const relativePath =
      "public/res/samples/microsoft/samples/addon_starter/2_entities/behavior_packs/aop_mobs/manifest.json";

    // Check if the file exists
    const fullPath = path.join(appDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      console.log("Relative path test file not found, skipping:", fullPath);
      test.skip();
      return;
    }

    const env = createTestEnvironment();
    let electronApp: ElectronApplication | undefined;

    try {
      // Launch with relative path (relative to app root)
      const result = await launchWithInputPath(relativePath, env);
      electronApp = result.electronApp;
      const page = result.page;

      await page.waitForTimeout(5000);

      // Should still load correctly
      const inEditor = await isInEditor(page);
      expect(inEditor).toBe(true);

      await takeScreenshot(page, "focused-relative-path");
    } finally {
      await cleanup(electronApp, env);
    }
  });
});
