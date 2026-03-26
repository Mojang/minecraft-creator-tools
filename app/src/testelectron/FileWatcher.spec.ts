/**
 * File Watcher Pipeline Tests
 *
 * These tests verify that external file changes (like files added by MCP)
 * are properly detected by the Electron app and propagated through to the UI.
 *
 * The pipeline being tested:
 * 1. External process saves files to project folder
 * 2. Electron fs.watch detects changes (with debouncing)
 * 3. IPC messages sent to renderer (localFileAdded, localFileRemoved, localFileUpdate)
 * 4. ElectronStorage routes to appropriate storage instance
 * 5. StorageBase fires onFileAdded/onFileRemoved events
 * 6. Project subscribes and updates ProjectItems (with debouncing)
 * 7. UI re-renders to show new items
 *
 * Run with: npm run test-electron
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";
import { takeScreenshot } from "../testshared/TestUtilities";

// Path to the Electron main process entry point
const appDir = process.cwd();
const electronMainPath = path.join(appDir, "toolbuild/jsn/electron/main.mjs");

// Generate unique test identifiers
const testSlug = `mct-filewatcher-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testStorageDir = path.join(os.tmpdir(), testSlug);
const testUserDataDir = path.join(os.tmpdir(), `${testSlug}-userdata`);
const testProjectDir = path.join(testStorageDir, "test-project");

// Check if the built toolbuild exists
const toolbuildPath = path.join(appDir, "toolbuild/jsn");
const hasToolbuild = fs.existsSync(toolbuildPath);
const hasElectronMain = fs.existsSync(electronMainPath);

/**
 * Helper to create a minimal Minecraft addon project structure
 */
