/**
 * Project Inspector rule-code contrast (WCAG 1.4.3).
 *
 * The Items view of the Project Inspector renders each rule code (e.g. "COMJSON1110",
 * "ITEMS103") in a `.piid-code` chip, and each file path in a `.piid-locationLink`,
 * whose text color is the theme `foreground2` (offBlack in light mode) dimmed with
 * `opacity: 0.8`. Non-banded rows are transparent and therefore sit on the panel
 * background (`background3` = gray3 #9a9896 in light mode). offBlack at 0.8 opacity
 * over gray3 composites to ~#343231, which is only ~4.43:1 — below the 4.5:1 minimum
 * for normal-size text.
 *
 * Removing the opacity (relying on `foreground2`, the surface's complement
 * foreground, for de-emphasis) restores full strength → ~6.1:1 on the panel.
 *
 * Run: npx playwright test ProjectInspectorCodeContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`Project Inspector rule codes meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);

    // Settle colors before measuring (banded rows animate background-color).
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Open the Project Inspector ("Check for Problems" sidebar entry, full mode only).
    await page.getByText("Check for Problems").first().click();
    await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });

    // Switch to the Items list and show every result type (Information is hidden by
    // default, and the reported codes are Information-level rows).
    await page.locator("#pid-tab-items").click();
    await page.getByRole("button", { name: "Show all filter types" }).click();

    // Wait for the rule-code chips to render after validation runs.
    await page.locator(".piid-code").first().waitFor({ timeout: 20000 });
    await page.mouse.move(0, 0);

    // Both the rule code and the file path are de-emphasized monospace text on the
    // same panel and share the failure.
    const ratios = await getRenderedContrast(page, ".piid-code, .piid-locationLink");
    expect(ratios.length, "expected rule-code / path chips").toBeGreaterThan(1);

    const min = Math.min(...ratios);
    for (const r of ratios) {
      expect(
        r,
        `inspector code/path contrast ${r}:1 (min ${min}:1 across ${ratios.length} elements) must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
