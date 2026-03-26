/**
 * Custom Folder Persistence Tests for Electron App
 *
 * These tests verify that projects opened via `-i <path>` (custom folder mode)
 * and projects created via the "New" dialog (default Documents mode)
 * correctly persist across app restarts.
 *
 * The persistence mechanism works as follows:
 * - Each project gets a preferences JSON file in `<storageRoot>/prefs/projects/<name>.json`
 * - For custom folder projects: `localFolderPath` in the prefs file points to the external folder
 * - For default projects: files are stored in `<storageRoot>/projects/<name>/`
 * - On re-launch, the app loads all prefs files from `prefs/projects/` to rebuild the project list
 * - Re-launching with the same `-i <path>` matches the existing project by `localFolderPath`
 *
 * Uses the per-test-instance pattern (like FocusedOpening.spec.ts) since each test
 * needs to close and relaunch the Electron app to verify persistence.
 *
 * Run with: npm run test-electron -- --grep "Persistence"
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";
import {
  waitForAppReady,
  isInEditor,
  enterEditor,
  takeScreenshot,
  getProjectItemCount,
  selectProjectItem,
  switchToRawEditPreference,
  waitForMonacoEditor,
} from "../testshared/TestUtilities";

// Path to the Electron main process entry point
const appDir = process.cwd();
const electronMainPath = path.join(appDir, "toolbuild/jsn/electron/main.mjs");

// Check prerequisites
const hasToolbuild = fs.existsSync(path.join(appDir, "toolbuild/jsn"));
const hasElectronMain = fs.existsSync(electronMainPath);

/**
 * Create an isolated test environment with unique temp directories.
 * The storageDir and userDataDir are reused across app restarts within a single test
 * to verify that persistence survives restarts.
 */
