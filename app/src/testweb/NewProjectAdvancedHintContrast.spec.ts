/**
 * "Show Advanced Options" hint text contrast (WCAG 1.4.3).
 *
 * The new-project dialog has a collapsed "Show Advanced Options" toggle with a small
 * hint listing what it reveals ("folder name, game version, description"). The toggle
 * row was de-emphasised with `opacity: 0.7`, and the hint added another `opacity: 0.6`
 * on top — compounding to ~0.42 effective. That dimmed the hint to ~#A09E9E on the
 * near-white dialog, ~2.1:1, well below the 4.5:1 minimum for body text. De-emphasis
 * must come from an explicit muted-but-compliant colour, not stacked opacity.
 *
 * Run: npx playwright test NewProjectAdvancedHintContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { gotoWithTheme, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`New-project advanced-options hint meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme, "/");

    // "Create New" opens the new-project dialog; the advanced-options hint is shown
    // by default while the section is collapsed.
    await page.getByRole("button", { name: "Create New" }).first().click();
    const hint = page.locator(".npd-advancedHint").first();
    await expect(hint).toBeVisible({ timeout: 15000 });

    const ratios = await getRenderedContrast(page, ".npd-advancedHint");
    expect(ratios.length, "expected the advanced-options hint to be present").toBeGreaterThan(0);
    for (const ratio of ratios) {
      expect(
        ratio,
        `advanced-options hint contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
