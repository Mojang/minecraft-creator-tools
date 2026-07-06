/**
 * Color-contrast coverage for the editor header "chip" text (WCAG 1.4.3).
 *
 * The shared EditorHeaderChip (entity/block/item editors) renders white text on a
 * type-tinted "stone" background. Two ways it failed: (1) a too-light stone dropped
 * the title to ~2.68:1, and (2) dimmed text via `opacity` (subtitle, version badge)
 * dropped well below 4.5:1. The chip text is white by design, so the stone must be
 * dark enough — and de-emphasis must not rely on opacity — in BOTH themes.
 *
 * Run: npx playwright test EditorHeaderContrast.spec.ts --project=chromium
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import {
  gotoWithTheme,
  clickTemplateCreateButton,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
  waitForEditorReady,
  selectEditMode,
  processMessage,
  getRenderedContrast,
  ThemeMode,
} from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

/** Reveal the "Entity Types" group in the project tree (behind the Show menu). */
async function enableEntityTypeVisibility(page: Page): Promise<void> {
  const entityTypesSection = page.locator("text=/Entity Types/i").first();
  if (await entityTypesSection.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }
  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();
    const menuModal = page.locator(".MuiModal-root.MuiMenu-root");
    await menuModal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    const menuList = page.locator(".MuiMenu-list");

    let typesOption = menuList.locator('li[title*="entity, block, and item types"]');
    if (!(await typesOption.isVisible({ timeout: 1000 }).catch(() => false))) {
      typesOption = menuList.getByRole("menuitem", { name: "Types", exact: true });
    }
    if (!(await typesOption.isVisible({ timeout: 1000 }).catch(() => false))) {
      typesOption = menuList.locator('li:has-text("Types")').first();
    }

    if (await typesOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      const alreadySelected = (await typesOption.locator(".label-selected").count()) > 0;
      if (alreadySelected) {
        await page.keyboard.press("Escape");
      } else {
        await typesOption.click();
      }
    } else {
      await page.keyboard.press("Escape");
    }
    await menuModal.waitFor({ state: "detached", timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
    await page.waitForTimeout(300);
  }
}

/** Select an entity type in the tree so its editor (with the chip header) opens. */
async function selectEntityType(page: Page, entityName: string): Promise<boolean> {
  await enableEntityTypeVisibility(page);
  await page.waitForTimeout(2000);
  const eteArea = page.locator(".ete-area");

  const tryClick = async (loc: ReturnType<typeof page.locator>): Promise<boolean> => {
    await loc.click();
    await page.waitForTimeout(1000);
    return await eteArea.isVisible({ timeout: 5000 }).catch(() => false);
  };

  const exact = page.locator(`text="${entityName}"`).first();
  if (await exact.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await tryClick(exact)) return true;
  }
  const options = page.locator(`[role="option"]:has-text("${entityName}")`);
  const count = await options.count();
  for (let i = 0; i < Math.min(count, 4); i++) {
    if (
      await options
        .nth(i)
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      if (await tryClick(options.nth(i))) return true;
    }
  }
  return false;
}

/** Create a Full Add-On (has entities) in the given theme and open an entity editor. */
async function openEntityEditor(page: Page, theme: ThemeMode): Promise<boolean> {
  await gotoWithTheme(page, theme, "/");
  await page.waitForTimeout(500);

  if (!(await clickTemplateCreateButton(page, "addonFull"))) return false;
  await page.waitForTimeout(1000);
  await preferBrowserStorageInProjectDialog(page);
  await fillRequiredProjectDialogFields(page);

  const ok = page.getByTestId("submit-button").first();
  if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ok.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForTimeout(3000);
  if (!(await waitForEditorReady(page, 25000))) return false;
  await selectEditMode(page, "full").catch(() => {});

  if (await selectEntityType(page, "biceson")) return true;
  return await selectEntityType(page, "mammothon");
}

for (const theme of ["light", "dark"] as const) {
  test(`Editor header text meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const opened = await openEntityEditor(page, theme);
    test.skip(!opened, "Could not open an entity editor (Full Add-On entity unavailable)");

    const title = page.locator(".editor-header-title").first();
    await expect(title).toBeVisible({ timeout: 5000 });

    // Every text element in the chip is white-on-stone — title, the dimmed subtitle,
    // the type badge, and the version badge must all clear 4.5:1.
    const chipTextSelectors = [
      ".editor-header-title",
      ".editor-header-subtitle",
      ".editor-header-badge",
      ".editor-header-format-version",
    ];
    for (const sel of chipTextSelectors) {
      const ratios = await getRenderedContrast(page, sel);
      for (const r of ratios) {
        expect(r, `${sel} contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
          MIN_CONTRAST
        );
      }
    }
  });
}
