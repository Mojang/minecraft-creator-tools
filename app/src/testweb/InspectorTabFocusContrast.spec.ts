/**
 * Project Inspector tab focus-indicator contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The Summary/Items tab buttons (`.pid-hiddenButton`) draw their keyboard focus ring
 * with `outline: 2px solid #52a535` (brand green4). On the light-grey inspector
 * toolbar that outline is only ~1.78:1 against the adjacent background — below the
 * 3:1 minimum for a focus indicator. In dark mode the toolbar is dark, so green4
 * passes; this is a light-mode failure. The focus outline must use a colour that
 * clears 3:1 against the toolbar in both themes.
 *
 * Run: npx playwright test InspectorTabFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;

/** Contrast of a focused element's outline colour against its adjacent background. */
async function focusOutlineContrast(page: Page, selector: string): Promise<number> {
  return await page.evaluate((sel) => {
    function parse(c: string): [number, number, number, number] {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 1];
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
    }
    function over(fg: number[], bg: number[]): number[] {
      const a = fg[3];
      return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    }
    function effBg(el: Element | null): number[] {
      const stack: [number, number, number, number][] = [];
      let n: Element | null = el;
      while (n) {
        stack.push(parse(getComputedStyle(n).backgroundColor));
        n = n.parentElement;
      }
      let base = [255, 255, 255];
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i][3] > 0) base = over(stack[i], base);
      }
      return base;
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
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return -1;
    el.focus();
    const cs = getComputedStyle(el);
    const outline = parse(cs.outlineColor);
    const bg = effBg(el.parentElement);
    const oc = outline[3] < 1 ? over(outline, bg) : [outline[0], outline[1], outline[2]];
    return Math.round(ratio(lum(oc), lum(bg)) * 100) / 100;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Inspector tab focus indicator meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);

    await page.getByText("Check for Problems").first().click();
    await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });

    for (const tabId of ["#pid-tab-summary", "#pid-tab-items"]) {
      const tab = page.locator(tabId);
      await expect(tab).toBeVisible({ timeout: 10000 });
      await tab.focus();

      const ratio = await focusOutlineContrast(page, tabId);
      expect(ratio, `expected ${tabId} focus outline`).toBeGreaterThan(0);
      expect(
        ratio,
        `${tabId} focus indicator contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
