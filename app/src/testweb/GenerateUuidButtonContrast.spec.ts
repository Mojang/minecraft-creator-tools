/**
 * Project Settings "Generate" (UUID) button label contrast (WCAG 1.4.3).
 *
 * The Advanced - Unique Identifiers section renders contained primary "Generate"
 * buttons (white label on the brand green). MUI fills a contained primary button with
 * palette primary (green4 #52a535), which is only ~3.1:1 against white text — below the
 * 4.5:1 minimum for regular-size labels. The theme's containedPrimary override darkens
 * the fill (green6) so white labels clear 4.5:1; this guards that on the Settings page.
 *
 * Run: npx playwright test GenerateUuidButtonContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;
const GENERATE_BTN = ".ppe-uuidRow .MuiButton-containedPrimary";

for (const theme of ["light", "dark"] as const) {
  test(`Project Settings Generate buttons meet 4.5:1 label contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    // Open the Project Settings page (left sidebar entry), where the Advanced -
    // Unique Identifiers section renders the "Generate" buttons.
    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 15000 });
    await projectSettings.click();

    const firstBtn = page.locator(GENERATE_BTN).first();
    await expect(firstBtn).toBeVisible({ timeout: 10000 });

    const ratios = await getRenderedContrast(page, GENERATE_BTN);
    expect(ratios.length, "expected Generate buttons to be present").toBeGreaterThan(0);
    for (const ratio of ratios) {
      expect(
        ratio,
        `Generate button label contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
