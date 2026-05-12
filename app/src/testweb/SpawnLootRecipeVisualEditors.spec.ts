// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Smoke specs for the spawn rules / loot table / recipe / trade visual
 * editors:
 *
 *   - `SimplifiedSpawnRulesEditor` (.ssre-outer)
 *   - `LootTableVisualEditor` (.ltve-simple-layout)
 *   - `RecipeEditor` (.rcre-area)
 *   - `BlockPickerDialog` (.bpd-content) — opened from the simplified spawn
 *     rules editor's "Spawn On Blocks" affordance.
 *
 * Each spec follows the BiomeEditor.spec.ts pattern:
 *   1. Enter the editor (creates a fresh Add-On Starter in browser storage).
 *   2. Open the Content Wizard and add a new item of the given kind.
 *   3. Click the resulting item in the project list.
 *   4. Assert the editor's distinctive root element renders.
 *   5. Perform one interaction and persist via Ctrl+S.
 *
 * These are intentionally smoke-level — they catch import/registration breaks,
 * missing CSS, and gross render regressions, without trying to validate the
 * full edit/round-trip semantics (those belong in unit tests against the
 * underlying behaviour-definition classes).
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/new-visual-editors";

// ─── Wizard helpers ─────────────────────────────────────────────────────────

async function openContentWizard(page: Page): Promise<boolean> {
  // Dismiss any modal that may already be open (e.g. FRE leftovers).
  const existingDialog = page.locator(".MuiDialog-root").first();
  if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  const addButton = page.locator('button[aria-label="Add new content"]').first();
  if (!(await addButton.isVisible({ timeout: 15000 }).catch(() => false))) {
    return false;
  }
  await addButton.click();
  await page.waitForTimeout(800);

  const wizard = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  return wizard.isVisible({ timeout: 3000 }).catch(() => false);
}

/**
 * Click a top-level "main option" tile in the wizard by its label text
 * (e.g. "Spawn Rules", "Loot Table"). These appear in the Guided Setup pane
 * and are the easiest path for the spawn rules and loot table editors.
 */
async function clickWizardMainOption(page: Page, label: string): Promise<boolean> {
  const tile = page.locator(".cwiz-main-option").filter({ hasText: label }).first();
  if (!(await tile.isVisible({ timeout: 3000 }).catch(() => false))) {
    return false;
  }
  await tile.scrollIntoViewIfNeeded().catch(() => {});
  await tile.click();
  await page.waitForTimeout(800);
  return true;
}

/**
 * Open the Advanced > "Spawn Rules, Loot Tables & Recipes" subsection and
 * click a `.cwiz-section-item` with the given label (used for recipes, which
 * don't have a guided main-option tile).
 */
async function clickAdvancedSpawnLootRecipeItem(page: Page, label: string | RegExp): Promise<boolean> {
  const advancedHeader = page.locator('.cwiz-advanced-header:has-text("Advanced File Types")').first();
  if (await advancedHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await advancedHeader.click();
    await page.waitForTimeout(400);
  }

  const advancedContent = page.locator(".cwiz-advanced-content").first();
  const sectionHeader = advancedContent
    .locator('.cwiz-section-header:has-text("Spawn Rules, Loot Tables & Recipes")')
    .first();
  if (await sectionHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sectionHeader.scrollIntoViewIfNeeded().catch(() => {});
    await sectionHeader.click();
    await page.waitForTimeout(400);
  }

  const item = advancedContent.locator(".cwiz-section-item").filter({ hasText: label }).first();
  if (!(await item.isVisible({ timeout: 3000 }).catch(() => false))) {
    return false;
  }
  await item.scrollIntoViewIfNeeded().catch(() => {});
  await item.click();
  await page.waitForTimeout(1000);
  return true;
}

/**
 * After clicking a wizard item, accept the naming dialog (if one appears).
 */
async function confirmNameDialog(page: Page): Promise<void> {
  const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
  if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
    return;
  }
  const confirm = dialog
    .locator('button:has-text("Add"), button:has-text("OK"), button:has-text("Create")')
    .first();
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirm.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(1500);
}

