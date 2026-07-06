/**
 * McButton "green" variant label contrast (WCAG 1.4.3).
 *
 * The Minecraft-style green McButton (e.g. "Open a Folder on This Device") drew white
 * labels on a green4 (#52a535) face — only ~3.1:1, below the 4.5:1 minimum for
 * regular-size labels. The button face must be a dark enough green for white labels.
 *
 * Run: npx playwright test McButtonGreenContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { gotoWithTheme, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;
const FACE = ".mcb-buttonFace-green";

for (const theme of ["light", "dark"] as const) {
  test(`Green McButton label meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme, "/");

    await expect(page.locator(FACE).first()).toBeVisible({ timeout: 20000 });

    const ratios = await getRenderedContrast(page, FACE);
    expect(ratios.length, "expected at least one green McButton").toBeGreaterThan(0);
    for (const ratio of ratios) {
      expect(
        ratio,
        `green McButton label contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