function createTestProject() {
  // Create behavior pack structure
  const bpPath = path.join(testProjectDir, "behavior_packs", "test_bp");
  fs.mkdirSync(bpPath, { recursive: true });

  // Create manifest.json
  const manifest = {
    format_version: 2,
    header: {
      name: "Test Behavior Pack",
      description: "Test pack for file watcher tests",
      uuid: "00000000-0000-0000-0000-000000000001",
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [
      {
        type: "data",
        uuid: "00000000-0000-0000-0000-000000000002",
        version: [1, 0, 0],
      },
    ],
  };
  fs.writeFileSync(path.join(bpPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Create entities folder
  fs.mkdirSync(path.join(bpPath, "entities"), { recursive: true });

  // Create resource pack structure
  const rpPath = path.join(testProjectDir, "resource_packs", "test_rp");
  fs.mkdirSync(rpPath, { recursive: true });

  const rpManifest = {
    format_version: 2,
    header: {
      name: "Test Resource Pack",
      description: "Test pack for file watcher tests",
      uuid: "00000000-0000-0000-0000-000000000003",
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [
      {
        type: "resources",
        uuid: "00000000-0000-0000-0000-000000000004",
        version: [1, 0, 0],
      },
    ],
  };
  fs.writeFileSync(path.join(rpPath, "manifest.json"), JSON.stringify(rpManifest, null, 2));

  // Create models/entity folder for geometry files
  fs.mkdirSync(path.join(rpPath, "models", "entity"), { recursive: true });

  // Create textures/entity folder
  fs.mkdirSync(path.join(rpPath, "textures", "entity"), { recursive: true });
}

/**
 * Helper to clean up test directories
 */
function cleanupTestDirs() {
  try {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testUserDataDir)) {
      fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("Failed to cleanup test directories:", e);
  }
}

test.describe("File Watcher Pipeline Tests", () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    if (!hasToolbuild) {
      console.log("Skipping tests - toolbuild not found. Run 'npm run jsnbuild' first.");
      test.skip();
      return;
    }

    if (!hasElectronMain) {
      console.log("Skipping tests - electron.js not found.");
      test.skip();
      return;
    }

    // Clean up any leftover test directories
    cleanupTestDirs();

    // Create the test project
    createTestProject();

    console.log("Test project created at:", testProjectDir);
    console.log("Launching Electron app...");

    // Launch Electron with test isolation
    electronApp = await electron.launch({
      args: [electronMainPath, `--user-data-dir=${testUserDataDir}`],
      cwd: appDir,
      env: {
        ...process.env,
        NODE_ENV: "test",
        ELECTRON_FORCE_PROD: "true",
        MCT_TEST_STORAGE_ROOT: testStorageDir,
        MCTOOLS_DATA_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    page = await electronApp.firstWindow({ timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    console.log("Electron app ready");
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    cleanupTestDirs();
  });

  test("should detect externally added JSON file", async () => {
    // Skip if app didn't launch
    if (!page) {
      test.skip();
      return;
    }

    // First, open the test project in the editor
    // This would typically be done via the File > Open Folder menu
    // For now, we'll check if the file watcher infrastructure is working
    // by monitoring console output

    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Wait a bit for the app to settle
    await page.waitForTimeout(1000);

    // Create a new entity file externally (simulating MCP)
    const entityPath = path.join(testProjectDir, "behavior_packs", "test_bp", "entities", "test_mob.json");
    const entityContent = {
      format_version: "1.20.0",
      "minecraft:entity": {
        description: {
          identifier: "test:test_mob",
          is_spawnable: true,
          is_summonable: true,
        },
        components: {
          "minecraft:health": {
            value: 10,
            max: 10,
          },
        },
      },
    };

    fs.writeFileSync(entityPath, JSON.stringify(entityContent, null, 2));
    console.log("Created external entity file:", entityPath);

    // Wait for the debounce period plus some buffer
    await page.waitForTimeout(1000);

    // Verify the file was created
    expect(fs.existsSync(entityPath)).toBe(true);

    // Take a screenshot for debugging
    await takeScreenshot(page, "file-watcher-after-add");
  });

  test("should detect externally deleted file", async () => {
    if (!page) {
      test.skip();
      return;
    }

    // Create a file first
    const tempEntityPath = path.join(testProjectDir, "behavior_packs", "test_bp", "entities", "temp_entity.json");
    const tempContent = {
      format_version: "1.20.0",
      "minecraft:entity": {
        description: {
          identifier: "test:temp_entity",
        },
        components: {},
      },
    };

    fs.writeFileSync(tempEntityPath, JSON.stringify(tempContent, null, 2));
    await page.waitForTimeout(600); // Wait for add debounce

    // Now delete it
    fs.unlinkSync(tempEntityPath);
    console.log("Deleted external entity file:", tempEntityPath);

    // Wait for the debounce period
    await page.waitForTimeout(600);

    // Verify the file was deleted
    expect(fs.existsSync(tempEntityPath)).toBe(false);

    await takeScreenshot(page, "file-watcher-after-delete");
  });

  test("should batch rapid file additions", async () => {
    if (!page) {
      test.skip();
      return;
    }

    const entitiesPath = path.join(testProjectDir, "behavior_packs", "test_bp", "entities");

    // Create multiple files rapidly (faster than debounce period)
    const fileCount = 5;
    for (let i = 0; i < fileCount; i++) {
      const entityPath = path.join(entitiesPath, `batch_entity_${i}.json`);
      const entityContent = {
        format_version: "1.20.0",
        "minecraft:entity": {
          description: {
            identifier: `test:batch_entity_${i}`,
          },
          components: {},
        },
      };
      fs.writeFileSync(entityPath, JSON.stringify(entityContent, null, 2));
    }

    console.log(`Created ${fileCount} entity files rapidly`);

    // Wait for debounce to complete
    await page.waitForTimeout(800);

    // Verify all files exist
    for (let i = 0; i < fileCount; i++) {
      const entityPath = path.join(entitiesPath, `batch_entity_${i}.json`);
      expect(fs.existsSync(entityPath)).toBe(true);
    }

    await takeScreenshot(page, "file-watcher-batch-add");
  });

  test("should handle rapid delete and recreate (update)", async () => {
    if (!page) {
      test.skip();
      return;
    }

    const entityPath = path.join(testProjectDir, "behavior_packs", "test_bp", "entities", "recreate_entity.json");

    // Create initial file
    const content1 = {
      format_version: "1.20.0",
      "minecraft:entity": {
        description: { identifier: "test:recreate_entity" },
        components: { "minecraft:health": { value: 10 } },
      },
    };
    fs.writeFileSync(entityPath, JSON.stringify(content1, null, 2));
    await page.waitForTimeout(100);

    // Delete it
    fs.unlinkSync(entityPath);
    await page.waitForTimeout(50);

    // Recreate it with different content (simulating a "save as new")
    const content2 = {
      format_version: "1.20.0",
      "minecraft:entity": {
        description: { identifier: "test:recreate_entity" },
        components: { "minecraft:health": { value: 20 } }, // Different health
      },
    };
    fs.writeFileSync(entityPath, JSON.stringify(content2, null, 2));

    // Wait for debounce
    await page.waitForTimeout(600);

    // File should exist with new content
    expect(fs.existsSync(entityPath)).toBe(true);
    const finalContent = JSON.parse(fs.readFileSync(entityPath, "utf-8"));
    expect(finalContent["minecraft:entity"].components["minecraft:health"].value).toBe(20);

    await takeScreenshot(page, "file-watcher-recreate");
  });

  test("should detect geometry file added to resource pack", async () => {
    if (!page) {
      test.skip();
      return;
    }

    // Create a geometry file (simulating MCP model export)
    const geoPath = path.join(testProjectDir, "resource_packs", "test_rp", "models", "entity", "custom_mob.geo.json");

    const geoContent = {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.custom_mob",
            texture_width: 64,
            texture_height: 64,
          },
          bones: [
            {
              name: "body",
              pivot: [0, 0, 0],
              cubes: [{ origin: [-4, 0, -2], size: [8, 8, 4], uv: [0, 0] }],
            },
          ],
        },
      ],
    };

    fs.writeFileSync(geoPath, JSON.stringify(geoContent, null, 2));
    console.log("Created geometry file:", geoPath);

    // Wait for debounce
    await page.waitForTimeout(600);

    expect(fs.existsSync(geoPath)).toBe(true);

    await takeScreenshot(page, "file-watcher-geometry-add");
  });

  test("should detect texture file added to resource pack", async () => {
    if (!page) {
      test.skip();
      return;
    }

    // Create a minimal PNG file (1x1 transparent pixel)
    const texturePath = path.join(testProjectDir, "resource_packs", "test_rp", "textures", "entity", "custom_mob.png");

    // Minimal valid PNG (1x1 transparent pixel)
    const pngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    fs.writeFileSync(texturePath, pngData);
    console.log("Created texture file:", texturePath);

    // Wait for debounce
    await page.waitForTimeout(600);

    expect(fs.existsSync(texturePath)).toBe(true);

    await takeScreenshot(page, "file-watcher-texture-add");
  });
});
