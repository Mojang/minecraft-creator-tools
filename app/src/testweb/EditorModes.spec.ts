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

async function setAdvancedModeSwitchPayload(page: Page): Promise<{ normalized: string; modelUri: string } | undefined> {
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
    if (!monacoRef?.editor) return undefined;

    // Pick the EDITABLE editor whose model has the longest content. The
    // JsonEditor mounts a read-only live-preview Monaco alongside the
    // editable one — writes to the read-only editor's model fire onChange
    // events but JsonEditor's `_handleContentUpdated` ignores them
    // (`this.props.readOnly` is true), so the change is silently dropped
    // from `file.content`. When the test subsequently switches edit modes,
    // JsonEditor remounts and `_ensureModelForFile` reseeds the Monaco
    // model from the *original* `file.content`, losing our payload.
    const editors = monacoRef.editor.getEditors?.() || [];
    const readOnlyId = monacoRef.editor?.EditorOption?.readOnly;
    let targetEditor: any | undefined;
    let modelValue = "";
    // First pass: find the longest-content EDITABLE editor.
    for (const candidate of editors) {
      const model = candidate?.getModel?.();
      if (!model) continue;
      const isReadOnly =
        typeof readOnlyId === "number" ? candidate.getOption?.(readOnlyId) : false;
      if (isReadOnly) continue;
      const value = model.getValue?.() || "";
      if (value.trim().length > modelValue.trim().length) {
        targetEditor = candidate;
        modelValue = value;
      }
    }
    // Fallback: longest-content editor regardless of read-only state.
    if (!targetEditor) {
      for (const candidate of editors) {
        const model = candidate?.getModel?.();
        if (!model) continue;
        const value = model.getValue?.() || "";
        if (value.trim().length > modelValue.trim().length) {
          targetEditor = candidate;
          modelValue = value;
        }
      }
    }
    if (!targetEditor) return undefined;

    const model = targetEditor.getModel?.();
    if (!model) return undefined;

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

    // Use `executeEdits` rather than `model.setValue`. The React Monaco
    // wrapper (`@monaco-editor/react`) suppresses its `onChange` callback
    // when the model value is updated via certain code paths (e.g. setValue
    // with `isFlush=true`). Going through the editor's executeEdits command
    // pipeline matches the path a real user takes — the diff goes through
    // Monaco's standard edit flow and reliably fires the onChange listener
    // that JsonEditor uses to push the new value into `file.setContent`.
    // Without this, the underlying file model never receives our edit, and
    // when a mode switch later remounts JsonEditor, `_ensureModelForFile`
    // resets the Monaco model from the *original* (unmodified) file.content,
    // losing the test payload.
    const newText = JSON.stringify(parsed, null, 2);
    targetEditor.focus?.();
    const fullRange = model.getFullModelRange();
    const success = targetEditor.executeEdits("editormodes-test", [
      {
        range: fullRange,
        text: newText,
        forceMoveMarkers: true,
      },
    ]);
    targetEditor.pushUndoStop?.();
    if (!success) {
      model.setValue(newText);
    }
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

    // Intentionally NO fallback to "longest content model": when the user
    // re-opens a different file or a stale form-editor live-preview model
    // remains in memory, falling back to longest-content silently reads the
    // wrong file's content and produces a misleading "data was lost" failure.
    // We'd rather fail loudly with "no content for tracked URI" so the test
    // diagnostic clearly points at the missing model.

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

    // Switch to Raw preference FIRST so any opened file lands in Monaco regardless of file type.
    // (Previously we tried to open tsconfig/package/manifest hoping it would auto-route to Monaco,
    //  but in Full mode tsconfig.json sometimes opens in a form editor first.)
    const switchedToRawPreferenceInitial = await switchSettingsEditMode(page, "Raw");
    expect(switchedToRawPreferenceInitial).toBe(true);

    // Try each candidate file and verify Monaco actually appears AND is
    // editable before accepting it. Autogenerated config files (tsconfig.json,
    // package.json, .vscode/launch.json) are intentionally rendered as
    // read-only by ProjectItemEditor: any change written into Monaco will
    // visibly appear in the model but JsonEditor's `_handleContentUpdated`
    // silently drops it because `this.props.readOnly` is true. The first
    // mode switch then reseeds the model from the *original* file.content,
    // erasing the test payload — which is what made this test flap.
    //
    // We skip read-only Monaco editors and only accept a file we can
    // actually round-trip through.
    const candidatePatterns = ["manifest", "tsconfig", "package"];
    let targetPattern = "";
    let monacoVisible = false;
    for (const pattern of candidatePatterns) {
      const opened = await openFileInMonaco(page, pattern);
      if (!opened) continue;
      const monacoEditor = page.locator(".monaco-editor").first();
      if (!(await monacoEditor.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log(`Lossless test: pattern "${pattern}" opened but Monaco not visible; trying next`);
        continue;
      }
      // Verify the editor we found is writable. Use the EditorOption enum
      // from window.monaco to look up readOnly's numeric id rather than
      // hard-coding it (the enum values shift between Monaco versions).
      const isWritable = await page.evaluate(() => {
        const monacoRef = (window as any).monaco;
        const editors = monacoRef?.editor?.getEditors?.() || [];
        const readOnlyId = monacoRef?.editor?.EditorOption?.readOnly;
        if (typeof readOnlyId !== "number") return true; // can't tell — assume writable
        for (const e of editors) {
          if (!e.getOption?.(readOnlyId)) return true;
        }
        return false;
      });
      if (!isWritable) {
        console.log(
          `Lossless test: pattern "${pattern}" Monaco is read-only (autogenerated item); trying next`
        );
        continue;
      }
      targetPattern = pattern;
      monacoVisible = true;
      console.log(`Lossless test: editable Monaco editor visible for pattern "${pattern}"`);
      break;
    }
    expect(
      monacoVisible,
      "Need at least one editable JSON file to round-trip through mode switches"
    ).toBe(true);

    // Wait for the JSON editor's loading placeholder to disappear. Until it
    // does, JsonEditor hasn't finished `_ensureModelForFile`, meaning the
    // Monaco onChange listener may not be wired through to `file.setContent`.
    // Writing to the model in that window updates Monaco visibly but the
    // change is silently dropped from the file model — and the first mode
    // switch then reseeds the Monaco model from the original `file.content`,
    // erasing our payload.
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);
    await page.waitForTimeout(500);

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

    // CRITICAL: switchSettingsEditMode leaves the user ON the Settings page,
    // not back on the file we just edited. Without re-opening the file,
    // getNormalizedMonacoJson finds whatever inmemory Monaco models survived
    // the mode-switch churn (e.g. a stale form-editor live preview), which
    // contain the *original* file content not our payload. Always re-open the
    // file so the final read is from the JsonEditor's freshly mounted Monaco
    // model, which loads from `file.content` (the source of truth).
    //
    // Caveat for `manifest`: a fresh Add-On Starter has two manifest.json
    // files (BP + RP). After our edit, the BP entry renders as "manifest*"
    // (dirty marker) while the untouched RP renders as plain "manifest".
    // Playwright's `text="manifest"` selector does an EXACT text match and
    // therefore prefers the RP (clean) entry — which never had our payload.
    // Click the dirty entry first so we re-open the file we actually edited.
    const dirtyEntry = page.locator(".pit-name").filter({ hasText: /\*$/ }).first();
    if (await dirtyEntry.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dirtyEntry.scrollIntoViewIfNeeded().catch(() => {});
      await dirtyEntry.click();
      await page.waitForTimeout(800);
    } else {
      await openFileInMonaco(page, targetPattern);
    }
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);
    await page.waitForTimeout(500);

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
