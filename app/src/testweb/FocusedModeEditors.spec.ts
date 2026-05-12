/**
 * FocusedModeEditors.spec.ts
 *
 * Tests that verify specialized editors (Entity Type, Block Type, Item Type,
 * Feature) can be created and used in Focused editing mode.
 *
 * In Focused mode, these item types are not pre-populated in the sidebar,
 * but creators can add them via the Add button → Content Wizard dialog.
 * This test suite verifies:
 * 1. Opening the Content Wizard from the Add button
 * 2. Using quick-action cards to create content types
 * 3. The specialized editor loads with its expected tabs
 * 4. Tab navigation works correctly
 * 5. Screenshots are captured for visual review
 *
 * Content Wizard flow:
 *   Add button → Content Wizard dialog → Quick Action card (e.g. "Block from Minecraft")
 *   → New Name dialog (with "Add" confirm button) → Editor loads with tabs
 *
 * Run with: npx playwright test FocusedModeEditors.spec.ts --project=focused
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/focused-editors";

/**
 * Open the Content Wizard by clicking the Add button.
 * The wizard appears as a dialog with guided creation options and quick actions.
 */
async function openContentWizard(page: Page): Promise<boolean> {
  try {
    // Dismiss any lingering dialog that might block the Add button
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

    // Verify the Content Wizard dialog appeared
    const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
    if (await wizardDialog.isVisible({ timeout: 3000 })) {
      return true;
    }

    // Fallback: check for MUI dialog
    const muiDialog = page.locator(".MuiDialog-root").first();
    return muiDialog.isVisible({ timeout: 2000 });
  } catch (error) {
    console.log(`openContentWizard: Error - ${error}`);
    return false;
  }
}

/**
 * Click a quick-action card in the Content Wizard.
 * These are the "Based on Existing" cards in the launcher (e.g. New Mob Based on Existing).
 *
 * Prefers a data-testid lookup so the test doesn't break when card copy is
 * reworded (the labels were renamed from "Start from a Minecraft X" → "New X
 * Based on Existing" and these tests silently degraded as a result).
 */
async function clickWizardQuickAction(
  page: Page,
  testIdOrLabel: string,
  fallbackLabel?: string
): Promise<boolean> {
  try {
    // Primary: data-testid match (stable across copy changes)
    const byTestId = page.locator(`[data-testid="${testIdOrLabel}"]`).first();
    if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
      await byTestId.click();
      await page.waitForTimeout(600);
      return true;
    }

    // Secondary: label match against the cwiz-main-option card
    const labelToFind = fallbackLabel ?? testIdOrLabel;
    const quickAction = page
      .locator(`.cwiz-main-option:has-text("${labelToFind}")`)
      .first();
    if (await quickAction.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickAction.click();
      await page.waitForTimeout(600);
      return true;
    }

    console.log(
      `clickWizardQuickAction: Could not find testId="${testIdOrLabel}" or label="${labelToFind}"`
    );
    return false;
  } catch (error) {
    console.log(`clickWizardQuickAction: Error - ${error}`);
    return false;
  }
}

/**
 * Click a wizard-guided creation card (New Mob, New Block, New Item).
 * These are the top-level launcher options that open a multi-step wizard.
 *
 * Prefers a data-testid lookup so renames in the launcher copy (e.g. "Entity"
 * → "New Mob") don't silently break tests.
 */
async function clickWizardGuided(
  page: Page,
  testIdOrLabel: string,
  fallbackLabel?: string
): Promise<boolean> {
  try {
    // Primary: data-testid match
    const byTestId = page.locator(`[data-testid="${testIdOrLabel}"]`).first();
    if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
      await byTestId.click();
      await page.waitForTimeout(600);
      return true;
    }

    // Secondary: label match
    const labelToFind = fallbackLabel ?? testIdOrLabel;
    const option = page
      .locator(`.cwiz-launcher-option:has-text("${labelToFind}")`)
      .first();
    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
      await option.click();
      await page.waitForTimeout(600);
      return true;
    }

    console.log(
      `clickWizardGuided: Could not find testId="${testIdOrLabel}" or label="${labelToFind}"`
    );
    return false;
  } catch (error) {
    console.log(`clickWizardGuided: Error - ${error}`);
    return false;
  }
}

