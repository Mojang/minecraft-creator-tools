/**
 * Project Inspector summary number-text contrast (WCAG 1.4.3).
 *
 * The Summary view renders content numbers in the brand green: the top stats bar
 * counts (`.pid-statCount` + leading `.pid-statIcon`) and the Content Statistics
 * values (`.pis-statValue` / `.pis-metricValue`). With the flat green4 (#52a535)
 * these fail — on the light-grey stat chip the count is only ~1.75:1, and the card
 * values fall below 4.5:1 on both the white (light) and dark stat cards. The number
 * text must use a theme-appropriate green that clears 4.5:1.
 *
 * Run: npx playwright test ProjectInspectorStatContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast, waitForInspectorValidationComplete } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`Project Inspector summary number text meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Open the Project Inspector and switch to the Summary view (the stats bar lives there).
    await page.getByText("Check for Problems").first().click();
    await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });
    // Validation runs in a worker and is slow on the Vite dev server; wait for it to
    // finish so the Summary stats are actually rendered before asserting on them.
    await waitForInspectorValidationComplete(page);
    await page.locator("#pid-tab-summary").click();
    await page.locator(".pid-statCount").first().waitFor({ timeout: 20000 });
    await page.mouse.move(0, 0);

    // The top stats bar (.pid-statCount) and the Content Statistics values
    // (.pis-statValue / .pis-metricValue) all render numbers in the brand green.
    const ratios = await getRenderedContrast(page, ".pid-statCount, .pis-statValue, .pis-metricValue");
    expect(ratios.length, "expected stat number elements").toBeGreaterThan(0);

    const min = Math.min(...ratios);
    for (const r of ratios) {
      expect(
        r,
        `stat number contrast ${r}:1 (min ${min}:1 across ${ratios.length}) must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
