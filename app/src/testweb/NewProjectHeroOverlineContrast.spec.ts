/**
 * New-project hero "Creating from template" overline contrast (WCAG 1.4.3).
 *
 * The new-project dialog's hero header paints the selected template's screenshot as a
 * background image, with a small "Creating from template" overline + template title
 * overlaid. The overline is small text in brand green; with only a translucent gradient
 * scrim it sat directly over the variable template image, measuring ~3.1:1 against a
 * mid-tone image region — below the 4.5:1 minimum for body text. A single text colour
 * can never clear 4.5:1 over an arbitrary image, so the text must sit on a solid scrim.
 *
 * This test encodes that rule: walking up from the overline, an OPAQUE background colour
 * must be reached before any element painting a background image. If the image backdrop
 * is hit first, the text has no guaranteed scrim and the test fails.
 *
 * Run: npx playwright test NewProjectHeroOverlineContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { gotoWithTheme, processMessage } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

// Contrast of the overline text against the nearest OPAQUE background behind it.
// Returns -1 if a background image is reached before any opaque background colour
// (i.e. the text floats over the template image with no solid scrim).
async function heroOverlineScrimContrast(page: Page, selector: string): Promise<number> {
  return await page.evaluate((sel) => {
    function parse(c: string): [number, number, number, number] {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
    }
    function lum(rgb: number[]): number {
      const ch = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }
    function ratio(a: number, b: number): number {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      return (hi + 0.05) / (lo + 0.05);
    }
    const el = document.querySelector(sel);
    if (!el) return -3;
    const text = parse(getComputedStyle(el).color);
    let node: Element | null = el;
    while (node) {
      const cs = getComputedStyle(node);
      const bg = parse(cs.backgroundColor);
      if (bg[3] === 1) {
        // Opaque scrim found — measure text against it.
        return Math.round(ratio(lum([text[0], text[1], text[2]]), lum([bg[0], bg[1], bg[2]])) * 100) / 100;
      }
      if (node !== el && cs.backgroundImage && cs.backgroundImage !== "none") {
        // Hit the template image before any solid scrim — text is unprotected.
        return -1;
      }
      node = node.parentElement;
    }
    return -2;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`New-project hero overline sits on a scrim meeting 4.5:1 (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme, "/");

    // "Create New" opens the new-project dialog whose hero header shows the overline.
    await page.getByRole("button", { name: "Create New" }).first().click();
    const overline = page.locator(".npd-heroOverline").first();
    await expect(overline).toBeVisible({ timeout: 15000 });

    const ratio = await heroOverlineScrimContrast(page, ".npd-heroOverline");
    expect(
      ratio,
      `hero overline scrim contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode); ` +
        `-1 means the text floats over the template image with no solid scrim`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
