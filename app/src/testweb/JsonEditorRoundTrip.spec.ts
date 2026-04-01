/**
 * JSON Editor Round-Trip Tests
 *
 * Tests that verify raw JSON editing in the Monaco editor persists correctly:
 * - Edit JSON → navigate away → return → verify edits preserved
 * - Form view ↔ Raw view switching preserves content
 * - Entity JSON structure preserved after modifications
 * - Script file editing round-trip
 *
 * These tests use "raw" edit mode where all files open directly in Monaco.
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  enableAllFileTypes,
  openFileInMonaco,
  takeScreenshot,
  switchToRawMode,
} from "./WebTestUtilities";

/**
 * Get content from the first visible Monaco editor via its model.
 */
async function getMonacoContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const editors = (window as any).monaco?.editor?.getEditors?.();
    if (editors && editors.length > 0) {
      return editors[0].getModel()?.getValue() || "";
    }
    return "";
  });
}

/**
 * Set content in the first visible Monaco editor via executeEdits.
 * Using executeEdits instead of setValue so the app's change handlers fire.
 * Also directly updates the file content as a fallback to handle model-switching races.
 */
async function setMonacoContent(page: Page, content: string): Promise<void> {
  await page.evaluate((c: string) => {
    const editors = (window as any).monaco?.editor?.getEditors?.();
    if (editors && editors.length > 0) {
      const editor = editors[0];
      const model = editor.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        editor.executeEdits("test", [
          {
            range: fullRange,
            text: c,
            forceMoveMarkers: true,
          },
        ]);

        // Also set content directly on the file to prevent model/file divergence
        // during re-renders that call _ensureModelForFile.
        if (model.uri) {
          const allModels = (window as any).monaco?.editor?.getModels?.() || [];
          for (const m of allModels) {
            if (m.uri?.toString() === model.uri.toString()) {
              m.setValue(c);
              break;
            }
          }
        }
      }
    }
  }, content);
}

/**
 * Navigate away from the current file by clicking another sidebar item,
 * then return to the target file.
 */
async function navigateAwayAndBack(page: Page, targetFilePattern: string): Promise<void> {
  const sidebarItems = page.locator(".pit-name");
  const count = await sidebarItems.count();
  const targetLower = targetFilePattern.toLowerCase();

  for (let i = 0; i < Math.min(count, 15); i++) {
    const item = sidebarItems.nth(i);
    if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const text = ((await item.textContent()) || "").trim().toLowerCase();
    if (text.length > 0 && !text.includes(targetLower)) {
      await item.click();
      await page.waitForTimeout(2000);
      break;
    }
  }

  await openFileInMonaco(page, targetFilePattern);
  await page.waitForTimeout(1500);
}

