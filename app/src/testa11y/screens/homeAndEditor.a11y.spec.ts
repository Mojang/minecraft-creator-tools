/**
 * Per-screen axe-core accessibility scans for the home page and editor.
 *
 * Tests each screen in the full theme × high-contrast matrix:
 * - light, dark (standard themes)
 * - light + high contrast, dark + high contrast (forced-colors mode)
 *
 * Tags: @comprehensive-a11y
 */

import { test } from "../fixtures";
import { assertNoCriticalViolations, THEME_MATRIX, applyThemeVariant } from "../a11yTestUtils";
import { enterEditor, gotoWithTheme, ThemeMode } from "../../testweb/WebTestUtilities";

test.describe("Home Page Accessibility @comprehensive-a11y", () => {
  for (const tv of THEME_MATRIX) {
    test(`home page — ${tv.label} — no critical violations`, async ({ page }) => {
      await applyThemeVariant(page, tv);
      await page.waitForTimeout(500);

      await assertNoCriticalViolations(page, `Home (${tv.label})`, {
        screenshotPath: `debugoutput/screenshots/a11y-home-${tv.variant}.png`,
      });
    });
  }

  // Best-practice checks only in standard themes (not HC)
  for (const theme of ["light", "dark"] as ThemeMode[]) {
    test(`home page — ${theme} mode — landmarks and headings`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      await page.waitForTimeout(500);

      await assertNoCriticalViolations(page, `Home landmarks (${theme})`, {
        extraTags: ["best-practice"],
      });
    });
  }
});

test.describe("Project Editor Accessibility @comprehensive-a11y", () => {
  for (const tv of THEME_MATRIX) {
    test(`editor — ${tv.label} — focused mode — no critical violations`, async ({ page }) => {
      const entered = await enterEditor(page, { theme: tv.theme, editMode: "focused" });
      if (!entered) {
        test.skip();
        return;
      }

      if (tv.forcedColors) {
        await page.emulateMedia({ forcedColors: "active" });
      }

      await assertNoCriticalViolations(page, `Editor focused (${tv.label})`, {
        screenshotPath: `debugoutput/screenshots/a11y-editor-focused-${tv.variant}.png`,
      });
    });

    test(`editor — ${tv.label} — full mode — no critical violations`, async ({ page }) => {
      const entered = await enterEditor(page, { theme: tv.theme, editMode: "full" });
      if (!entered) {
        test.skip();
        return;
      }

      if (tv.forcedColors) {
        await page.emulateMedia({ forcedColors: "active" });
      }

      await assertNoCriticalViolations(page, `Editor full (${tv.label})`, {
        screenshotPath: `debugoutput/screenshots/a11y-editor-full-${tv.variant}.png`,
      });
    });

    test(`editor — ${tv.label} — raw mode — no critical violations`, async ({ page }) => {
      const entered = await enterEditor(page, { theme: tv.theme, editMode: "raw" });
      if (!entered) {
        test.skip();
        return;
      }

      if (tv.forcedColors) {
        await page.emulateMedia({ forcedColors: "active" });
      }

      await assertNoCriticalViolations(page, `Editor raw (${tv.label})`, {
        screenshotPath: `debugoutput/screenshots/a11y-editor-raw-${tv.variant}.png`,
      });
    });
  }
});

test.describe("Import Workflows Accessibility @comprehensive-a11y", () => {
  for (const tv of THEME_MATRIX) {
    test(`import files — ${tv.label} — no critical violations`, async ({ page }) => {
      await applyThemeVariant(page, tv, "/?mode=home");
      await page.waitForTimeout(500);

      const chooseFilesBtn = page.getByRole("button", { name: /choose files/i }).first();
      if (await chooseFilesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await assertNoCriticalViolations(page, `Import files (${tv.label})`);
      }
    });
  }
});

test.describe("Project Creation Dialog Accessibility @comprehensive-a11y", () => {
  for (const tv of THEME_MATRIX) {
    test(`new project dialog — ${tv.label} — no critical violations`, async ({ page }) => {
      await applyThemeVariant(page, tv);
      await page.waitForTimeout(500);

      const newButton = page.getByRole("button", { name: "Create New" }).first();
      if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await newButton.click();
      await page.waitForTimeout(500);

      await assertNoCriticalViolations(page, `New Project Dialog (${tv.label})`, {
        screenshotPath: `debugoutput/screenshots/a11y-new-project-dialog-${tv.variant}.png`,
      });

      await page.keyboard.press("Escape");
    });
  }
});
