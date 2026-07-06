/**
 * Settings edit-option description text contrast (WCAG 1.4.3).
 *
 * The Focused/Full/Raw cards in Settings show a small description ("Visual editors,
 * simplified view" etc.) styled with `opacity: 0.7`. The cards sit on a medium-grey
 * fill, so the dimmed description measured ~3.99:1 — below the 4.5:1 minimum for body
 * text. De-emphasis must not push body text below the contrast floor.
 *
 * Run: npx playwright test SettingsEditOptionDescContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;
const DESC = ".csp-editOptionDesc";

for (const theme of ["light", "dark"] as const) {
  test(`Settings edit-option descriptions meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    await page.locator('button[title="Settings"], [aria-label="Settings"]').first().click();
    await expect(page.locator(DESC).first()).toBeVisible({ timeout: 15000 });

    const ratios = await getRenderedContrast(page, DESC);
    expect(ratios.length, "expected edit-option descriptions to be present").toBeGreaterThan(0);
    for (const ratio of ratios) {
      expect(
        ratio,
        `edit-option description contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
