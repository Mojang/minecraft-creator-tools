/**
 * Color-contrast coverage for the Spawn Rules and Loot Table editor bodies
 * (WCAG 1.4.3) across both themes.
 *
 * These editors (SimplifiedSpawnRulesEditor biome selector, LootTableVisualEditor
 * and its child loot widgets) historically hardcoded dark-theme text colors —
 * #ffffff / rgba(255,255,255,…) — and shipped no `body.ct-light` overrides. In
 * Light Mode the biome names and loot labels painted near-white on a light
 * surface (~1.4:1), making them unreadable. The fix adds light-mode color
 * overrides; this test pins the readable contrast so it can't silently regress.
 *
 * Run (from app/):
 *   npx playwright test SpawnLootEditorContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast, takeScreenshot, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

/** Open the Content Wizard via the Add button. */
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

  const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  if (await wizardDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    return true;
  }
  return page.locator(".MuiDialog-root").first().isVisible({ timeout: 2000 });
}

/** Click the "New Mob Based on Existing" quick action. */
async function clickNewMobFromExisting(page: Page): Promise<boolean> {
  const byTestId = page.locator('[data-testid="wizard-mob-from-mc"]').first();
  if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTestId.click();
    await page.waitForTimeout(600);
    return true;
  }
  const byLabel = page.locator('.cwiz-main-option:has-text("New Mob Based on Existing")').first();
  if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byLabel.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

/** Confirm the "new mob" name dialog by clicking Add once the gallery has loaded. */
async function dismissNameDialog(page: Page): Promise<boolean> {
  // The "based on existing" gallery is populated from vanilla mob data, which is slow
  // to load on the Vite dev server. Wait for a gallery item at the page level first —
  // the wizard launcher is ALSO a MuiDialog, so scoping `.first()` can match the wrong
  // dialog and miss the gallery/Add entirely.
  const galleryItem = page.locator(".MuiDialog-root .itbi-outer").first();
  if (!(await galleryItem.isVisible({ timeout: 25000 }).catch(() => false))) {
    return true;
  }
  // Let the dialog pre-select the first gallery entry and fire its update callback.
  await page.waitForTimeout(800);

  const dialog = page.locator(".MuiDialog-root").filter({ has: page.locator(".itbi-outer") }).first();
  const addButton = dialog.locator('button:has-text("Add")').first();
  if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addButton.click();
    // Creating a mob from a vanilla template copies its geometry/textures and saves
    // the project before the dialog closes and the new item's editor opens. That work
    // is slow on the dev server, so wait for the dialog to actually disappear rather
    // than racing it with a fixed delay.
    await dialog.waitFor({ state: "hidden", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1000);
    return true;
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  return true;
}

/** Click an editor tab by visible label. */
async function clickEditorTab(page: Page, tabName: string): Promise<boolean> {
  // The entity editor (with its 3D mob preview) is slow to mount on the dev server,
  // so the Spawn/Loot tabs can take a while to appear after the mob is created.
  const tab = page.locator(`button:has-text("${tabName}")`).first();
  if (await tab.isVisible({ timeout: 15000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

/** A freshly-based mob starts with an empty Spawn/Loot tab; click the "Add …"
 *  button so the real editor (biome selector / loot pools) actually renders. */
async function dismissEmptyState(page: Page, buttonLabel: string): Promise<void> {
  const addButton = page.locator(`button:has-text("${buttonLabel}")`).first();
  if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addButton.click();
    await page.waitForTimeout(1500);
  }
}

/** Every rendered instance of `selector` that fails WCAG AA. */
async function collectLowContrast(page: Page, selector: string): Promise<{ selector: string; ratio: number }[]> {
  const ratios = await getRenderedContrast(page, selector);
  return ratios.filter((r) => r < MIN_CONTRAST).map((ratio) => ({ selector, ratio }));
}

for (const theme of ["light", "dark"] as const) {
  test(`Spawn Rules and Loot editor text meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    // Arrange: land in the editor in the target theme.
    const entered = await enterEditor(page, { theme: theme as ThemeMode, editMode: "focused" });
    expect(entered, "should reach the editor").toBe(true);

    const isLight = await page.evaluate(() => document.body.classList.contains("ct-light"));
    expect(isLight, `body.ct-light should match ${theme} mode`).toBe(theme === "light");

    // Create a mob (so it has Spawn + Loot tabs) via the Content Wizard.
    expect(await openContentWizard(page), "Content Wizard should open").toBe(true);
    expect(await clickNewMobFromExisting(page), "should start New Mob Based on Existing").toBe(true);
    await dismissNameDialog(page);
    await page.waitForTimeout(3000);

    const failures: { selector: string; ratio: number }[] = [];

    // --- Spawn tab: SimplifiedSpawnRulesEditor biome selector ------------------
    expect(await clickEditorTab(page, "Spawn"), "Spawn tab should be clickable").toBe(true);
    await dismissEmptyState(page, "Add Spawn Rules");
    await page.locator(".ssre-categoryName").first().waitFor({ state: "visible", timeout: 10000 });
    await takeScreenshot(page, `debugoutput/screenshots/spawn-loot-contrast-spawn-${theme}`);

    for (const sel of [".ssre-categoryName", ".ssre-biomeHeader"]) {
      failures.push(...(await collectLowContrast(page, sel)));
    }

    // --- Loot tab: LootTableVisualEditor --------------------------------------
    expect(await clickEditorTab(page, "Loot"), "Loot tab should be clickable").toBe(true);
    await dismissEmptyState(page, "Add Loot Table");
    await page.locator(".ltve-tab").first().waitFor({ state: "visible", timeout: 10000 });
    await takeScreenshot(page, `debugoutput/screenshots/spawn-loot-contrast-loot-${theme}`);

    for (const sel of [".ltve-tab", ".dre-header", ".dre-explanation", ".lpve-entries-title"]) {
      failures.push(...(await collectLowContrast(page, sel)));
    }

    expect(failures, `${theme} mode text below ${MIN_CONTRAST}:1 contrast: ${JSON.stringify(failures)}`).toHaveLength(
      0
    );
  });
}
