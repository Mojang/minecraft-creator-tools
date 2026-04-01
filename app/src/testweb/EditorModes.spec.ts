/**
 * EditorModes.spec.ts - Tests for different editor modes and form editing
 *
 * These tests cover:
 * - Switching between form-based and raw JSON editing
 * - Monaco editor features in the editor context
 * - DataForm editor components
 * - Tab navigation in specialized editors
 *
 * Run with: npx playwright test EditorModes.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  selectEditMode,
  enableAllFileTypes,
  takeScreenshot,
  switchToRawMode,
  openFileInMonaco,
} from "./WebTestUtilities";

async function switchSettingsEditMode(page: Page, modeLabel: "Focused" | "Full" | "Raw"): Promise<boolean> {
  const fallbackMode = modeLabel.toLowerCase() as "focused" | "full" | "raw";

  try {
    const settingsButton = page.locator('button[title="Settings"], [aria-label="Settings"]').first();
    if (!(await settingsButton.isVisible({ timeout: 3000 }))) {
      return await selectEditMode(page, fallbackMode);
    }

    await settingsButton.click();
    await page.waitForTimeout(600);

    const modeButton = page.locator(`button:has-text("${modeLabel}")`).first();
    if (!(await modeButton.isVisible({ timeout: 3000 }))) {
      await page.keyboard.press("Escape");
      return false;
    }

    await modeButton.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return true;
  } catch {
    return await selectEditMode(page, fallbackMode);
  }
}

async function setAdvancedModeSwitchPayload(
  page: Page
): Promise<{ normalized: string; modelUri: string } | undefined> {
  return page.evaluate(() => {
    const sortDeep = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map((item) => sortDeep(item));
      }

      if (value && typeof value === "object") {
        const result: any = {};
        for (const key of Object.keys(value).sort()) {
          result[key] = sortDeep(value[key]);
        }
        return result;
      }

      return value;
    };

    const parseJsonLenient = (text: string): any => {
      const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
      const withoutLineComments = withoutBlockComments.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
      const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(withoutTrailingCommas);
    };

    const monacoRef = (window as any).monaco;
    const models = monacoRef?.editor?.getModels?.() || [];
    let model: any | undefined;
    let modelValue = "";

    for (const candidate of models) {
      const value = candidate?.getValue?.() || "";
      if (value.trim().length > modelValue.trim().length) {
        model = candidate;
        modelValue = value;
      }
    }

    if (!model) {
      return undefined;
    }

    const parsed = parseJsonLenient(modelValue);
    parsed.mode_switch_probe = {
      "minecraft:entity": {
        component_groups: {
          mode_switch_group: {
            "minecraft:health": { value: 20, max: 20 },
          },
        },
        events: {
          "mode_switch:activate": {
            add: {
              component_groups: ["mode_switch_group"],
            },
          },
        },
        components: {
          "minecraft:timer": {
            looping: true,
            time: 1,
            time_down_event: {
              event: "mode_switch:activate",
              target: "self",
              condition: "query.life_time > 0",
            },
          },
        },
      },
      "minecraft:block": {
        permutations: [
          {
            condition: "query.block_state('mode_switch:state') == 1",
            components: {
              "minecraft:light_emission": 10,
            },
          },
        ],
      },
    };

    model.setValue(JSON.stringify(parsed, null, 2));
    return {
      normalized: JSON.stringify(sortDeep(parsed)),
      modelUri: model.uri?.toString?.() || "",
    };
  });
}

async function getNormalizedMonacoJson(page: Page, preferredModelUri?: string): Promise<string | undefined> {
  return page.evaluate((preferredModelUriInEval) => {
    const sortDeep = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map((item) => sortDeep(item));
      }

      if (value && typeof value === "object") {
        const result: any = {};
        for (const key of Object.keys(value).sort()) {
          result[key] = sortDeep(value[key]);
        }
        return result;
      }

      return value;
    };

    const parseJsonLenient = (text: string): any => {
      const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
      const withoutLineComments = withoutBlockComments.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
      const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(withoutTrailingCommas);
    };

    const monacoRef = (window as any).monaco;
    const models = monacoRef?.editor?.getModels?.() || [];
    let selectedModel: any | undefined;
    let modelValue = "";

    if (preferredModelUriInEval) {
      const preferredModel = models.find((candidate: any) => candidate?.uri?.toString?.() === preferredModelUriInEval);
      if (preferredModel) {
        selectedModel = preferredModel;
        modelValue = preferredModel.getValue?.() || "";
      }
    }

    if (!selectedModel) {
      for (const candidate of models) {
        const value = candidate?.getValue?.() || "";
        if (value.trim().length > modelValue.trim().length) {
          selectedModel = candidate;
          modelValue = value;
        }
      }
    }

    if (modelValue.trim().length === 0) {
      return undefined;
    }

    try {
      return JSON.stringify(sortDeep(parseJsonLenient(modelValue)));
    } catch {
      return undefined;
    }
  }, preferredModelUri);
}

test.describe("Editor Mode Switching @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should switch from form editor to raw JSON mode", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Expand the Behavior pack manifests section
    const behaviorPackManifests = page.locator("text=Behavior pack manifests").first();
    if (await behaviorPackManifests.isVisible({ timeout: 3000 })) {
      await behaviorPackManifests.click();
      await page.waitForTimeout(500);
    }

    // Find and open the manifest file using the openFileInMonaco utility
    const opened = await openFileInMonaco(page, "manifest");

    if (opened) {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "debugoutput/screenshots/editor-modes-form-view");

      // Look for the Monaco editor (manifest files typically open directly in Monaco)
      const monacoEditor = page.locator(".monaco-editor").first();
      if (await monacoEditor.isVisible({ timeout: 3000 })) {
        console.log("Manifest opened in Monaco editor");
        await takeScreenshot(page, "debugoutput/screenshots/editor-modes-raw-view");
      } else {
        // Try to switch to raw mode if there's a form
        const switched = await switchToRawMode(page);
        if (switched) {
          await takeScreenshot(page, "debugoutput/screenshots/editor-modes-raw-view");
          console.log("Successfully switched from form to raw mode");
        }
      }
    } else {
      console.log("Could not open manifest file");
    }
  });

  test("should display form fields in manifest editor", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Expand the Behavior pack manifests section
    const behaviorPackManifests = page.locator("text=Behavior pack manifests").first();
    if (await behaviorPackManifests.isVisible({ timeout: 3000 })) {
      await behaviorPackManifests.click();
      await page.waitForTimeout(500);
    }

    // Open manifest file using the utility
    const opened = await openFileInMonaco(page, "manifest");

    if (opened) {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "debugoutput/screenshots/editor-modes-manifest-form");

      // Look for form elements or Monaco editor content
      const monacoEditor = page.locator(".monaco-editor").first();
      if (await monacoEditor.isVisible({ timeout: 2000 })) {
        console.log("Manifest opened in Monaco editor - looking for JSON content");
        // The manifest JSON should have name, description, version etc.
        const editorContent = page.locator('.view-lines, [class*="view-line"]').first();
        if (await editorContent.isVisible({ timeout: 1000 })) {
          console.log("Monaco editor content visible with manifest JSON");
        }
      } else {
        // Look for form elements
        const formFields = [
          page.locator("text=/name|title|description/i").first(),
          page.locator("text=/version/i").first(),
          page.locator('input, textarea, [role="textbox"]').first(),
        ];

        for (const field of formFields) {
          if (await field.isVisible({ timeout: 2000 })) {
            console.log(`Found form field: ${await field.textContent()}`);
          }
        }
      }
    } else {
      console.log("Could not open manifest file");
    }
  });

  test("should allow editing in raw JSON mode", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Expand the Behavior pack manifests section
    const behaviorPackManifests = page.locator("text=Behavior pack manifests").first();
    if (await behaviorPackManifests.isVisible({ timeout: 3000 })) {
      await behaviorPackManifests.click();
      await page.waitForTimeout(500);
    }

    // Open manifest file using the utility
    const opened = await openFileInMonaco(page, "manifest");

    if (opened) {
      // Wait for editor to be ready
      await page.waitForTimeout(1000);

      // Look for Monaco editor
      const monacoEditor = page.locator(".monaco-editor").first();

      if (await monacoEditor.isVisible({ timeout: 3000 })) {
        // Click in the editor
        await monacoEditor.click();
        await page.waitForTimeout(500);

        // Type some text (this tests that the editor is editable)
        await page.keyboard.type("// Test comment\n");
        await page.waitForTimeout(500);

        await takeScreenshot(page, "debugoutput/screenshots/editor-modes-raw-editing");
        console.log("Successfully typed in raw editor");
      } else {
        // Try to switch to raw mode if there's a form
        const switched = await switchToRawMode(page);
        if (switched) {
          const editor = page.locator(".monaco-editor").first();
          if (await editor.isVisible({ timeout: 2000 })) {
            await editor.click();
            await page.keyboard.type("// Test comment\n");
            await takeScreenshot(page, "debugoutput/screenshots/editor-modes-raw-editing");
          }
        }
      }
    } else {
      console.log("Could not open manifest file");
    }
  });
});

test.describe("Entity Editor Tab Navigation @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should navigate through entity editor tabs", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find an entity file
    const entityFile = page.locator("text=/entity|zombie|skeleton|pig/i").first();

    if (await entityFile.isVisible({ timeout: 5000 })) {
      await entityFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/editor-modes-entity-initial");

      // Look for and click through tabs
      const tabNames = ["Overview", "Components", "Properties", "Actions", "Visuals"];

      for (const tabName of tabNames) {
        const tab = page.locator(`button[title*="${tabName}"], button:has-text("${tabName}")`).first();

        if (await tab.isVisible({ timeout: 2000 })) {
          await tab.click();
          await page.waitForTimeout(1000);

          await takeScreenshot(page, `debugoutput/screenshots/editor-modes-entity-${tabName.toLowerCase()}`);
          console.log(`Navigated to ${tabName} tab`);
        }
      }
    } else {
      console.log("No entity file found in project");
    }
  });
});

test.describe("Block Editor Tab Navigation @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should navigate through block editor tabs", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Try to find a block file
    const blockFile = page.locator("text=/block|stone|wood/i").first();

    if (await blockFile.isVisible({ timeout: 5000 })) {
      await blockFile.click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/editor-modes-block-initial");

      // Look for and click through tabs
      const tabNames = ["Overview", "Components", "States", "Permutations"];

      for (const tabName of tabNames) {
        const tab = page.locator(`button[title*="${tabName}"], button:has-text("${tabName}")`).first();

        if (await tab.isVisible({ timeout: 2000 })) {
          await tab.click();
          await page.waitForTimeout(1000);

          await takeScreenshot(page, `debugoutput/screenshots/editor-modes-block-${tabName.toLowerCase()}`);
          console.log(`Navigated to ${tabName} tab`);
        }
      }
    } else {
      console.log("No block file found in project");
    }
  });
});

test.describe("Monaco Editor Features in Editor @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show line numbers in Monaco editor", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Find a file that will open in Monaco
    const manifestFile = page.locator("text=manifest").first();

    if (await manifestFile.isVisible({ timeout: 5000 })) {
      await manifestFile.click();
      await page.waitForTimeout(2000);

      // Switch to raw mode
      await switchToRawMode(page);

      // Check for line numbers
      const lineNumbers = page.locator(".line-numbers, .margin-view-overlays");

      if ((await lineNumbers.count()) > 0) {
        console.log("Line numbers are visible in Monaco editor");
        await takeScreenshot(page, "debugoutput/screenshots/editor-modes-line-numbers");
      }
    }
  });

  test("should support code folding in Monaco editor", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    const manifestFile = page.locator("text=manifest").first();

    if (await manifestFile.isVisible({ timeout: 5000 })) {
      await manifestFile.click();
      await page.waitForTimeout(2000);

      await switchToRawMode(page);

      // Look for folding controls
      const foldingDecorations = page.locator(".folding-decoration, .codicon-chevron-down, .codicon-chevron-right");

      if ((await foldingDecorations.count()) > 0) {
        console.log("Code folding decorations are visible");
        await takeScreenshot(page, "debugoutput/screenshots/editor-modes-folding");
      }
    }
  });

  test("should show syntax highlighting in Monaco editor", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    const manifestFile = page.locator("text=manifest").first();

    if (await manifestFile.isVisible({ timeout: 5000 })) {
      await manifestFile.click();
      await page.waitForTimeout(2000);

      await switchToRawMode(page);

      // Look for syntax-highlighted elements (Monaco uses mtk classes for tokens)
      const highlightedTokens = page.locator("[class*='mtk'], .bracket-match");

      if ((await highlightedTokens.count()) > 0) {
        console.log("Syntax highlighting is active");
        await takeScreenshot(page, "debugoutput/screenshots/editor-modes-syntax-highlighting");
      }
    }
  });
});

test.describe("Form Editor DataForm Components @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display form inputs in behavior pack manifest", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // First expand the section if needed
    const behaviorPackManifests = page.locator("text=Behavior pack manifests").first();
    if (await behaviorPackManifests.isVisible({ timeout: 3000 })) {
      await behaviorPackManifests.click();
      await page.waitForTimeout(500);
    }

    // Double-click on manifest to open the editor
    const manifestFile = page.locator("text=manifest").first();

    if (await manifestFile.isVisible({ timeout: 5000 })) {
      await manifestFile.dblclick();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debugoutput/screenshots/editor-modes-dataform");

      // Look for DataForm elements
      const formElements = page.locator('input, select, textarea, [role="combobox"], [role="listbox"]');
      const formCount = await formElements.count();
      console.log(`Found ${formCount} form elements`);

      // Look for labels
      const labels = page.locator("label, .dfe-label, [class*='label']");
      const labelCount = await labels.count();
      console.log(`Found ${labelCount} labels`);

      if (formCount > 0) {
        // Try to interact with first visible input
        const firstInput = formElements.first();
        if (await firstInput.isVisible({ timeout: 2000 })) {
          await firstInput.focus();
          await takeScreenshot(page, "debugoutput/screenshots/editor-modes-dataform-focused");
        }
      }
    }
  });

  test("should display dropdown/select components in forms", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // First expand the section if needed
    const behaviorPackManifests = page.locator("text=Behavior pack manifests").first();
    if (await behaviorPackManifests.isVisible({ timeout: 3000 })) {
      await behaviorPackManifests.click();
      await page.waitForTimeout(500);
    }

    // Double-click on manifest to open the editor - manifest has form fields
    const fileWithForm = page.locator("text=manifest").first();

    if (await fileWithForm.isVisible({ timeout: 5000 })) {
      await fileWithForm.dblclick();
      await page.waitForTimeout(2000);

      // Look for dropdown/select elements
      const dropdowns = page.locator('select, [role="combobox"], .dropdown, [class*="dropdown"]');
      const dropdownCount = await dropdowns.count();
      console.log(`Found ${dropdownCount} dropdown elements`);

      if (dropdownCount > 0) {
        const firstDropdown = dropdowns.first();
        if (await firstDropdown.isVisible({ timeout: 2000 })) {
          await takeScreenshot(page, "debugoutput/screenshots/editor-modes-dropdowns");
        }
      }
    }
  });
});

test.describe("Add Component Dialog @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should open Add Component dialog in entity editor", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Look for entity file
    const entityFile = page.locator("text=/entity/i").first();

    if (await entityFile.isVisible({ timeout: 5000 })) {
      await entityFile.click();
      await page.waitForTimeout(2000);

      // Go to Components tab
      const componentsTab = page.locator('button:has-text("Components")').first();
      if (await componentsTab.isVisible({ timeout: 2000 })) {
        await componentsTab.click();
        await page.waitForTimeout(1000);

        // Look for Add Component button
        const addComponentBtn = page.locator('button:has-text("Add Component"), button:has-text("Add")').first();

        if (await addComponentBtn.isVisible({ timeout: 2000 })) {
          await addComponentBtn.click();
          await page.waitForTimeout(1000);

          await takeScreenshot(page, "debugoutput/screenshots/editor-modes-add-component-dialog");

          // Look for component list or search
          const componentSearch = page.locator('input[placeholder*="search" i], input[type="search"]');
          if ((await componentSearch.count()) > 0) {
            console.log("Add Component dialog has search functionality");
          }

          // Close dialog
          await page.keyboard.press("Escape");
        }
      }
    }
  });
});

test.describe("Lossless Mode Switching @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should preserve advanced JSON through focused/full/raw transitions", async ({ page }) => {
    test.setTimeout(120000);

    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    let targetPattern = "tsconfig";
    let opened = await openFileInMonaco(page, targetPattern);
    if (!opened) {
      targetPattern = "package";
      opened = await openFileInMonaco(page, targetPattern);
    }
    if (!opened) {
      targetPattern = "manifest";
      opened = await openFileInMonaco(page, targetPattern);
    }
    expect(opened).toBe(true);

    const switchedToRawPreferenceInitial = await switchSettingsEditMode(page, "Raw");
    expect(switchedToRawPreferenceInitial).toBe(true);

    const reopenedForRaw = await openFileInMonaco(page, targetPattern);
    expect(reopenedForRaw).toBe(true);

    const beforeSnapshot = await setAdvancedModeSwitchPayload(page);
    expect(beforeSnapshot).toBeTruthy();
    const beforeNormalized = beforeSnapshot?.normalized;
    const trackedModelUri = beforeSnapshot?.modelUri;
    expect(beforeNormalized).toBeTruthy();
    await takeScreenshot(page, "debugoutput/screenshots/editor-modes-lossless-before");

    const switchedToFocused = await switchSettingsEditMode(page, "Focused");
    expect(switchedToFocused).toBe(true);

    const switchedToFull = await switchSettingsEditMode(page, "Full");
    expect(switchedToFull).toBe(true);

    const switchedToRawPreference = await switchSettingsEditMode(page, "Raw");
    expect(switchedToRawPreference).toBe(true);

    let afterNormalized: string | undefined;
    for (let i = 0; i < 15; i++) {
      afterNormalized = await getNormalizedMonacoJson(page, trackedModelUri);
      if (afterNormalized) {
        break;
      }
      await page.waitForTimeout(300);
    }

    if (!afterNormalized) {
      await openFileInMonaco(page, targetPattern);
      await page.waitForTimeout(1000);
      afterNormalized = await getNormalizedMonacoJson(page, trackedModelUri);
    }

    await takeScreenshot(page, "debugoutput/screenshots/editor-modes-lossless-after");

    expect(afterNormalized).toBeTruthy();
    expect(afterNormalized).toEqual(beforeNormalized);

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
  });
});
