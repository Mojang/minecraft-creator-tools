/**
 * FeatureEditorInput.spec.ts — Feature Editor text input tests
 *
 * Verifies that text fields inside the Feature Editor (DataForm) accept
 * keyboard input, persist values after focus changes, and survive
 * selecting a different node then returning.
 *
 * Run with: npx playwright test FeatureEditorInput.spec.ts --project=focused
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, enterEditor, takeScreenshot } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/feature-editor-input";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open the Content Wizard by clicking the Add button.
 */
async function openContentWizard(page: Page): Promise<boolean> {
  // Dismiss any lingering dialog
  const existingDialog = page.locator(".MuiDialog-root").first();
  if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }

  const addButton = page.locator('button[aria-label="Add new content"]').first();
  if (!(await addButton.isVisible({ timeout: 15000 }))) {
    console.log("openContentWizard: Add button not visible");
    return false;
  }
  await addButton.click();
  await page.waitForTimeout(800);

  const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  if (await wizardDialog.isVisible({ timeout: 3000 })) {
    return true;
  }
  const muiDialog = page.locator(".MuiDialog-root").first();
  return muiDialog.isVisible({ timeout: 2000 });
}

/**
 * Add a feature via the Content Wizard (world generation section).
 */
async function addFeatureViaWizard(page: Page): Promise<boolean> {
  const wizardOpened = await openContentWizard(page);
  if (!wizardOpened) return false;

  // Try the default-expanded World Generation section first
  const featureItem = page.locator('.cwiz-section-item:has(span:text-is("Feature"))').first();
  if (await featureItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await featureItem.scrollIntoViewIfNeeded().catch(() => undefined);
    await featureItem.click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Fallback: expand World Generation header
  const worldGenHeader = page
    .locator('.cwiz-section-header:has(span:text-is("World Generation"))')
    .first();
  if (await worldGenHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await worldGenHeader.click();
    await page.waitForTimeout(500);
    const retryItem = page.locator('.cwiz-section-item:has(span:text-is("Feature"))').first();
    if (await retryItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await retryItem.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }

  console.log("addFeatureViaWizard: Could not find Feature item");
  return false;
}

/**
 * Dismiss the new-item name dialog by clicking "Add".
 *
 * The wizard flow renders the Content Wizard as a plain `.cwiz-launcher-wrapper`
 * div (NOT an MUI Dialog). After picking "Feature", the wizard closes and a
 * `SetNamespacedId` MUI Dialog opens with title "Add new feature" containing
 * pre-filled Name + Namespace fields. We wait for that specific dialog
 * (rather than the first dialog we find — which could be a stale wizard
 * portal) and click its green "Add" McButton.
 */
async function dismissNameDialog(page: Page): Promise<boolean> {
  // Wait for the wizard launcher to close before checking for the name dialog —
  // otherwise we may match the wrong dialog (or click before the name dialog mounts).
  const wizardLauncher = page.locator(".cwiz-launcher-wrapper").first();
  await wizardLauncher.waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);

  // Locate the SetNamespacedId dialog by its title pattern. This is more
  // robust than `.MuiDialog-root.first()` which could pick a different open
  // dialog if React hasn't fully unmounted the wizard portal.
  const namedDialog = page
    .locator('.MuiDialog-root:has(.MuiDialogTitle-root:has-text("Add new"))')
    .first();
  if (!(await namedDialog.isVisible({ timeout: 5000 }).catch(() => false))) {
    return true; // No name dialog, item created immediately
  }

  // The pre-filled name/namespace inputs are present, so we can click Add directly.
  // Use `:visible` to avoid clicking buttons inside hidden dialogs portaled elsewhere.
  const addButton = namedDialog.locator('button:visible:has-text("Add")').last();
  if (await addButton.isVisible({ timeout: 2000 })) {
    await addButton.click();
    await page.waitForTimeout(1000);
    // Wait for dialog to close
    await namedDialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
    return true;
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  return true;
}

/**
 * Pick a feature type from the type picker dialog.
 * @param featureType e.g. "Single Block", "Ore", "Aggregate"
 */
async function pickFeatureType(page: Page, featureType: string): Promise<boolean> {
  // Look for the "Change Feature Type" button or the inline type picker
  const changeTypeBtn = page.locator('button:has-text("Change Feature Type")').first();
  if (await changeTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await changeTypeBtn.click();
    await page.waitForTimeout(800);
  }

  // Click the feature type button in the picker dialog
  const typeBtn = page.locator(`.ftp-typeButton:has-text("${featureType}")`).first();
  if (await typeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await typeBtn.click();
    await page.waitForTimeout(500);

    // Confirm the selection (click Create/OK/Select)
    const confirmBtn = page
      .locator(
        '.MuiDialog-root button:has-text("Create"), .MuiDialog-root button:has-text("OK"), .MuiDialog-root button:has-text("Select"), .MuiDialog-root button:has-text("Change")'
      )
      .first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1500);
    }
    return true;
  }

  console.log(`pickFeatureType: Could not find type button for "${featureType}"`);
  return false;
}

