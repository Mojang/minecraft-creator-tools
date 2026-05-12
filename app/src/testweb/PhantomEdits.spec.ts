/**
 * Phantom Edit Detection Tests
 *
 * These tests verify that simply viewing files does NOT mark them as modified.
 * "Phantom edits" occur when the editor pipeline (formatting, comment stripping,
 * key reordering, etc.) changes file content during load without any user action.
 *
 * Test approach:
 * 1. Create a project (Add-On Starter or Full Add-On)
 * 2. Open it in raw mode so every file opens in Monaco
 * 3. Click through every file in the sidebar
 * 4. Verify no files show the modification indicator (asterisk in name)
 * 5. Verify project.changedFilesSinceLastSaved is empty
 *
 * Run with: npx playwright test PhantomEdits.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  enableAllFileTypes,
  takeScreenshot,
  gotoWithTheme,
  selectEditMode,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
  clickTemplateCreateButton,
  waitForEditorReady,
  ThemeMode,
} from "./WebTestUtilities";

/**
 * Create a Full Add-On project which has more file types (entities, blocks, items, scripts).
 */
async function createFullAddOnProject(page: Page, themeMode?: ThemeMode): Promise<boolean> {
  try {
    if (themeMode) {
      await gotoWithTheme(page, themeMode, "/");
    } else {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);

    // Click the Full Add-On template's "Create New" button via stable test id
    const clicked = await clickTemplateCreateButton(page, "addonFull");
    if (!clicked) {
      console.log("createFullAddOnProject: Could not find Full Add-On create button");
      return false;
    }
    await page.waitForTimeout(1000);

    // Handle the storage location dialog before clicking submit
    await preferBrowserStorageInProjectDialog(page);

    // The dialog requires a non-empty Creator field; fill it if blank
    await fillRequiredProjectDialogFields(page);

    // Click Create/OK on the project dialog
    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      await okButton.click();
    } else {
      const altOk = page.locator("button:has-text('OK')").first();
      if (await altOk.isVisible({ timeout: 2000 })) {
        await altOk.click();
      } else {
        await page.keyboard.press("Enter");
      }
    }

    // Full Add-On fetches from GitHub; allow extra time and use the shared
    // editor-ready helper which polls multiple toolbar/welcome variants.
    await page.waitForTimeout(3000);
    const ready = await waitForEditorReady(page, 25000);
    if (!ready) {
      console.log("createFullAddOnProject: editor did not become ready");
      return false;
    }

    // Select raw mode (best-effort; not fatal if menu state differs)
    await selectEditMode(page, "raw").catch(() => {});

    return true;
  } catch (error) {
    console.log(`createFullAddOnProject: Error - ${error}`);
    return false;
  }
}

/**
 * Get all visible sidebar item names and their elements.
 */
async function getSidebarItems(page: Page): Promise<{ name: string; index: number }[]> {
  const items = page.locator(".pit-name");
  const count = await items.count();
  const result: { name: string; index: number }[] = [];

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    if (await item.isVisible({ timeout: 300 }).catch(() => false)) {
      const text = ((await item.textContent()) || "").trim();
      if (text.length > 0) {
        result.push({ name: text, index: i });
      }
    }
  }

  return result;
}

/**
 * Check if any file in the sidebar shows a modification indicator (asterisk).
 * Returns the list of modified file names.
 */
async function getModifiedFileNames(page: Page): Promise<string[]> {
  const items = page.locator(".pit-name");
  const count = await items.count();
  const modified: string[] = [];

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    if (await item.isVisible({ timeout: 300 }).catch(() => false)) {
      const text = ((await item.textContent()) || "").trim();
      if (text.endsWith("*")) {
        modified.push(text);
      }
    }
  }

  return modified;
}