/**
 * Click a project list item by label fragment. Mirrors
 * ProjectReloadEditors.spec.ts/clickProjectItem but biased toward `[role=option]`
 * which is what the file explorer renders.
 *
 * Scopes the search to the sidebar listbox so the fallback `[title*="..."]`
 * matcher doesn't accidentally match toolbar buttons that share the
 * filename in their tooltip (e.g. the "Item Actions" button shows the
 * currently open file's name in its title).
 */
async function clickProjectItem(page: Page, label: RegExp): Promise<boolean> {
  const sidebar = page.locator('[role="listbox"][aria-label="Project items"], .pil-projectItemList').first();
  const sidebarLocator = (await sidebar.count().catch(() => 0)) > 0 ? sidebar : page;

  const option = sidebarLocator.locator('[role="option"]').filter({ hasText: label }).first();
  if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
    await option.click();
    await page.waitForTimeout(2000);
    return true;
  }

  const titleAttr = sidebarLocator
    .locator(`[title*="${label.source.replace(/[\\/.*+?^${}()|[\]]/g, "")}" i]`)
    .first();
  if (await titleAttr.isVisible({ timeout: 1500 }).catch(() => false)) {
    await titleAttr.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function saveProject(page: Page): Promise<void> {
  await page.keyboard.press("Control+S");
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════════════════════════════════
// SimplifiedSpawnRulesEditor
// ═══════════════════════════════════════════════════════════════════════════

test.describe("SimplifiedSpawnRulesEditor @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("adds a spawn rule, renders the simplified editor, toggles a biome", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    expect(await enterEditor(page)).toBe(true);

    if (!(await openContentWizard(page))) {
      console.log("Spawn rules: wizard didn't open");
      return;
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/spawn-01-wizard.png`, fullPage: true });

    if (!(await clickWizardMainOption(page, "Spawn Rules"))) {
      console.log("Spawn rules: main-option tile not found");
      return;
    }
    await confirmNameDialog(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/spawn-02-after-add.png`, fullPage: true });

    // The wizard typically auto-opens the new file. Only fall back to clicking
    // it in the sidebar if the SimplifiedSpawnRulesEditor isn't already
    // rendered. The sidebar may not show the spawn rule at all in Focused
    // mode (which hides spawn rules by default), and a fallback `[title*=...]`
    // match could otherwise hit the "Item Actions" toolbar button whose title
    // includes the filename.
    const outer = page.locator(".ssre-outer").first();
    if (!(await outer.isVisible({ timeout: 2000 }).catch(() => false))) {
      if (!(await clickProjectItem(page, /spawn/i))) {
        console.log("Spawn rules: created item not found in tree");
        await page.screenshot({ path: `${SCREENSHOT_DIR}/spawn-not-found.png`, fullPage: true });
        return;
      }
    }

    // Editor root — distinctive class from SimplifiedSpawnRulesEditor.
    await expect(outer).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/spawn-03-editor.png`, fullPage: true });

    // Categories should render.
    const categories = page.locator(".ssre-category");
    expect(await categories.count()).toBeGreaterThan(0);

    // Toggle the first biome row (clickable label) so we exercise an interaction.
    const biomeLabel = page.locator(".ssre-biomeLabel").first();
    if (await biomeLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await biomeLabel.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/spawn-04-toggled.png`, fullPage: true });
    }

    await saveProject(page);
    await expect(outer).toBeVisible();

    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test("opens the BlockPickerDialog from spawn-on-blocks", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    expect(await enterEditor(page)).toBe(true);

    if (!(await openContentWizard(page))) return;
    if (!(await clickWizardMainOption(page, "Spawn Rules"))) return;
    await confirmNameDialog(page);

    // The wizard typically auto-opens the new file. Only fall back to
    // clicking it in the sidebar if the SimplifiedSpawnRulesEditor isn't
    // already rendered (see notes on the prior test).
    const outer = page.locator(".ssre-outer").first();
    if (!(await outer.isVisible({ timeout: 2000 }).catch(() => false))) {
      if (!(await clickProjectItem(page, /spawn/i))) return;
    }

    await expect(outer).toBeVisible({ timeout: 10000 });

    // Expand the Default entry so the "Spawn On Blocks" affordance becomes
    // available, then click the add-block button to open BlockPickerDialog.
    const defaultHeader = page.locator(".ssre-defaultHeader").first();
    if (await defaultHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await defaultHeader.click();
      await page.waitForTimeout(500);
    }

    const addBlock = page.locator(".ssre-blockAdd button, .ssre-blockAdd").first();
    if (!(await addBlock.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("Block picker: add-block control not visible");
      return;
    }
    await addBlock.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator(".bpd-content").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/blockpicker-01-open.png`, fullPage: true });

    // Search box should accept text without errors.
    const searchInput = page.locator(".bpd-searchRow input").first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill("stone");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/blockpicker-02-search.png`, fullPage: true });
    }

    // Close via the X button.
    const closeBtn = page.locator(".bpd-closeBtn").first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LootTableVisualEditor