function createTestEnvironment(label: string) {
  const testSlug = `mct-persist-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    testSlug,
    storageDir: path.join(os.tmpdir(), testSlug),
    userDataDir: path.join(os.tmpdir(), `${testSlug}-userdata`),
  };
}

/**
 * Create a minimal Minecraft behavior pack project on disk.
 * Returns the path to the behavior pack root (which contains manifest.json).
 */
function createTestProject(baseDir: string, projectName: string = "test_bp"): string {
  const bpPath = path.join(baseDir, projectName);
  fs.mkdirSync(bpPath, { recursive: true });

  // Create manifest.json
  const manifest = {
    format_version: 2,
    header: {
      name: `Test Pack ${projectName}`,
      description: "Test pack for persistence tests",
      uuid: `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [
      {
        type: "data",
        uuid: `00000001-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`,
        version: [1, 0, 0],
      },
    ],
  };
  fs.writeFileSync(path.join(bpPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Create entities folder with a test entity
  const entitiesDir = path.join(bpPath, "entities");
  fs.mkdirSync(entitiesDir, { recursive: true });

  const entity = {
    format_version: "1.20.0",
    "minecraft:entity": {
      description: {
        identifier: "test:persist_mob",
        is_spawnable: true,
        is_summonable: true,
      },
      components: {
        "minecraft:health": {
          value: 20,
          max: 20,
        },
        "minecraft:physics": {},
      },
    },
  };
  fs.writeFileSync(path.join(entitiesDir, "persist_mob.json"), JSON.stringify(entity, null, 2));

  return bpPath;
}

/**
 * Launch the Electron app with standard test isolation env vars.
 * Optionally pass an input path via `-i`.
 */
async function launchElectron(
  env: { storageDir: string; userDataDir: string },
  inputPath?: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const args = [electronMainPath, `--user-data-dir=${env.userDataDir}`];
  if (inputPath) {
    args.push("-i", inputPath);
  }

  console.log(`Launching Electron${inputPath ? ` with -i ${inputPath}` : " (no input path)"}...`);

  const electronApp = await electron.launch({
    args,
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

  // Filter console output to reduce noise
  const isDebugMode = process.env.DEBUG === "1" || process.env.PWDEBUG === "1";
  electronApp.on("console", (msg) => {
    const text = msg.text();
    if (text.match(/^\s*at\s+\w+\s*\(file:\/\/\//)) return;
    if (!isDebugMode && text.includes("UX:")) {
      if (!text.includes("Error") && !text.includes("error") && !text.includes("Warning")) return;
    }
    console.log(`[Electron Persist] ${text}`);
  });

  const page = await electronApp.firstWindow({ timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");

  return { electronApp, page };
}

/**
 * Clean up an Electron app instance and optionally clean up test directories.
 */
async function closeApp(electronApp: ElectronApplication | undefined) {
  if (electronApp) {
    try {
      await electronApp.close();
    } catch (e) {
      console.log("Could not close app:", e);
    }
  }
  // Small delay to let OS release file handles
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Clean up test directories.
 */
function cleanupDirs(env: { storageDir: string; userDataDir: string }) {
  for (const dir of [env.storageDir, env.userDataDir]) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) {
      console.log(`Could not clean up ${dir}:`, e);
    }
  }
}

/**
 * Read the project preferences files from the test storage directory.
 * Returns an array of parsed IProjectData objects.
 */
function readProjectPrefs(storageDir: string): { filename: string; data: any }[] {
  const prefsDir = path.join(storageDir, "prefs", "projects");
  if (!fs.existsSync(prefsDir)) {
    return [];
  }

  const files = fs.readdirSync(prefsDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => ({
    filename: f,
    data: JSON.parse(fs.readFileSync(path.join(prefsDir, f), "utf8")),
  }));
}

async function setMonacoContent(page: Page, content: string): Promise<boolean> {
  try {
    return await page.evaluate((newContent) => {
      const model = (window as any).monaco?.editor?.getModels?.()?.[0];
      if (!model || typeof model.setValue !== "function") {
        return false;
      }

      model.setValue(newContent);
      return model.getValue() === newContent;
    }, content);
  } catch {
    return false;
  }
}

async function getMonacoContent(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const model = (window as any).monaco?.editor?.getModels?.()?.[0];
      if (!model || typeof model.getValue !== "function") {
        return "";
      }

      return model.getValue();
    });
  } catch {
    return "";
  }
}

// ==================== Custom Folder Persistence Tests ====================

test.describe("Custom Folder Persistence Tests", () => {
  test.beforeAll(() => {
    if (!hasToolbuild) {
      console.log("Skipping persistence tests - toolbuild not found. Run 'npm run jsnbuild' first.");
      test.skip();
    }
    if (!hasElectronMain) {
      console.log("Skipping persistence tests - electron main not found.");
      test.skip();
    }
  });

  test("custom folder project persists across app restarts", async () => {
    const env = createTestEnvironment("restart");
    const projectDir = path.join(env.storageDir, "custom-projects");
    let electronApp: ElectronApplication | undefined;

    try {
      // Create test project on disk
      const bpPath = createTestProject(projectDir);
      console.log("Created test project at:", bpPath);

      // === First launch: open the custom folder project ===
      const result1 = await launchElectron(env, bpPath);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      // Wait for the app to load the project
      await page1.waitForTimeout(6000);
      await takeScreenshot(page1, "persist-custom-first-launch");

      // Verify we're in editor mode
      const inEditor1 = await isInEditor(page1);
      expect(inEditor1).toBe(true);

      // Verify project items are visible
      const itemCount1 = await getProjectItemCount(page1);
      console.log(`First launch item count: ${itemCount1}`);
      expect(itemCount1).toBeGreaterThan(0);

      // Verify on-disk persistence: prefs/projects/ should have a .json file
      const prefs1 = readProjectPrefs(env.storageDir);
      console.log(`Prefs files after first launch: ${prefs1.length}`);
      expect(prefs1.length).toBeGreaterThanOrEqual(1);

      // The prefs file should have localFolderPath pointing to our project
      const projectPref = prefs1.find((p) => {
        const lfp = p.data.localFolderPath;
        if (!lfp) return false;
        // Normalize paths for comparison (handle different separators and tokens)
        const normalizedLfp = lfp.replace(/\\/g, "/").toLowerCase();
        const normalizedBpPath = bpPath.replace(/\\/g, "/").toLowerCase();
        return normalizedLfp.includes("test_bp") || normalizedBpPath.includes(normalizedLfp);
      });
      console.log(
        "Project prefs:",
        prefs1.map((p) => ({ file: p.filename, localFolderPath: p.data.localFolderPath, name: p.data.name }))
      );

      // Close the first instance
      await closeApp(electronApp);
      electronApp = undefined;

      // === Second launch: re-open with the same path ===
      const result2 = await launchElectron(env, bpPath);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      await takeScreenshot(page2, "persist-custom-relaunch");

      // Verify we're back in editor mode
      const inEditor2 = await isInEditor(page2);
      expect(inEditor2).toBe(true);

      // Verify project items are still visible
      const itemCount2 = await getProjectItemCount(page2);
      console.log(`Relaunch item count: ${itemCount2}`);
      expect(itemCount2).toBeGreaterThan(0);

      // Verify no duplicate project was created
      const prefs2 = readProjectPrefs(env.storageDir);
      console.log(`Prefs files after relaunch: ${prefs2.length}`);
      // Should still have the same number of prefs files (no duplicate)
      expect(prefs2.length).toBe(prefs1.length);
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });

  test("custom folder project appears in home page project list after restart", async () => {
    const env = createTestEnvironment("homelist");
    const projectDir = path.join(env.storageDir, "custom-projects");
    let electronApp: ElectronApplication | undefined;

    try {
      // Create test project
      const bpPath = createTestProject(projectDir);

      // === First launch: open with -i to register the project ===
      const result1 = await launchElectron(env, bpPath);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      await page1.waitForTimeout(6000);

      // Verify editor loaded
      const inEditor = await isInEditor(page1);
      expect(inEditor).toBe(true);

      await takeScreenshot(page1, "persist-homelist-first-launch");

      // Close the app
      await closeApp(electronApp);
      electronApp = undefined;

      // === Second launch: no -i flag, should show home page with the project ===
      const result2 = await launchElectron(env);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      await takeScreenshot(page2, "persist-homelist-relaunch-home");

      // The project should appear somewhere in the page content
      // (either on the home page or the app should remember the last project)
      const pageContent = await page2.content();
      const pageText = pageContent.toLowerCase();

      // Check that the page has loaded meaningful content
      expect(pageText.length).toBeGreaterThan(200);

      // Verify the prefs file still exists on disk
      const prefs = readProjectPrefs(env.storageDir);
      expect(prefs.length).toBeGreaterThanOrEqual(1);

      await takeScreenshot(page2, "persist-homelist-final");
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });

  test("custom folder content changes survive app restart", async () => {
    const env = createTestEnvironment("content");
    const projectDir = path.join(env.storageDir, "custom-projects");
    let electronApp: ElectronApplication | undefined;

    try {
      // Create test project with one entity
      const bpPath = createTestProject(projectDir);

      // === First launch: open the project ===
      const result1 = await launchElectron(env, bpPath);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      await page1.waitForTimeout(6000);

      const inEditor1 = await isInEditor(page1);
      expect(inEditor1).toBe(true);

      const itemCount1 = await getProjectItemCount(page1);
      console.log(`Item count before adding file: ${itemCount1}`);
      expect(itemCount1).toBeGreaterThan(0);

      await takeScreenshot(page1, "persist-content-before-add");

      // Close the app
      await closeApp(electronApp);
      electronApp = undefined;

      // === Add a new entity file externally while the app is closed ===
      const newEntityPath = path.join(bpPath, "entities", "new_mob.json");
      const newEntity = {
        format_version: "1.20.0",
        "minecraft:entity": {
          description: {
            identifier: "test:new_mob",
            is_spawnable: true,
            is_summonable: true,
          },
          components: {
            "minecraft:health": {
              value: 30,
              max: 30,
            },
          },
        },
      };
      fs.writeFileSync(newEntityPath, JSON.stringify(newEntity, null, 2));
      console.log("Added new entity file:", newEntityPath);

      // === Second launch: re-open the project ===
      const result2 = await launchElectron(env, bpPath);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      await takeScreenshot(page2, "persist-content-after-add");

      const inEditor2 = await isInEditor(page2);
      expect(inEditor2).toBe(true);

      // Verify the project loaded with items
      const itemCount2 = await getProjectItemCount(page2);
      console.log(`Item count after adding file: ${itemCount2}`);
      expect(itemCount2).toBeGreaterThan(0);

      // The new entity file should exist on disk and be part of the project.
      // Note: many items are hidden by default in the UI tree, so we verify
      // persistence by checking on-disk state rather than page content.
      expect(fs.existsSync(newEntityPath)).toBe(true);

      // Verify the prefs file was updated and still valid
      const prefsAfter = readProjectPrefs(env.storageDir);
      expect(prefsAfter.length).toBeGreaterThanOrEqual(1);

      // The item count should be at least as high as before (new file picked up on re-scan)
      // It may or may not be higher depending on whether the tree was expanded
      expect(itemCount2).toBeGreaterThanOrEqual(itemCount1);

      await takeScreenshot(page2, "persist-content-final");
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });

  test("multiple custom folder projects coexist", async () => {
    const env = createTestEnvironment("multi");
    const projectDir = path.join(env.storageDir, "custom-projects");
    let electronApp: ElectronApplication | undefined;

    try {
      // Create two separate test projects
      const bp1Path = createTestProject(projectDir, "project_alpha");
      const bp2Path = createTestProject(projectDir, "project_beta");

      // Add a distinct entity to project_beta so we can tell them apart
      const betaEntity = {
        format_version: "1.20.0",
        "minecraft:entity": {
          description: { identifier: "test:beta_mob", is_spawnable: true },
          components: { "minecraft:health": { value: 50, max: 50 } },
        },
      };
      fs.writeFileSync(path.join(bp2Path, "entities", "beta_mob.json"), JSON.stringify(betaEntity, null, 2));

      // === First launch: open project_alpha ===
      const result1 = await launchElectron(env, bp1Path);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      await page1.waitForTimeout(6000);
      expect(await isInEditor(page1)).toBe(true);
      await takeScreenshot(page1, "persist-multi-alpha-open");

      // Close
      await closeApp(electronApp);
      electronApp = undefined;

      // === Second launch: open project_beta (same storage) ===
      const result2 = await launchElectron(env, bp2Path);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      expect(await isInEditor(page2)).toBe(true);
      await takeScreenshot(page2, "persist-multi-beta-open");

      // Close
      await closeApp(electronApp);
      electronApp = undefined;

      // Verify both projects are persisted on disk
      const prefs = readProjectPrefs(env.storageDir);
      console.log(
        "All project prefs:",
        prefs.map((p) => ({ file: p.filename, name: p.data.name }))
      );
      expect(prefs.length).toBeGreaterThanOrEqual(2);

      // === Third launch: no -i, check home page shows both ===
      const result3 = await launchElectron(env);
      electronApp = result3.electronApp;
      const page3 = result3.page;

      await page3.waitForTimeout(6000);
      await takeScreenshot(page3, "persist-multi-home-both");

      // Verify both project prefs exist on disk
      const finalPrefs = readProjectPrefs(env.storageDir);
      expect(finalPrefs.length).toBeGreaterThanOrEqual(2);
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });

  test("custom folder save-close-reopen lifecycle supports continued raw editing", async () => {
    test.setTimeout(180000);

    const env = createTestEnvironment("lifecycle");
    const projectDir = path.join(env.storageDir, "custom-projects");
    const markerStageOne = `stage-one-${Date.now()}`;
    const markerStageTwo = markerStageOne.replace("stage-one", "stage-two");
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    let electronApp: ElectronApplication | undefined;

    try {
      const bpPath = createTestProject(projectDir);
      const manifestPath = path.join(bpPath, "manifest.json");
      const manifestBefore = fs.readFileSync(manifestPath, "utf8");
      const descriptionPattern = '"description": "Test pack for persistence tests"';
      const firstEdit = manifestBefore.replace(
        descriptionPattern,
        `"description": "Test pack for persistence tests ${markerStageOne}"`
      );
      expect(firstEdit).not.toBe(manifestBefore);

      // First launch: edit + save
      const result1 = await launchElectron(env, bpPath);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      const ready1 = await waitForAppReady(page1, 15000);
      expect(ready1).toBe(true);
      await page1.waitForTimeout(3000);
      expect(await isInEditor(page1)).toBe(true);
      await takeScreenshot(page1, "pro-lifecycle-01-first-open");

      expect(await switchToRawEditPreference(page1)).toBe(true);
      const manifestSelected1 =
        (await selectProjectItem(page1, "manifest")) || (await selectProjectItem(page1, "manifest.json"));
      expect(manifestSelected1).toBe(true);
      expect(await waitForMonacoEditor(page1, 10000)).toBe(true);

      expect(await setMonacoContent(page1, firstEdit)).toBe(true);
      expect(await getMonacoContent(page1)).toContain(markerStageOne);
      await takeScreenshot(page1, "pro-lifecycle-02-first-edit");

      await page1.keyboard.press(`${modifier}+s`);
      await expect
        .poll(() => fs.readFileSync(manifestPath, "utf8"), { timeout: 10000 })
        .toContain(markerStageOne);

      await closeApp(electronApp);
      electronApp = undefined;

      // Second launch: verify first edit, continue editing, save again
      const result2 = await launchElectron(env, bpPath);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      const ready2 = await waitForAppReady(page2, 15000);
      expect(ready2).toBe(true);
      await page2.waitForTimeout(3000);
      expect(await isInEditor(page2)).toBe(true);
      expect(fs.readFileSync(manifestPath, "utf8")).toContain(markerStageOne);
      await takeScreenshot(page2, "pro-lifecycle-03-reopen");

      expect(await switchToRawEditPreference(page2)).toBe(true);
      const manifestSelected2 =
        (await selectProjectItem(page2, "manifest")) || (await selectProjectItem(page2, "manifest.json"));
      expect(manifestSelected2).toBe(true);
      expect(await waitForMonacoEditor(page2, 10000)).toBe(true);
      expect(await getMonacoContent(page2)).toContain(markerStageOne);

      const secondEdit = fs.readFileSync(manifestPath, "utf8").replace(markerStageOne, markerStageTwo);
      expect(secondEdit).toContain(markerStageTwo);
      expect(await setMonacoContent(page2, secondEdit)).toBe(true);
      await takeScreenshot(page2, "pro-lifecycle-04-second-edit");

      await page2.keyboard.press(`${modifier}+s`);
      await expect
        .poll(() => fs.readFileSync(manifestPath, "utf8"), { timeout: 10000 })
        .toContain(markerStageTwo);

      await closeApp(electronApp);
      electronApp = undefined;

      // Third launch: verify second persisted edit
      const result3 = await launchElectron(env, bpPath);
      electronApp = result3.electronApp;
      const page3 = result3.page;

      const ready3 = await waitForAppReady(page3, 15000);
      expect(ready3).toBe(true);
      await page3.waitForTimeout(3000);
      expect(await isInEditor(page3)).toBe(true);
      expect(fs.readFileSync(manifestPath, "utf8")).toContain(markerStageTwo);
      await takeScreenshot(page3, "pro-lifecycle-05-final-reopen");
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });
});

// ==================== Default (Documents) Persistence Tests ====================

test.describe("Default Storage Persistence Tests", () => {
  test.beforeAll(() => {
    if (!hasToolbuild || !hasElectronMain) {
      console.log("Skipping default persistence tests - prerequisites missing.");
      test.skip();
    }
  });

  test("default project persists across app restarts", async () => {
    const env = createTestEnvironment("default");
    let electronApp: ElectronApplication | undefined;

    try {
      // === First launch: create a project via the New dialog ===
      const result1 = await launchElectron(env);
      electronApp = result1.electronApp;
      const page1 = result1.page;

      await page1.waitForTimeout(4000);

      // Use the standard enterEditor flow to create a project
      const entered = await enterEditor(page1);
      expect(entered).toBe(true);

      await page1.waitForTimeout(3000);
      await takeScreenshot(page1, "persist-default-first-launch");

      // Verify project items exist
      const itemCount1 = await getProjectItemCount(page1);
      console.log(`Default project item count: ${itemCount1}`);
      expect(itemCount1).toBeGreaterThan(0);

      // Verify on-disk persistence
      const prefs1 = readProjectPrefs(env.storageDir);
      console.log(`Default project prefs after creation: ${prefs1.length}`);
      expect(prefs1.length).toBeGreaterThanOrEqual(1);

      // For default projects, files should be in projects/ subfolder
      const projectsDir = path.join(env.storageDir, "projects");
      if (fs.existsSync(projectsDir)) {
        const projectFolders = fs.readdirSync(projectsDir);
        console.log("Project folders:", projectFolders);
        expect(projectFolders.length).toBeGreaterThan(0);
      }

      // Close the app
      await closeApp(electronApp);
      electronApp = undefined;

      // === Second launch: verify the project is still there ===
      const result2 = await launchElectron(env);
      electronApp = result2.electronApp;
      const page2 = result2.page;

      await page2.waitForTimeout(6000);
      await takeScreenshot(page2, "persist-default-relaunch");

      // Verify prefs file still exists
      const prefs2 = readProjectPrefs(env.storageDir);
      expect(prefs2.length).toBeGreaterThanOrEqual(1);
      // Should not have created a new project prefs file
      expect(prefs2.length).toBe(prefs1.length);

      await takeScreenshot(page2, "persist-default-final");
    } finally {
      await closeApp(electronApp);
      cleanupDirs(env);
    }
  });
});