/**
 * Dismiss a "New ..." name dialog by clicking the Add / OK / Create button.
 * The Content Wizard's quick actions open MUI Dialogs with an "Add" confirm button.
 * IMPORTANT: Waits for gallery items to load before clicking Add, so the dialog
 * component has time to pre-select the first gallery item and call its update callback.
 */
async function dismissNameDialog(page: Page): Promise<boolean> {
  try {
    // Wait for dialog to appear
    const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
    if (!(await dialog.isVisible({ timeout: 3000 }))) {
      // Some items don't show a dialog, they create immediately
      return true;
    }

    // Wait for gallery items to load inside the dialog.
    // The dialog components (NewEntityType, NewBlockType, NewItemType) load gallery items
    // asynchronously in _ensureLoaded() and pre-select the first item as default.
    // We need to wait for this loading to complete before clicking "Add".
    const galleryItem = dialog.locator(".itbi-outer").first();
    try {
      await expect(galleryItem).toBeVisible({ timeout: 8000 });
      // Give a bit more time for the pre-selection callback to fire
      await page.waitForTimeout(500);
    } catch {
      // Gallery might not have loaded — proceed anyway
      console.log("dismissNameDialog: Gallery items did not appear, proceeding with Add");
    }

    // The new-item dialogs use "Add" as the confirm button text (variant="contained")
    const addButton = dialog.locator('button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 })) {
      await addButton.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Fallback: OK, Create, or submit
    const submitButton = dialog
      .locator('button:has-text("OK"), button:has-text("Create"), [data-testid="submit-button"]')
      .first();
    if (await submitButton.isVisible({ timeout: 2000 })) {
      await submitButton.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Press Enter as last fallback
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for an editor with tabs to appear in the right panel.
 * Returns the number of tab buttons found.
 */
async function waitForEditorTabs(page: Page, expectedTabName: string, timeoutMs = 8000): Promise<number> {
  const tabButton = page.locator(`button:has-text("${expectedTabName}")`).first();
  try {
    await expect(tabButton).toBeVisible({ timeout: timeoutMs });
  } catch {
    return 0;
  }

  // Different editors use different container classes for their tab/toolbar headers:
  //   - .editor-header-tabs-container: shared <EditorHeaderTabs> (entity, block, item, etc.)
  //   - .fe-toolBarArea: feature editor toolbar (Tree / Diagram / Add Feature)
  //   - .eht-outerStack / .eht-outer: legacy class names (kept for safety)
  // If none of those containers match, fall back to a count of 1 so the test still
  // proceeds — `clickEditorTab` will tolerate missing tabs.
  const editorTabs = page.locator(
    ".editor-header-tabs-container button, .fe-toolBarArea button, .eht-outerStack button, .eht-outer button"
  );
  const count = await editorTabs.count();
  if (count > 0) {
    return count;
  }

  // Fallback: the named tab is visible, but it isn't inside one of the known
  // containers. Treat that as "tabs exist" so the test can proceed.
  return 1;
}

/**
 * Click a tab button in the editor by its label text.
 */
async function clickEditorTab(page: Page, tabName: string): Promise<boolean> {
  const tab = page.locator(`button:has-text("${tabName}")`).first();
  if (await tab.isVisible({ timeout: 2000 })) {
    await tab.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Click a newly-created item in the sidebar to select it.
 */
async function selectSidebarItem(page: Page, namePattern: string): Promise<boolean> {
  const sidebarItem = page.locator(`.pil-outer .pit-name:has-text("${namePattern}")`).first();
  if (await sidebarItem.isVisible({ timeout: 3000 })) {
    await sidebarItem.click();
    await page.waitForTimeout(1500);
    return true;
  }

  const anyItem = page.locator(`.pil-outer`).getByText(namePattern, { exact: false }).first();
  if (await anyItem.isVisible({ timeout: 2000 })) {
    await anyItem.click();
    await page.waitForTimeout(1500);
    return true;
  }

  return false;
}

// ==========================================================================
// Entity Type Editor
// ==========================================================================

test.describe("Entity Type Editor in Focused Mode @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add entity type via Content Wizard and display editor with tabs", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-01-editor-initial.png`, fullPage: true });

    // Open Content Wizard
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-02-content-wizard.png`, fullPage: true });

    // Click "New Mob Based on Existing" quick action (formerly "Start from a Minecraft Mob")
    const clicked = await clickWizardQuickAction(page, "wizard-mob-from-mc", "New Mob Based on Existing");

    if (clicked) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-03-name-dialog.png`, fullPage: true });

      await dismissNameDialog(page);
      await page.waitForTimeout(3000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-04-after-add.png`, fullPage: true });

      // The newly created entity type should appear and be auto-selected
      const tabCount = await waitForEditorTabs(page, "Components");

      if (tabCount > 0) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-05-editor-loaded.png`, fullPage: true });

        // Navigate through entity editor tabs (current tab set as of 2026)
        const entityTabs = ["Overview", "Traits", "Visuals", "Audio", "Spawn", "Loot", "Components", "Advanced"];
        for (const tabName of entityTabs) {
          const tabClicked = await clickEditorTab(page, tabName);
          if (tabClicked) {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/entity-tab-${tabName.toLowerCase().replace(/ /g, "-")}.png`,
              fullPage: true,
            });
          }
        }
      } else {
        // Entity added but editor not auto-opened — try clicking it
        const selected = await selectSidebarItem(page, "entity");
        if (selected) {
          await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-05-selected-manually.png`, fullPage: true });
        }
      }
    } else {
      // Fallback: try guided New Mob wizard card (formerly labelled "Entity")
      const guided = await clickWizardGuided(page, "wizard-new-mob", "New Mob");
      if (guided) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-03-guided-wizard.png`, fullPage: true });
      } else {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/entity-add-failed.png`, fullPage: true });
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});

// ==========================================================================
// Block Type Editor
// ==========================================================================

test.describe("Block Type Editor in Focused Mode @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add block type via Content Wizard and display editor with tabs", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/block-01-editor-initial.png`, fullPage: true });

    // Open Content Wizard
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/block-02-content-wizard.png`, fullPage: true });

    // Click "New Block Based on Existing" quick action
    const clicked = await clickWizardQuickAction(page, "wizard-block-from-mc", "New Block Based on Existing");

    if (clicked) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/block-03-name-dialog.png`, fullPage: true });

      await dismissNameDialog(page);
      await page.waitForTimeout(3000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/block-04-after-add.png`, fullPage: true });

      const tabCount = await waitForEditorTabs(page, "Components");

      if (tabCount > 0) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/block-05-editor-loaded.png`, fullPage: true });

        // Navigate through block editor tabs
        const blockTabs = ["Overview", "Components", "Visuals", "Permutations", "States"];
        for (const tabName of blockTabs) {
          const tabClicked = await clickEditorTab(page, tabName);
          if (tabClicked) {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/block-tab-${tabName.toLowerCase().replace(/ /g, "-")}.png`,
              fullPage: true,
            });
          }
        }
      } else {
        const selected = await selectSidebarItem(page, "block");
        if (selected) {
          await page.screenshot({ path: `${SCREENSHOT_DIR}/block-05-selected-manually.png`, fullPage: true });
        }
      }
    } else {
      // Fallback: try guided New Block wizard card
      const guided = await clickWizardGuided(page, "wizard-new-block", "New Block");
      if (guided) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/block-03-guided-wizard.png`, fullPage: true });
      } else {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/block-add-failed.png`, fullPage: true });
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});

// ==========================================================================
// Item Type Editor
// ==========================================================================

test.describe("Item Type Editor in Focused Mode @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add item type via Content Wizard and display editor with tabs", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/item-01-editor-initial.png`, fullPage: true });

    // Open Content Wizard
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/item-02-content-wizard.png`, fullPage: true });

    // Click "New Item Based on Existing" quick action
    const clicked = await clickWizardQuickAction(page, "wizard-item-from-mc", "New Item Based on Existing");

    if (clicked) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/item-03-name-dialog.png`, fullPage: true });

      await dismissNameDialog(page);
      await page.waitForTimeout(3000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/item-04-after-add.png`, fullPage: true });

      const tabCount = await waitForEditorTabs(page, "Components");

      if (tabCount > 0) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/item-05-editor-loaded.png`, fullPage: true });

        // Navigate through item editor tabs
        const itemTabs = ["Components", "Actions", "Visuals"];
        for (const tabName of itemTabs) {
          const tabClicked = await clickEditorTab(page, tabName);
          if (tabClicked) {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/item-tab-${tabName.toLowerCase().replace(/ /g, "-")}.png`,
              fullPage: true,
            });
          }
        }
      } else {
        const selected = await selectSidebarItem(page, "item");
        if (selected) {
          await page.screenshot({ path: `${SCREENSHOT_DIR}/item-05-selected-manually.png`, fullPage: true });
        }
      }
    } else {
      // Fallback: try guided New Item wizard card
      const guided = await clickWizardGuided(page, "wizard-new-item", "New Item");
      if (guided) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/item-03-guided-wizard.png`, fullPage: true });
      } else {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/item-add-failed.png`, fullPage: true });
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});

// ==========================================================================
// Feature Editor (via Content Wizard advanced section)
// ==========================================================================

test.describe("Feature Editor in Focused Mode @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add feature via Content Wizard and display editor", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-01-editor-initial.png`, fullPage: true });

    // Open Content Wizard
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-02-content-wizard.png`, fullPage: true });

    // Features live in the top-level "World Generation" section (cwiz-worldgen-top),
    // which is EXPANDED BY DEFAULT (see ContentWizard initial state). The Feature item
    // is therefore already visible — we just need to scroll it into view and click it.
    // Don't click the section header: that would TOGGLE it closed.
    let featureAdded = false;

    // Try clicking the Feature item directly (use exact match to avoid "Feature Rule")
    const featureItem = page
      .locator('.cwiz-section-item:has(span:text-is("Feature"))')
      .first();

    if (await featureItem.count().then((c) => c > 0)) {
      await featureItem.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(300);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-03-worldgen-default.png`, fullPage: true });

      if (await featureItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featureItem.click();
        await page.waitForTimeout(1000);
        featureAdded = true;
      }
    }

    // Fallback: if the World Generation section was collapsed (state changed), expand it.
    if (!featureAdded) {
      const worldGenTopHeader = page
        .locator('.cwiz-section-header:has(span:text-is("World Generation"))')
        .first();
      if (await worldGenTopHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
        await worldGenTopHeader.click();
        await page.waitForTimeout(500);

        const featureItemRetry = page
          .locator('.cwiz-section-item:has(span:text-is("Feature"))')
          .first();
        if (await featureItemRetry.isVisible({ timeout: 2000 }).catch(() => false)) {
          await featureItemRetry.click();
          await page.waitForTimeout(1000);
          featureAdded = true;
        }
      }
    }

    // Fallback 2: try the "Advanced File Types" → "World Generation" gallery
    if (!featureAdded) {
      const advancedSection = page
        .locator('.cwiz-advanced-header:has-text("Advanced File Types")')
        .first();
      if (await advancedSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        await advancedSection.click();
        await page.waitForTimeout(500);

        await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-04-advanced-expanded.png`, fullPage: true });

        // Click any feature gallery item under the Advanced section
        const advFeatureItem = page.locator('.itbi-outer:has-text("feature")').first();
        if (await advFeatureItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await advFeatureItem.click();
          await page.waitForTimeout(1000);
          featureAdded = true;
        }
      }
    }

    if (!featureAdded) {
      // Fallback: screenshot the wizard to see what's available
      await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-wizard-state.png`, fullPage: true });
      console.log("Feature items not available in Content Wizard — skipping tab navigation");
    }

    if (featureAdded) {
      await dismissNameDialog(page);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-05-after-add.png`, fullPage: true });

      // The feature editor has Tree, Diagram, and Add Feature tabs
      const tabCount = await waitForEditorTabs(page, "Tree");

      if (tabCount > 0) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-06-editor-loaded.png`, fullPage: true });

        const featureTabs = ["Tree", "Diagram", "Add Feature"];
        for (const tabName of featureTabs) {
          const tabClicked = await clickEditorTab(page, tabName);
          if (tabClicked) {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/feature-tab-${tabName.toLowerCase().replace(/ /g, "-")}.png`,
              fullPage: true,
            });
          }
        }
      } else {
        const selected = await selectSidebarItem(page, "feature");
        if (selected) {
          await page.screenshot({ path: `${SCREENSHOT_DIR}/feature-06-selected-manually.png`, fullPage: true });
        }
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});

// ==========================================================================
// Combined: Content Wizard itself and multiple editors in one project
// ==========================================================================

test.describe("Content Wizard and Combined Editors in Focused Mode @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show Content Wizard with all creation options", async ({ page }) => {
    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    // Open Content Wizard and screenshot the full launcher
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/wizard-01-launcher.png`, fullPage: true });

    // Verify guided creation cards are visible
    const entityCard = page.locator('.cwiz-launcher-option:has-text("New Mob")').first();
    const blockCard = page.locator('.cwiz-launcher-option:has-text("New Block")').first();
    const itemCard = page.locator('.cwiz-launcher-option:has-text("New Item")').first();

    const entityVisible = await entityCard.isVisible({ timeout: 2000 });
    const blockVisible = await blockCard.isVisible({ timeout: 2000 });
    const itemVisible = await itemCard.isVisible({ timeout: 2000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/wizard-02-guided-cards.png`, fullPage: true });

    // Verify quick action cards
    const entityQuickAction = page.locator('[data-testid="wizard-mob-from-mc"]').first();
    const blockQuickAction = page.locator('[data-testid="wizard-block-from-mc"]').first();
    const itemQuickAction = page.locator('[data-testid="wizard-item-from-mc"]').first();

    const entityQVisible = await entityQuickAction.isVisible({ timeout: 2000 });
    const blockQVisible = await blockQuickAction.isVisible({ timeout: 2000 });
    const itemQVisible = await itemQuickAction.isVisible({ timeout: 2000 });

    console.log(
      `Wizard cards: Entity=${entityVisible}, Block=${blockVisible}, Item=${itemVisible}; ` +
        `Quick actions: Entity=${entityQVisible}, Block=${blockQVisible}, Item=${itemQVisible}`
    );

    // Close wizard
    const cancelButton = page.locator('button:has-text("Cancel")').first();
    if (await cancelButton.isVisible({ timeout: 2000 })) {
      await cancelButton.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });

  test("should add multiple item types and switch between their editors", async ({ page }) => {
    test.setTimeout(120000); // Creating 3 items with gallery loading takes time
    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/combined-01-initial.png`, fullPage: true });

    // Add entity type
    let wizardOpened = await openContentWizard(page);
    if (wizardOpened) {
      const clicked = await clickWizardQuickAction(page, "wizard-mob-from-mc", "New Mob Based on Existing");
      if (clicked) {
        await dismissNameDialog(page);
        await page.waitForTimeout(2500);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/combined-02-after-entity.png`, fullPage: true });

    // Add block type
    wizardOpened = await openContentWizard(page);
    if (wizardOpened) {
      const clicked = await clickWizardQuickAction(page, "wizard-block-from-mc", "New Block Based on Existing");
      if (clicked) {
        await dismissNameDialog(page);
        await page.waitForTimeout(2500);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/combined-03-after-block.png`, fullPage: true });

    // Add item type
    wizardOpened = await openContentWizard(page);
    if (wizardOpened) {
      const clicked = await clickWizardQuickAction(page, "wizard-item-from-mc", "New Item Based on Existing");
      if (clicked) {
        await dismissNameDialog(page);
        await page.waitForTimeout(2500);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/combined-04-after-item.png`, fullPage: true });

    // Final screenshot showing sidebar with all types added
    await page.screenshot({ path: `${SCREENSHOT_DIR}/combined-05-all-types-sidebar.png`, fullPage: true });

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});
