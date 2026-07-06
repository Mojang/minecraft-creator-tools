/**
 * Script editor snippet-search placeholder contrast (WCAG 1.4.3).
 *
 * The "add a code snippet" search field in the JavaScript/TypeScript editor is a
 * MUI TextField. MUI renders the placeholder as `currentColor` at `opacity: 0.42`
 * (light) / `0.5` (dark). In light mode the input text color is gray6 (#262423),
 * so the placeholder composites to ~#A4A3A3 on the white field = ~2.51:1 — below
 * the 4.5:1 minimum for normal-size informational text.
 *
 * Note: getRenderedContrast can't read a `::placeholder` pseudo-element, so this
 * test reads the placeholder's computed color + opacity directly and composites it
 * over the field background.
 *
 * Run: npx playwright test ScriptEditorPlaceholderContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, enableAllFileTypes } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

/** Effective contrast of an input's ::placeholder text against the field background. */
async function placeholderContrast(page: Page, selector: string): Promise<number> {
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
    function effBg(el: Element): number[] {
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
    const input = document.querySelector(sel);
    if (!input) return -1;
    const ph = getComputedStyle(input, "::placeholder");
    const phc = parse(ph.color);
    const phOpacity = parseFloat(ph.opacity || "1");
    const bg = effBg(input);
    const alpha = phc[3] * phOpacity;
    const text = over([phc[0], phc[1], phc[2], alpha], bg);
    return Math.round(ratio(lum(text), lum(bg)) * 100) / 100;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Script editor snippet placeholder meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);
    await enableAllFileTypes(page);

    // Open a script file so the JavaScript editor (with the snippet search field) renders.
    const scriptFile = page
      .locator(".pit-name")
      .filter({ hasText: /^main$/ })
      .first();
    await expect(scriptFile).toBeVisible({ timeout: 15000 });
    await scriptFile.click();

    const search = page.locator("#projSearch");
    await expect(search).toBeVisible({ timeout: 20000 });

    const ratio = await placeholderContrast(page, "#projSearch");
    expect(ratio, "expected to find the snippet search placeholder").toBeGreaterThan(0);
    expect(
      ratio,
      `snippet placeholder contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
