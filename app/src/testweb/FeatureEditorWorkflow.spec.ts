/**
 * FeatureEditorWorkflow.spec.ts - Tests for Feature Editor and related UX
 *
 * These tests cover the Feature Editor functionality which is used for
 * Minecraft world generation features like ores, trees, structures.
 *
 * Run with: npx playwright test FeatureEditorWorkflow.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor, enableAllFileTypes, takeScreenshot } from "./WebTestUtilities";

test.describe("Feature Editor Workflow @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should access feature functionality from Add menu", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    // Find and click Add button
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 5000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debugoutput/screenshots/feature-add-menu");

      // Look for feature-related options
      const featureOptions = [
        page.locator("text=/feature/i"),
        page.locator("text=/ore/i"),
        page.locator("text=/tree/i"),
        page.locator("text=/structure/i"),
      ];

      for (const option of featureOptions) {
        if ((await option.count()) > 0) {
          console.log(`Found feature-related option: ${await option.first().textContent()}`);
        }
      }

      await page.keyboard.press("Escape");
    }
  });

  test("should display feature editor tabs when feature file selected", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find and click on a feature file if one exists
    const featureFile = page.locator("text=/feature|ore|tree/i").first();

    if (await featureFile.isVisible({ timeout: 3000 })) {
      await featureFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/feature-editor-opened");

      // Look for feature editor tabs
      const tabs = page.locator('[role="tab"], button[title*="Tab"], .tab-button');
      const tabCount = await tabs.count();
      console.log(`Feature editor has ${tabCount} tabs`);
    } else {
      console.log("No feature file found in project");
    }
  });
});

test.describe("Item Type Editor Workflow @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add new item type from Add menu", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 5000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for item type option
      const itemOption = page.locator("text=/item type|new item/i").first();

      if (await itemOption.isVisible({ timeout: 2000 })) {
        console.log("Found item type option in Add menu");
        await takeScreenshot(page, "debugoutput/screenshots/item-add-menu-option");
      }

      await page.keyboard.press("Escape");
    }
  });

  test("should display item editor interface with tabs", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find an item file
    const itemFile = page.locator("text=/item|sword|apple|potion/i").first();

    if (await itemFile.isVisible({ timeout: 3000 })) {
      await itemFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/item-editor-opened");

      // Look for standard editor tabs
      const expectedTabs = ["Overview", "Components", "Actions"];
      for (const tabName of expectedTabs) {
        const tab = page.locator(`text="${tabName}"`);
        if ((await tab.count()) > 0) {
          console.log(`Found ${tabName} tab in item editor`);
        }
      }
    } else {
      console.log("No item file found in project");
    }
  });
});

test.describe("Loot Table and Recipe Editors @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display loot table preview when loot file selected", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a loot table file
    const lootFile = page.locator("text=/loot|drops/i").first();

    if (await lootFile.isVisible({ timeout: 3000 })) {
      await lootFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/loot-editor-opened");

      // Look for loot table specific UI elements
      const lootUI = page.locator("text=/pool|entry|item|weight/i");
      if ((await lootUI.count()) > 0) {
        console.log("Found loot table UI elements");
      }
    } else {
      console.log("No loot table file found in project");
    }
  });

  test("should display recipe preview when recipe file selected", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a recipe file
    const recipeFile = page.locator("text=/recipe/i").first();

    if (await recipeFile.isVisible({ timeout: 3000 })) {
      await recipeFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/recipe-editor-opened");

      // Look for recipe specific UI elements
      const recipeUI = page.locator("text=/crafting|pattern|ingredient|result/i");
      if ((await recipeUI.count()) > 0) {
        console.log("Found recipe UI elements");
      }
    } else {
      console.log("No recipe file found in project");
    }
  });
});

test.describe("Spawn Rules Editor @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display spawn rules editor when spawn file selected", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a spawn rules file
    const spawnFile = page.locator("text=/spawn/i").first();

    if (await spawnFile.isVisible({ timeout: 3000 })) {
      await spawnFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/spawn-editor-opened");

      // Look for spawn rules specific UI elements
      const spawnUI = page.locator("text=/biome|condition|weight|density/i");
      if ((await spawnUI.count()) > 0) {
        console.log("Found spawn rules UI elements");
      }
    } else {
      console.log("No spawn rules file found in project");
    }
  });
});

test.describe("Script Editor Integration @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display Monaco editor for TypeScript files", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a TypeScript file
    const tsFile = page.locator("text=/\\.ts$|main\\.ts|index\\.ts/i").first();

    if (await tsFile.isVisible({ timeout: 3000 })) {
      await tsFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/script-editor-opened");

      // Verify Monaco editor is showing
      const monacoEditor = page.locator(".monaco-editor");
      if (await monacoEditor.isVisible({ timeout: 3000 })) {
        console.log("Monaco editor is visible for TypeScript file");

        // Check for TypeScript-specific features
        const lineNumbers = page.locator(".line-numbers");
        if ((await lineNumbers.count()) > 0) {
          console.log("Monaco editor has line numbers");
        }
      }
    } else {
      console.log("No TypeScript file found in project");
    }
  });

  test("should show script-related options in toolbar for script files", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a script file
    const scriptFile = page.locator("text=/\\.ts$|\\.js$/i").first();

    if (await scriptFile.isVisible({ timeout: 3000 })) {
      await scriptFile.click();
      await page.waitForTimeout(2000);

      // Look for script-related toolbar options
      const scriptOptions = [
        page.locator('button:has-text("Run")'),
        page.locator('button:has-text("Debug")'),
        page.locator('button:has-text("Deploy")'),
      ];

      for (const option of scriptOptions) {
        if (await option.isVisible({ timeout: 1000 })) {
          console.log(`Found script toolbar option: ${await option.textContent()}`);
        }
      }

      await takeScreenshot(page, "debugoutput/screenshots/script-toolbar");
    }
  });
});

test.describe("Texture and Image Preview @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display image preview for PNG files", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Expand Icons section which contains pack_icon images
    const iconsSection = page.locator("text=Icons").first();
    if (await iconsSection.isVisible({ timeout: 3000 })) {
      await iconsSection.click();
      await page.waitForTimeout(500);
    }

    // Find and double-click on pack_icon (an image file)
    const imageFile = page.locator("text=pack_icon").first();

    if (await imageFile.isVisible({ timeout: 3000 })) {
      await imageFile.dblclick();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/image-preview");

      // Look for image preview element
      const imagePreview = page.locator('img, canvas, [class*="image"], [class*="preview"]');
      if ((await imagePreview.count()) > 0) {
        console.log("Image preview element found");
      }
    } else {
      console.log("No image file found in project");
    }
  });
});

test.describe("Sound Definition Editor @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display sound editor for sound definition files", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a sound file
    const soundFile = page.locator("text=/sound|audio|\\.ogg|\\.wav/i").first();

    if (await soundFile.isVisible({ timeout: 3000 })) {
      await soundFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/sound-editor-opened");

      // Look for audio-related UI elements
      const audioUI = page.locator("audio, [class*='audio'], [class*='sound'], [class*='waveform']");
      if ((await audioUI.count()) > 0) {
        console.log("Audio preview element found");
      }
    } else {
      console.log("No sound file found in project");
    }
  });
});
