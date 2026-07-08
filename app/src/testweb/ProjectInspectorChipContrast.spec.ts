/**
 * Project Inspector zero-count filter chip contrast (WCAG 1.4.3).
 *
 * Filter chips whose count is 0 (e.g. "ERRORS 0", "FAILED 0") were de-emphasized
 * with `opacity: 0.5` applied to the whole chip (the McChip ButtonBase). Because
 * that opacity sits ABOVE the chip's own opaque background, it dims the chip's text
 * AND fill together over the toolbar, compressing the white-on-red contrast from
 * ~4.98:1 down to ~2.7:1 — below the 4.5:1 minimum.
 *
 * Note: a plain text/background contrast check (e.g. getRenderedContrast) does NOT
 * catch this, because within the chip the ratio is still 4.98:1; the loss only
 * appears once the group opacity composites the chip over the toolbar. This test
 * therefore measures the effective contrast WITH the group opacity folded in.
 *
 * The fix is to stop dimming zero-count chips with opacity (they then render at full
 * strength, ~4.98:1+, and the "0" count still signals emptiness).
 *
 * Run: npx playwright test ProjectInspectorChipContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, waitForInspectorValidationComplete } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

/**
 * Effective contrast of each matched chip-content element's text vs its own fill,
 * with any group opacity on an ancestor folded in (i.e. the chip composited over
 * the toolbar backdrop). Returns one ratio per matched element.
 */
async function chipEffectiveContrast(page: Page, selector: string): Promise<number[]> {
  return await page.evaluate((sel) => {
    function parse(c: string): [number, number, number, number] {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
    }
    function over(fg: number[], bg: number[]): number[] {
      const a = fg[3];
      return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    }
    function backdrop(el: Element | null): number[] {
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
    return Array.from(document.querySelectorAll(sel)).map((content) => {
      const text = parse(getComputedStyle(content).color);
      const fill = parse(getComputedStyle(content).backgroundColor);
      // Cumulative opacity from the chip content up to the document root.
      let alpha = 1;
      let n: Element | null = content;
      while (n) {
        alpha *= parseFloat(getComputedStyle(n).opacity || "1");
        n = n.parentElement;
      }
      // The chip composites over whatever is behind the focusable chip button.
      const btn = content.closest("[aria-label]");
      const back = backdrop(btn ? btn.parentElement : content.parentElement);
      const effText = over([text[0], text[1], text[2], alpha], back);
      const effFill = over([fill[0], fill[1], fill[2], alpha], back);
      return Math.round(ratio(lum(effText), lum(effFill)) * 100) / 100;
    });
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Project Inspector zero-count filter chips meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    await page.getByText("Check for Problems").first().click();
    await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });
    // Validation runs in a worker and is slow on the Vite dev server; wait for it to
    // finish so the Items filter chips are actually rendered before asserting on them.
    await waitForInspectorValidationComplete(page);
    await page.locator("#pid-tab-items").click();
    await page.locator(".mcc-chipContent").first().waitFor({ timeout: 20000 });
    await page.mouse.move(0, 0);

    // Zero-count chips have an aria-label ending ", 0 items".
    const zeroChipContent = '[aria-label*=", 0 items"] .mcc-chipContent';
    expect(await page.locator(zeroChipContent).count(), "expected at least one zero-count chip").toBeGreaterThan(0);

    const ratios = await chipEffectiveContrast(page, zeroChipContent);
    const min = Math.min(...ratios);
    for (const r of ratios) {
      expect(
        r,
        `zero-count chip effective contrast ${r}:1 (min ${min}:1 across ${ratios.length}) must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}