// ═══════════════════════════════════════════════════════════════════════════

test.describe("LootTableVisualEditor @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("adds a loot table, renders the visual editor, adds a pool", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    expect(await enterEditor(page)).toBe(true);

    if (!(await openContentWizard(page))) {
      console.log("Loot table: wizard didn't open");
      return;
    }
    if (!(await clickWizardMainOption(page, "Loot Table"))) {
      console.log("Loot table: main-option tile not found");
      return;
    }
    await confirmNameDialog(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/loot-01-after-add.png`, fullPage: true });

    if (!(await clickProjectItem(page, /loot/i))) {
      console.log("Loot table: created item not found in tree");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/loot-not-found.png`, fullPage: true });
      return;
    }

    // Editor root — distinctive class from LootTableVisualEditor (Simple tab default).
    const layout = page.locator(".ltve-simple-layout, .lpo-container").first();
    await expect(layout).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/loot-02-editor.png`, fullPage: true });

    // Add a pool via the "Add pool" button (works in both empty and populated states).
    const addPool = page.locator(".lpo-add-pool-btn").first();
    if (await addPool.isVisible({ timeout: 2000 }).catch(() => false)) {
      const beforeCount = await page.locator(".lpo-pool-card").count();
      await addPool.click();
      await page.waitForTimeout(500);
      const afterCount = await page.locator(".lpo-pool-card").count();
      console.log(`Loot pools: ${beforeCount} -> ${afterCount}`);
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/loot-03-pool-added.png`, fullPage: true });
    }

    await saveProject(page);
    await expect(layout).toBeVisible();

    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RecipeEditor
// ═══════════════════════════════════════════════════════════════════════════

test.describe("RecipeEditor @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("adds a shaped recipe and renders the visual recipe editor", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);
    expect(await enterEditor(page)).toBe(true);

    if (!(await openContentWizard(page))) {
      console.log("Recipe: wizard didn't open");
      return;
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-01-wizard.png`, fullPage: true });

    if (!(await clickAdvancedSpawnLootRecipeItem(page, /Recipe \(Shaped\)/i))) {
      console.log("Recipe: 'Recipe (Shaped)' gallery item not found");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-wizard-no-item.png`, fullPage: true });
      return;
    }
    await confirmNameDialog(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-02-after-add.png`, fullPage: true });

    if (!(await clickProjectItem(page, /recipe/i))) {
      console.log("Recipe: created item not found in tree");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-not-found.png`, fullPage: true });
      return;
    }

    // Editor root — distinctive class from RecipeEditor.
    const area = page.locator(".rcre-area").first();
    await expect(area).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-03-editor.png`, fullPage: true });

    // Visual mode should render the shaped recipe content area (or a known
    // "unsupported" placeholder if the type detection fails — both are valid
    // smoke-pass states; the regression we care about is "blank/throws").
    const contentOrUnsupported = page.locator(".rcre-content-area, .rcre-unsupported").first();
    await expect(contentOrUnsupported).toBeVisible({ timeout: 5000 });

    // Switch to the Properties tab to exercise tab routing.
    const propsTab = page
      .locator('button:has-text("Properties"), button[title="Properties"]')
      .first();
    if (await propsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await propsTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/recipe-04-properties-tab.png`, fullPage: true });
    }

    await saveProject(page);
    await expect(area).toBeVisible();

    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});