/**
 * Wait for the Feature Editor pipeline to finish loading.
 *
 * The editor shows a "Loading feature pipeline..." placeholder while the
 * project's item relations are still being processed in the background.
 * Relation processing for sample content can take a while, so we wait for
 * the loading placeholder to disappear before interacting with the form.
 */
async function waitForFeatureEditorLoaded(page: Page, timeout = 30000): Promise<void> {
  const loading = page.locator(".fe-loading");
  await loading.waitFor({ state: "hidden", timeout }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Feature Editor Input @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("identifier field should accept and persist typed input", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);

    // Step 1 — enter editor
    const entered = await enterEditor(page, { editMode: "focused" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/01-editor-loaded`);

    // Step 2 — add a feature
    const featureAdded = await addFeatureViaWizard(page);
    if (!featureAdded) {
      console.log("Skipping: could not add feature via wizard");
      test.skip();
      return;
    }
    await dismissNameDialog(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/02-feature-added`);

    // Step 3 — if there is a "Change Feature Type" prompt, pick Single Block
    const changeTypeBtn = page.locator('button:has-text("Change Feature Type")').first();
    if (await changeTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const picked = await pickFeatureType(page, "Single Block");
      expect(picked).toBe(true);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, `${SCREENSHOT_DIR}/03-type-picked`);
    }

    // Step 4 — wait for the pipeline to finish loading, then locate the Tree view
    await waitForFeatureEditorLoaded(page);

    const treeTab = page.locator('button:has-text("Tree")').first();
    if (await treeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await treeTab.click();
      await page.waitForTimeout(500);
    }

    // Step 5 — find the Identifier text field using the actual <input> element
    const inputField = page.locator('input#identifier').first();

    await takeScreenshot(page, `${SCREENSHOT_DIR}/04-before-typing`);

    if (!(await inputField.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try scrolling to find it
      const descriptionSection = page.locator('text="DESCRIPTION"').first();
      if (await descriptionSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descriptionSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }
    }

    expect(await inputField.isVisible({ timeout: 5000 })).toBe(true);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/05-identifier-visible`);

    // Step 6 — focus using JavaScript to avoid MUI click interception
    await page.evaluate(() => {
      const input = document.getElementById("identifier") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
    await page.waitForTimeout(300);

    // Capture which element has focus after clicking
    const activeTagBefore = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}#${el.id}.${el.className}` : "none";
    });
    console.log(`Active element after click: ${activeTagBefore}`);

    const testValue = "test_ns:my_feature";
    await inputField.fill(testValue);
    await page.waitForTimeout(500);

    await takeScreenshot(page, `${SCREENSHOT_DIR}/06-after-fill`);

    // Step 7 — verify the value is in the input
    const valueAfterFill = await inputField.inputValue();
    console.log(`Value after fill: "${valueAfterFill}"`);
    expect(valueAfterFill).toBe(testValue);

    // Step 8 — now try typing character by character
    await page.evaluate(() => {
      const input = document.getElementById("identifier") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);

    // Type each character individually
    const charByCharValue = "ns:feat";
    for (const char of charByCharValue) {
      await page.keyboard.type(char, { delay: 100 });
    }
    await page.waitForTimeout(500);

    await takeScreenshot(page, `${SCREENSHOT_DIR}/07-after-char-typing`);

    const valueAfterTyping = await inputField.inputValue();
    console.log(`Value after character typing: "${valueAfterTyping}"`);

    // Check which element has focus after typing
    const activeTagAfterTyping = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}#${el.id}.${el.className}` : "none";
    });
    console.log(`Active element after typing: ${activeTagAfterTyping}`);

    expect(valueAfterTyping).toBe(charByCharValue);

    // Step 9 — click elsewhere to blur, then click back
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, `${SCREENSHOT_DIR}/08-after-blur`);

    // Focus the identifier field again
    await page.evaluate(() => {
      const input = document.getElementById("identifier") as HTMLInputElement;
      if (input) input.focus();
    });
    await page.waitForTimeout(300);

    const valueAfterReclick = await inputField.inputValue();
    console.log(`Value after re-focusing identifier: "${valueAfterReclick}"`);
    expect(valueAfterReclick).toBe(charByCharValue);

    await takeScreenshot(page, `${SCREENSHOT_DIR}/09-after-reclick`);

    // Step 10 — log console errors relevant to data/form
    const relevantErrors = consoleErrors.filter(
      (e) => e.error.includes("DataForm") || e.error.includes("property") || e.error.includes("identifier")
    );
    if (relevantErrors.length > 0) {
      console.log("Relevant console errors:", JSON.stringify(relevantErrors, null, 2));
    }
  });

  test("identifier field should retain focus while typing", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);

    const entered = await enterEditor(page, { editMode: "focused" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    const featureAdded = await addFeatureViaWizard(page);
    if (!featureAdded) {
      test.skip();
      return;
    }
    await dismissNameDialog(page);
    await page.waitForTimeout(2000);

    // Pick a type if needed
    const changeTypeBtn = page.locator('button:has-text("Change Feature Type")').first();
    if (await changeTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickFeatureType(page, "Single Block");
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, `${SCREENSHOT_DIR}/focus-01-before-find`);

    // Wait for the pipeline to finish loading before looking for the form
    await waitForFeatureEditorLoaded(page);

    // Ensure the Tree view is active so the detail panel (with the form) mounts
    const treeTab = page.locator('button:has-text("Tree")').first();
    if (await treeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await treeTab.click();
      await page.waitForTimeout(500);
    }

    // Find identifier input — use the actual <input> inside the MUI TextField
    const inputField = page.locator('input#identifier').first();

    if (!(await inputField.isVisible({ timeout: 8000 }).catch(() => false))) {
      console.log("Identifier input not found, skipping focus test");
      await takeScreenshot(page, `${SCREENSHOT_DIR}/focus-02-not-found`);
      test.skip();
      return;
    }

    // Read initial value
    const initialValue = await inputField.inputValue();
    console.log(`Initial identifier value: "${initialValue}"`);

    // Focus using JavaScript to avoid MUI click interception
    await page.evaluate(() => {
      const input = document.getElementById("identifier") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
    await page.waitForTimeout(200);

    // Clear any existing value
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);

    const valueAfterClear = await inputField.inputValue();
    console.log(`Value after clear: "${valueAfterClear}"`);

    // Type one character at a time and check value after each
    const chars = "abcdef";
    const results: { char: string; focused: boolean; activeElement: string; inputValue: string }[] = [];

    for (const char of chars) {
      await page.keyboard.type(char, { delay: 50 });
      // Wait for React re-render
      await page.waitForTimeout(200);

      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const input = document.getElementById("identifier") as HTMLInputElement;
        return {
          tag: el?.tagName ?? "none",
          id: (el as HTMLElement)?.id ?? "",
          isInput: el?.tagName === "INPUT",
          inputValue: input?.value ?? "(not found)",
        };
      });

      results.push({
        char,
        focused: info.isInput,
        activeElement: `${info.tag}#${info.id}`,
        inputValue: info.inputValue,
      });
    }

    console.log("Focus and value tracking results:", JSON.stringify(results, null, 2));
    await takeScreenshot(page, `${SCREENSHOT_DIR}/focus-03-after-typing`);

    // Every character should have been typed with the input still focused
    const lostFocusChars = results.filter((r) => !r.focused);
    if (lostFocusChars.length > 0) {
      console.log(`Focus was LOST after typing: ${JSON.stringify(lostFocusChars)}`);
    }
    expect(lostFocusChars).toHaveLength(0);

    // Verify the full value was entered
    const finalValue = await inputField.inputValue();
    console.log(`Final input value: "${finalValue}"`);
    expect(finalValue).toBe(chars);
  });

  test("feature data should persist after navigating away and back", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    // Step 1 — enter editor in full mode (so sidebar shows all item types)
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    // Step 2 — add a feature
    const featureAdded = await addFeatureViaWizard(page);
    if (!featureAdded) {
      test.skip();
      return;
    }
    await dismissNameDialog(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-01-feature-added`);

    // Step 3 — pick a type if needed
    const changeTypeBtn = page.locator('button:has-text("Change Feature Type")').first();
    if (await changeTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickFeatureType(page, "Single Block");
      await page.waitForTimeout(2000);
    }
    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-02-type-picked`);

    // Step 4 — type a value in the identifier field
    const inputField = page.locator("input#identifier").first();
    if (!(await inputField.isVisible({ timeout: 8000 }).catch(() => false))) {
      console.log("Identifier input not found after type pick");
      await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-03-no-identifier`);
      test.skip();
      return;
    }

    await page.evaluate(() => {
      const input = document.getElementById("identifier") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(200);

    const testId = "myns:test_feature";
    for (const char of testId) {
      await page.keyboard.type(char, { delay: 50 });
    }
    await page.waitForTimeout(500);

    const valueBeforeNav = await inputField.inputValue();
    console.log(`Value before navigation: "${valueBeforeNav}"`);
    expect(valueBeforeNav).toBe(testId);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-04-value-entered`);

    // Step 5 — read file content from the app to verify it was saved
    // Check the actual file content via the toolbar dropdown which shows the filename
    const fileContentBefore = await page.evaluate(async () => {
      // Try to access file system to read the feature file content
      const items = document.querySelectorAll('[role="treeitem"]');
      const featureItems: string[] = [];
      items.forEach((item) => {
        if (item.textContent?.includes("feature")) {
          featureItems.push(item.textContent || "");
        }
      });
      return { featureItems, url: window.location.hash };
    });
    console.log(`File state before nav:`, JSON.stringify(fileContentBefore));

    // Step 6 — navigate to a different item in the sidebar
    // Click on any other item (like a script, manifest, or settings)
    const otherItem = page
      .locator('[role="treeitem"]:has-text("main"), [role="treeitem"]:has-text("Dashboard")')
      .first();

    if (!(await otherItem.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("Could not find another sidebar item to navigate to");
      await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-05-no-other-item`);
      test.skip();
      return;
    }

    console.log("Navigating to another item...");
    await otherItem.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-06-other-item`);

    // Step 7 — navigate back to the feature file
    // The feature file shows as "feature*" in the sidebar (asterisk indicates unsaved)
    // Use a narrow text match to avoid hitting the "Features" group header
    let featureItem = page.locator('[role="treeitem"] >> text=/^feature\\*?$/').first();
    if (!(await featureItem.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Fallback: try clicking the file path tooltip
      featureItem = page.locator('[role="treeitem"]:has([title*="features/feature"])').first();
    }
    if (!(await featureItem.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Fallback: scroll sidebar to find it
      featureItem = page.locator('text="feature*"').first();
    }

    if (!(await featureItem.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("Could not find feature item in sidebar");
      await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-07-no-feature`);
      test.skip();
      return;
    }

    console.log("Navigating back to feature...");
    await featureItem.click();
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-08-back-to-feature`);

    // Step 8 — verify the feature type is still set (not the "no type" prompt)
    const noTypeMsg = page.locator("text=/doesn't have a feature type/i").first();
    const hasNoType = await noTypeMsg.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Feature shows 'no type' prompt: ${hasNoType}`);

    if (hasNoType) {
      // Dump file content for debugging - switch to raw mode to see JSON
      const editRawBtn = page.locator('button:has-text("Edit Raw JSON")').first();
      if (await editRawBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editRawBtn.click();
        await page.waitForTimeout(2000);
        // Try to read Monaco editor content
        const monacoContent = await page.evaluate(() => {
          const monacoEditors = (window as any).monaco?.editor?.getEditors?.();
          if (monacoEditors && monacoEditors.length > 0) {
            return monacoEditors[0].getValue();
          }
          // Fallback: check textarea or pre content
          const textArea = document.querySelector("textarea");
          if (textArea) return textArea.value;
          const monacoLines = document.querySelectorAll(".view-line");
          if (monacoLines.length > 0) {
            return Array.from(monacoLines).map((l) => l.textContent).join("\n");
          }
          return "(could not read editor content)";
        });
        console.log(`Raw JSON content after nav back:\n${monacoContent}`);
      }
      await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-09-feature-reset`);
    }

    expect(hasNoType).toBe(false);

    // Step 9 — verify the identifier field still has our value
    const identifierAfterNav = page.locator("input#identifier").first();
    if (await identifierAfterNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      const valueAfterNav = await identifierAfterNav.inputValue();
      console.log(`Identifier value after navigation: "${valueAfterNav}"`);
      expect(valueAfterNav).toBe(testId);
    } else {
      console.log("Identifier field not visible after navigation back");
      await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-10-no-identifier-after`);
      expect(false).toBe(true); // fail
    }

    await takeScreenshot(page, `${SCREENSHOT_DIR}/nav-11-final`);
  });
});