test.describe("Phantom Edit Detection @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("viewing files in raw mode should not create phantom edits (Add-On Starter)", async ({ page }) => {
    test.setTimeout(120000);

    // Create an Add-On Starter project in raw mode
    const entered = await enterEditor(page, { editMode: "raw" });
    expect(entered).toBe(true);

    // Enable all file types so we can see everything
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-starter-initial");

    // Get all sidebar items
    const sidebarItems = await getSidebarItems(page);
    console.log(`Found ${sidebarItems.length} sidebar items to check`);

    // Before clicking anything, check for existing modifications
    const modifiedBefore = await getModifiedFileNames(page);
    console.log(`Modified files before clicking: ${modifiedBefore.length} [${modifiedBefore.join(", ")}]`);

    // Click each file and wait for it to load
    const items = page.locator(".pit-name");
    let filesClicked = 0;

    for (const entry of sidebarItems) {
      try {
        const item = items.nth(entry.index);
        if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;

        await item.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await item.click();
        filesClicked++;

        // Wait for the editor to load the file content
        await page.waitForTimeout(1500);

        // Check if Monaco editor appeared and has content
        const monacoEditor = page.locator(".monaco-editor").first();
        if (await monacoEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Wait a bit more for formatting to settle
          await page.waitForTimeout(500);
        }

        console.log(`Clicked file ${filesClicked}: "${entry.name}"`);
      } catch (error) {
        console.log(`Error clicking "${entry.name}": ${error}`);
      }
    }

    console.log(`Total files clicked: ${filesClicked}`);

    // Wait for any delayed formatting or processing to complete
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-starter-after-clicking");

    // Check for phantom edits - no files should show modification indicator
    const modifiedAfter = await getModifiedFileNames(page);

    if (modifiedAfter.length > 0) {
      console.log(`PHANTOM EDITS DETECTED: ${modifiedAfter.length} files modified without user changes:`);
      for (const name of modifiedAfter) {
        console.log(`  - ${name}`);
      }
      await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-starter-FAIL");
    }

    // The core assertion: no files should be modified
    expect(modifiedAfter).toEqual([]);
  });

  test("viewing files in raw mode should not create phantom edits (Full Add-On)", async ({ page }) => {
    test.setTimeout(180000);

    // Create a Full Add-On project (has entities, blocks, items, scripts)
    const created = await createFullAddOnProject(page);
    expect(created).toBe(true);

    // Enable all file types so we can see everything
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-fulladdon-initial");

    // Get all sidebar items
    const sidebarItems = await getSidebarItems(page);
    console.log(`Found ${sidebarItems.length} sidebar items to check`);

    // Before clicking anything, check for existing modifications
    const modifiedBefore = await getModifiedFileNames(page);
    console.log(`Modified files before clicking: ${modifiedBefore.length} [${modifiedBefore.join(", ")}]`);

    // Click each file and wait for it to load
    const items = page.locator(".pit-name");
    let filesClicked = 0;

    for (const entry of sidebarItems) {
      try {
        const item = items.nth(entry.index);
        if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;

        await item.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await item.click();
        filesClicked++;

        // Wait for the editor to load the file content
        await page.waitForTimeout(1500);

        // Check if Monaco editor appeared and has content
        const monacoEditor = page.locator(".monaco-editor").first();
        if (await monacoEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Wait for formatting to settle
          await page.waitForTimeout(500);
        }

        console.log(`Clicked file ${filesClicked}: "${entry.name}"`);
      } catch (error) {
        console.log(`Error clicking "${entry.name}": ${error}`);
      }
    }

    console.log(`Total files clicked: ${filesClicked}`);

    // Wait for any delayed processing to complete
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-fulladdon-after-clicking");

    // Check for phantom edits
    const modifiedAfter = await getModifiedFileNames(page);

    if (modifiedAfter.length > 0) {
      console.log(`PHANTOM EDITS DETECTED: ${modifiedAfter.length} files modified without user changes:`);
      for (const name of modifiedAfter) {
        console.log(`  - ${name}`);
      }
      await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-fulladdon-FAIL");
    }

    // The core assertion: no files should be modified
    expect(modifiedAfter).toEqual([]);
  });

  test("switching editor modes should not create phantom edits", async ({ page }) => {
    test.setTimeout(120000);

    // Create an Add-On Starter project
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Click on a manifest file to open it
    const manifestItem = page.locator(".pit-name:has-text('manifest')").first();
    if (await manifestItem.isVisible({ timeout: 3000 })) {
      await manifestItem.click();
      await page.waitForTimeout(2000);
    }

    // Switch between modes: full → raw → full
    // First switch to raw mode via settings
    const settingsButton = page.locator('button[title="Settings"], [aria-label="Settings"]').first();
    if (await settingsButton.isVisible({ timeout: 3000 })) {
      await settingsButton.click();
      await page.waitForTimeout(600);

      const rawButton = page.locator('button:has-text("Raw")').first();
      if (await rawButton.isVisible({ timeout: 2000 })) {
        await rawButton.click();
        await page.waitForTimeout(1500);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Click the manifest again in raw mode
    if (await manifestItem.isVisible({ timeout: 3000 })) {
      await manifestItem.click();
      await page.waitForTimeout(2000);
    }

    // Switch back to full mode
    if (await settingsButton.isVisible({ timeout: 3000 })) {
      await settingsButton.click();
      await page.waitForTimeout(600);

      const fullButton = page.locator('button:has-text("Full")').first();
      if (await fullButton.isVisible({ timeout: 2000 })) {
        await fullButton.click();
        await page.waitForTimeout(1500);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Click the manifest again
    if (await manifestItem.isVisible({ timeout: 3000 })) {
      await manifestItem.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-mode-switch-after");

    // Check for phantom edits
    const modifiedAfter = await getModifiedFileNames(page);

    if (modifiedAfter.length > 0) {
      console.log(`PHANTOM EDITS from mode switching: ${modifiedAfter.join(", ")}`);
      await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-mode-switch-FAIL");
    }

    expect(modifiedAfter).toEqual([]);
  });

  test("viewing entity/block/item form editors should not create phantom edits", async ({ page }) => {
    test.setTimeout(180000);

    // Create a Full Add-On project in form mode (focused)
    const created = await createFullAddOnProject(page);
    expect(created).toBe(true);

    // Switch to focused mode to get form editors. Use the shared helper which
    // already handles welcome-panel and View-menu states. The previous inline
    // Settings-menu workflow could leave a MUI backdrop overlay intercepting
    // subsequent clicks on sidebar items.
    await selectEditMode(page, "focused");
    await page.waitForTimeout(500);

    // Defensive: ensure no MUI menu overlay remains before clicking sidebar
    const lingeringBackdrop = page.locator(".MuiBackdrop-root").first();
    if (await lingeringBackdrop.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-form-initial");

    // Get all sidebar items
    const sidebarItems = await getSidebarItems(page);
    console.log(`Found ${sidebarItems.length} sidebar items in focused mode`);

    // Click through each item to open its form editor
    const items = page.locator(".pit-name");
    let filesClicked = 0;

    for (const entry of sidebarItems) {
      try {
        const item = items.nth(entry.index);
        if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;

        // Defensive: dismiss any lingering menu/popover before each click.
        // Tab selectors below can accidentally open a View/Settings menu
        // whose invisible MUI backdrop then intercepts further clicks.
        const lingeringMenu = page.locator(".MuiPopover-root.MuiMenu-root").first();
        if (await lingeringMenu.isVisible({ timeout: 200 }).catch(() => false)) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        }

        await item.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await item.click();
        filesClicked++;

        // Wait for form editor to load
        await page.waitForTimeout(2000);

        // For entity/block/item types, click through tabs to exercise form
        // editors. Scope to known editor containers and require role=tab so we
        // don't accidentally activate menu items / toolbar buttons that share
        // the same label (e.g. a "Components" item in the View menu).
        const tabNames = ["Overview", "Components", "Properties", "Actions", "Visuals", "States", "Permutations"];
        const editorScope = page.locator(".ete-area, .bte-area, .ite-area, [role='tablist']").first();
        for (const tabName of tabNames) {
          const tab = editorScope
            .locator(
              `[role='tab']:has-text("${tabName}"), button[role='tab'][title*="${tabName}"]`
            )
            .first();
          if (await tab.isVisible({ timeout: 300 }).catch(() => false)) {
            await tab.click().catch(() => {});
            await page.waitForTimeout(300);
          }
        }

        console.log(`Clicked file ${filesClicked}: "${entry.name}"`);
      } catch (error) {
        console.log(`Error clicking "${entry.name}": ${error}`);
      }
    }

    console.log(`Total files clicked: ${filesClicked}`);

    // Wait for any delayed processing
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-form-after-clicking");

    // Check for phantom edits
    const modifiedAfter = await getModifiedFileNames(page);

    if (modifiedAfter.length > 0) {
      console.log(`PHANTOM EDITS from form editors: ${modifiedAfter.length} files modified:`);
      for (const name of modifiedAfter) {
        console.log(`  - ${name}`);
      }
      await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-form-FAIL");
    }

    // The core assertion: no files should be modified
    expect(modifiedAfter).toEqual([]);
  });

  test("raw-to-form-to-raw round trip should not create phantom edits", async ({ page }) => {
    test.setTimeout(120000);

    // Create an Add-On Starter project in raw mode first
    const entered = await enterEditor(page, { editMode: "raw" });
    expect(entered).toBe(true);

    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Open the manifest file in raw mode (manifest always exists)
    const manifestItem = page.locator(".pit-name").filter({ hasText: "manifest" }).first();
    if (!(await manifestItem.isVisible({ timeout: 5000 }))) {
      // Try expanding Behavior pack manifests section
      const bpSection = page.locator("text=Behavior pack manifests").first();
      if (await bpSection.isVisible({ timeout: 2000 })) {
        await bpSection.click();
        await page.waitForTimeout(500);
      }
    }

    const targetItem = page.locator(".pit-name").filter({ hasText: "manifest" }).first();
    expect(await targetItem.isVisible({ timeout: 5000 })).toBe(true);
    await targetItem.click();
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-roundtrip-raw1");

    // Switch to focused/form mode via settings
    const settingsButton = page.locator('button[title="Settings"], [aria-label="Settings"]').first();
    if (await settingsButton.isVisible({ timeout: 3000 })) {
      await settingsButton.click();
      await page.waitForTimeout(600);

      const focusedButton = page.locator('button:has-text("Focused")').first();
      if (await focusedButton.isVisible({ timeout: 2000 })) {
        await focusedButton.click();
        await page.waitForTimeout(1500);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Re-click the manifest file to see it in form view
    const manifestInFocused = page.locator(".pit-name").filter({ hasText: "manifest" }).first();
    if (await manifestInFocused.isVisible({ timeout: 3000 })) {
      await manifestInFocused.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-roundtrip-form");

    // Switch back to raw mode
    if (await settingsButton.isVisible({ timeout: 3000 })) {
      await settingsButton.click();
      await page.waitForTimeout(600);

      const rawButton = page.locator('button:has-text("Raw")').first();
      if (await rawButton.isVisible({ timeout: 2000 })) {
        await rawButton.click();
        await page.waitForTimeout(1500);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Re-click the manifest file in raw mode
    const manifestInRaw = page.locator(".pit-name").filter({ hasText: "manifest" }).first();
    if (await manifestInRaw.isVisible({ timeout: 3000 })) {
      await manifestInRaw.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-roundtrip-raw2");

    // Check for phantom edits
    const modifiedAfter = await getModifiedFileNames(page);

    if (modifiedAfter.length > 0) {
      console.log(`PHANTOM EDITS from raw→form→raw: ${modifiedAfter.join(", ")}`);
      await takeScreenshot(page, "debugoutput/screenshots/phantom-edits-roundtrip-FAIL");
    }

    expect(modifiedAfter).toEqual([]);
  });
});
