/**
 * ItemAddComponentDialog.spec.ts
 *
 * Regression coverage for the Add Component dialog freeze: selecting the "Item" entry (the
 * minecraft:item document wrapper form, offered as if it were a component)
 * in the item editor's Add Component dialog froze the whole browser tab via
 * an infinite componentDidUpdate/setState loop in ItemTypeAddComponent —
 * the wrapper form declares no top-level `id`, so the "is the form loaded
 * for the selected component?" comparison never converged.
 *
 * These tests pin both halves of the fix, in BOTH visual modes of the item
 * editor (Components tab → isVisualsMode=false, Visuals tab → isVisualsMode=true):
 *  1. `minecraft:item` (humanified: exactly "Item") is absent from the dialog list.
 *  2. Selecting several components in sequence keeps the dialog responsive and
 *     loads each selection's form description. If the update loop regressed —
 *     including via a future forms-data change that ships another id-less,
 *     non-deprecated form — the main thread would stall and the timed
 *     assertions below would fail instead of silently passing.
 *
 * Navigation helpers are mirrored from FocusedModeEditors.spec.ts (the repo's
 * existing pattern — helpers are per-spec, not shared exports).
 */

import { test, expect, Page } from "@playwright/test";
import { enterEditor } from "./WebTestUtilities";

async function openContentWizard(page: Page): Promise<boolean> {
  const existingDialog = page.locator(".MuiDialog-root").first();
  if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }

  const addButton = page.locator('button[aria-label="Add new content"]').first();
  if (!(await addButton.isVisible({ timeout: 15000 }).catch(() => false))) {
    return false;
  }
  await addButton.click();
  await page.waitForTimeout(800);

  const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher, .MuiDialog-root").first();
  return wizardDialog.isVisible({ timeout: 3000 }).catch(() => false);
}

async function clickNewItemQuickAction(page: Page): Promise<boolean> {
  const byTestId = page.locator('[data-testid="wizard-item-from-mc"]').first();
  if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTestId.click();
    await page.waitForTimeout(600);
    return true;
  }

  const byLabel = page.locator('.cwiz-main-option:has-text("New Item Based on Existing")').first();
  if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byLabel.click();
    await page.waitForTimeout(600);
    return true;
  }

  return false;
}

async function dismissNameDialog(page: Page): Promise<void> {
  const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
  if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
    return;
  }

  // Wait for gallery items so the dialog pre-selects a default before Add.
  const galleryItem = dialog.locator(".itbi-outer").first();
  await galleryItem.isVisible({ timeout: 8000 }).catch(() => false);
  await page.waitForTimeout(500);

  const addButton = dialog.locator('button:has-text("Add")').first();
  if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addButton.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(1000);
}

/** Creates a project, adds an item type via the Content Wizard, and lands on the item editor. */
async function openItemEditor(page: Page): Promise<void> {
  const entered = await enterEditor(page);
  expect(entered).toBe(true);
  await page.waitForTimeout(1000);

  expect(await openContentWizard(page)).toBe(true);
  expect(await clickNewItemQuickAction(page)).toBe(true);
  await dismissNameDialog(page);

  // The item editor's tab strip confirms the editor loaded.
  await expect(page.locator('button:has-text("Components")').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Opens the Add Component dialog on the currently visible ItemTypeComponentSetEditor,
 * runs the shared regression assertions, and closes it again.
 */
async function verifyAddComponentDialog(page: Page): Promise<void> {
  const addComponentButton = page.locator('button:has-text("Add component")').first();
  await expect(addComponentButton).toBeVisible({ timeout: 10000 });
  await addComponentButton.click();

  const dialog = page.locator(".icose-addComponentDialog").first();
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // The component list must load with at least one entry.
  const chipNames = dialog.locator(".itac-chipName");
  await expect(chipNames.first()).toBeVisible({ timeout: 15000 });

  // Regression: the minecraft:item document wrapper form (humanified name is
  // exactly "Item") must not be offered as an addable component.
  const names = await chipNames.allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.map((n) => n.trim())).not.toContain("Item");

  // Select several components in sequence. With the pre-fix update loop, the
  // first selection of a form without a top-level id stalled the main thread,
  // so these timed interactions would stop succeeding.
  const options = dialog.locator(".itac-list .MuiListItemButton-root");
  const optionCount = await options.count();
  const selections = Math.min(optionCount, 4);

  for (let i = 0; i < selections; i++) {
    await options.nth(i).click();

    // Selection highlight must land promptly — a frozen main thread fails this.
    await expect(options.nth(i)).toHaveClass(/Mui-selected/, { timeout: 5000 });

    // The page must still execute script (i.e., the tab is not frozen).
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
  }

  // The description pane populates from the selected component's loaded form.
  await expect(dialog.locator(".itac-description .itac-form").first()).toBeVisible({ timeout: 10000 });

  await dialog.locator('button:has-text("Cancel")').first().click();
  await expect(dialog).toBeHidden({ timeout: 5000 });
}

test.describe("Item editor Add Component dialog freeze regression", () => {
  test("excludes minecraft:item and stays responsive in both visual modes", async ({ page }) => {
    test.setTimeout(150000);

    await openItemEditor(page);

    // Components tab → ItemTypeAddComponent with isVisualsMode=false.
    await page.locator('button:has-text("Components")').first().click();
    await page.waitForTimeout(500);
    await verifyAddComponentDialog(page);

    // Visuals tab → ItemTypeAddComponent with isVisualsMode=true. When an icon
    // image is resolvable the tab shows a sub-tab strip; make sure the
    // Components sub-view is the one displayed.
    await page.locator('button:has-text("Visuals")').first().click();
    await page.waitForTimeout(500);

    const visualsSubTab = page.locator('.ite-visualsSubTabs button:has-text("Components")').first();
    if (await visualsSubTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualsSubTab.click();
      await page.waitForTimeout(500);
    }

    await verifyAddComponentDialog(page);
  });
});