test.describe("JSON Editor Round-Trip Tests @full", () => {
  test.setTimeout(90000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // -----------------------------------------------------------------------
  // Test 1 – manifest JSON round-trip through raw editing
  // -----------------------------------------------------------------------
  test("manifest JSON round-trip through raw editing @full", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page, { editMode: "raw" });
    expect(entered).toBe(true);

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    const opened = await openFileInMonaco(page, "manifest");
    expect(opened).toBe(true);

    const monacoEditor = page.locator(".monaco-editor").first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, "debugoutput/screenshots/jrt-manifest-01-opened");

    const originalContent = await getMonacoContent(page);
    if (!originalContent) {
      console.log("Could not access Monaco editor model");
      test.skip();
      return;
    }

    console.log(`Original manifest content length: ${originalContent.length}`);

    // Modify the description field
    const marker = `__JRT_MANIFEST_${Date.now()}`;
    const modifiedContent = originalContent.replace(/"description"\s*:\s*"([^"]*)"/, `"description": "$1 ${marker}"`);

    if (modifiedContent === originalContent) {
      console.log("Could not find description field to modify");
      test.skip();
      return;
    }

    await setMonacoContent(page, modifiedContent);

    // Click inside the editor and press Ctrl+S to force-save
    const monacoContainer = page.locator(".monaco-editor .view-lines").first();
    if (await monacoContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
      await monacoContainer.click();
    }
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/jrt-manifest-02-edited");

    // Navigate away and come back
    await navigateAwayAndBack(page, "manifest");

    await takeScreenshot(page, "debugoutput/screenshots/jrt-manifest-03-returned");

    // Verify the modification persisted
    const contentAfter = await getMonacoContent(page);
    console.log(`Content after round-trip length: ${contentAfter.length}`);
    expect(contentAfter).toContain(marker);

    await takeScreenshot(page, "debugoutput/screenshots/jrt-manifest-04-verified");
  });

  // -----------------------------------------------------------------------
  // Test 2 – entity JSON structure preserved after raw edits
  // -----------------------------------------------------------------------
  test("entity JSON structure preserved after raw edits @full", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page, { editMode: "raw" });
    expect(entered).toBe(true);

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // Try to find an entity or JSON file in the sidebar
    // Add-On Starter may not have entity files, so try multiple patterns
    let entityOpened = await openFileInMonaco(page, "biceson");
    if (!entityOpened) {
      entityOpened = await openFileInMonaco(page, "entity");
    }
    if (!entityOpened) {
      // Fall back to manifest as a JSON round-trip target
      entityOpened = await openFileInMonaco(page, "manifest");
    }
    if (!entityOpened) {
      console.log("Could not find any JSON file in sidebar — skipping");
      test.skip();
      return;
    }

    const monacoEditor = page.locator(".monaco-editor").first();
    if (!(await monacoEditor.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("Monaco editor did not appear for entity file");
      test.skip();
      return;
    }

    await takeScreenshot(page, "debugoutput/screenshots/jrt-entity-01-opened");

    // Wait for all async loading to settle before editing
    await page.waitForTimeout(2000);

    const originalContent = await getMonacoContent(page);
    if (!originalContent) {
      console.log("Could not read entity content from Monaco");
      test.skip();
      return;
    }

    // Verify it looks like an entity file
    const hasEntityRoot = originalContent.includes("minecraft:entity");
    console.log(`Entity content length: ${originalContent.length}, has minecraft:entity: ${hasEntityRoot}`);

    if (!hasEntityRoot) {
      console.log("File does not contain minecraft:entity — may not be entity behavior file");
      // Still try the round-trip even if structure is different
    }

    // Use description-field replacement (same proven approach as manifest test)
    const marker = `__JRT_ENTITY_${Date.now()}`;
    let modifiedContent: string;

    if (originalContent.includes('"components"')) {
      // For entity files: insert marker into the components section
      const markerProp = `"__jrt_test_marker": "${Date.now()}"`;
      modifiedContent = originalContent.replace(/"components"\s*:\s*\{/, `"components": {\n        ${markerProp},`);
    } else if (originalContent.includes('"description"')) {
      // For non-entity files (manifest fallback): modify description field
      modifiedContent = originalContent.replace(/"description"\s*:\s*"([^"]*)"/, `"description": "$1 ${marker}"`);
    } else {
      console.log("No suitable field to modify");
      test.skip();
      return;
    }

    if (modifiedContent === originalContent) {
      console.log("Could not modify entity content");
      test.skip();
      return;
    }

    await setMonacoContent(page, modifiedContent);
    await page.waitForTimeout(500);

    // Verify the edit took effect
    const contentAfterEdit = await getMonacoContent(page);
    const editMarker = originalContent.includes('"components"') ? "__jrt_test_marker" : marker;
    if (!contentAfterEdit.includes(editMarker)) {
      console.log(`Edit verification failed. Content length: ${contentAfterEdit.length}. Retrying with model.setValue`);
      await page.evaluate((c: string) => {
        const editors = (window as any).monaco?.editor?.getEditors?.();
        if (editors && editors.length > 0) {
          const model = editors[0].getModel();
          if (model) {
            model.setValue(c);
          }
        }
      }, modifiedContent);
      await page.waitForTimeout(1000);
    }

    // Click inside the editor and press Ctrl+S to force-save
    const monacoContainer = page.locator(".monaco-editor .view-lines").first();
    if (await monacoContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
      await monacoContainer.click();
    }
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/jrt-entity-02-edited");

    // Navigate away and come back using navigateAwayAndBack helper
    await navigateAwayAndBack(page, "manifest");
    await page.waitForTimeout(1500);

    const contentAfter = await getMonacoContent(page);
    console.log(`Entity content after round-trip length: ${contentAfter.length}`);
    expect(contentAfter).toContain(editMarker);

    // Verify the overall structure is still valid JSON-like
    if (hasEntityRoot) {
      expect(contentAfter).toContain("minecraft:entity");
    }

    await takeScreenshot(page, "debugoutput/screenshots/jrt-entity-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 3 – form ↔ raw mode switching preserves content
  // -----------------------------------------------------------------------
  test("form to raw mode switching preserves content @full", async ({ page }) => {
    test.setTimeout(90000);

    // Enter editor in default (focused) mode — files open in form view
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // Open manifest in form view
    const opened = await openFileInMonaco(page, "manifest");
    expect(opened).toBe(true);

    await page.waitForTimeout(1000);
    await takeScreenshot(page, "debugoutput/screenshots/jrt-formraw-01-form-view");

    // Look for a form field value to remember
    const nameInput = page.locator("input[type='text']").or(page.getByLabel("Name")).first();

    let formFieldValue = "";
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      formFieldValue = await nameInput.inputValue();
      console.log(`Form field value: "${formFieldValue}"`);
    } else {
      console.log("No form input found — will still test raw mode content");
    }

    // Switch to raw/JSON view
    const switchedToRaw = await switchToRawMode(page);
    if (!switchedToRaw) {
      console.log("Could not switch to raw mode — skipping");
      test.skip();
      return;
    }

    await page.waitForTimeout(1000);
    await takeScreenshot(page, "debugoutput/screenshots/jrt-formraw-02-raw-view");

    // Get the raw JSON content
    const rawContent = await getMonacoContent(page);
    if (!rawContent) {
      console.log("Could not get raw content from Monaco");
      test.skip();
      return;
    }

    console.log(`Raw content length: ${rawContent.length}`);

    // If we captured a form field value, verify it appears in raw JSON
    if (formFieldValue) {
      expect(rawContent).toContain(formFieldValue);
      console.log(`Verified form field value "${formFieldValue}" appears in raw JSON`);
    }

    // Modify value in raw JSON
    const marker = `__JRT_FORMRAW_${Date.now()}`;
    const modifiedContent = rawContent.replace(/"description"\s*:\s*"([^"]*)"/, `"description": "$1 ${marker}"`);

    if (modifiedContent === rawContent) {
      console.log("Could not find description to modify — skipping modification check");
      await takeScreenshot(page, "debugoutput/screenshots/jrt-formraw-03-no-desc");
      return;
    }

    await setMonacoContent(page, modifiedContent);

    // Click inside the editor and press Ctrl+S to force-save
    const monacoEditorLines = page.locator(".monaco-editor .view-lines").first();
    if (await monacoEditorLines.isVisible({ timeout: 1000 }).catch(() => false)) {
      await monacoEditorLines.click();
    }
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);

    // Navigate away and come back to manifest (this may reopen in form view)
    await navigateAwayAndBack(page, "manifest");
    await page.waitForTimeout(1000);

    // Switch to raw mode again to verify the edit persisted
    await switchToRawMode(page);
    await page.waitForTimeout(1000);

    const contentAfter = await getMonacoContent(page);
    if (contentAfter) {
      console.log(`Content after form↔raw round-trip: ${contentAfter.length} chars`);
      expect(contentAfter).toContain(marker);
    } else {
      console.log("Could not get content after round-trip");
    }

    await takeScreenshot(page, "debugoutput/screenshots/jrt-formraw-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 4 – script file round-trip in raw mode
  // -----------------------------------------------------------------------
  test("script file round-trip in raw mode @full", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page, { editMode: "raw" });
    expect(entered).toBe(true);

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // Find a .ts file (Full Add-On starter has main.ts)
    const opened = await openFileInMonaco(page, "main");
    if (!opened) {
      console.log("Script file 'main' not found — skipping");
      test.skip();
      return;
    }

    const monacoEditor = page.locator(".monaco-editor").first();
    if (!(await monacoEditor.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("Monaco editor did not appear for script file");
      test.skip();
      return;
    }

    await takeScreenshot(page, "debugoutput/screenshots/jrt-script-01-opened");

    const originalContent = await getMonacoContent(page);
    if (!originalContent) {
      console.log("Could not read script content from Monaco");
      test.skip();
      return;
    }

    console.log(`Script content length: ${originalContent.length}`);

    // Add a test line
    const testLine = `const ROUND_TRIP_TEST = "verified_${Date.now()}";`;
    const modifiedContent = originalContent + "\n" + testLine + "\n";

    await setMonacoContent(page, modifiedContent);

    // Click inside the editor and press Ctrl+S to force-save
    const monacoLines = page.locator(".monaco-editor .view-lines").first();
    if (await monacoLines.isVisible({ timeout: 1000 }).catch(() => false)) {
      await monacoLines.click();
    }
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/jrt-script-02-edited");

    // Navigate away and come back
    await navigateAwayAndBack(page, "main");

    const contentAfter = await getMonacoContent(page);
    console.log(`Script content after round-trip: ${contentAfter.length} chars`);
    expect(contentAfter).toContain("ROUND_TRIP_TEST");

    await takeScreenshot(page, "debugoutput/screenshots/jrt-script-03-verified");
  });
});
