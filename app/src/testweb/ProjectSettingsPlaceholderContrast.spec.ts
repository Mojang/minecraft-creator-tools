/**
 * Project Settings input placeholder contrast (WCAG 1.4.3).
 *
 * The native inputs/textarea in Project Settings (.ppe-fieldInput / .ppe-fieldTextArea)
 * styled their placeholder with `opacity: 0.5` on top of the browser's already-muted
 * default placeholder colour. Compounded, the "contoso" placeholder rendered ~#ABAAAA
 * on the light field — ~1.76:1, far below the 4.5:1 minimum for text. Placeholder
 * de-emphasis must come from an explicit muted-but-compliant colour, not opacity.
 *
 * getRenderedContrast can't read a `::placeholder` pseudo-element, so this reads the
 * placeholder's computed colour + opacity and composites it over the field background.
 *
 * Run: npx playwright test ProjectSettingsPlaceholderContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;
const FIELDS = "input.ppe-fieldInput, textarea.ppe-fieldTextArea";

// Lowest ::placeholder contrast across all matched fields, composited over each
// field's effective background.
async function minPlaceholderContrast(page: Page, selector: string): Promise<number> {
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
    const els = Array.from(document.querySelectorAll(sel));
    if (els.length === 0) return -1;
    let worst = Number.POSITIVE_INFINITY;
    for (const el of els) {
      const ph = getComputedStyle(el, "::placeholder");
      const phc = parse(ph.color);
      const phOpacity = parseFloat(ph.opacity || "1");
      const bg = effBg(el);
      const alpha = phc[3] * phOpacity;
      const text = over([phc[0], phc[1], phc[2], alpha], bg);
      worst = Math.min(worst, Math.round(ratio(lum(text), lum(bg)) * 100) / 100);
    }
    return worst;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Project Settings input placeholders meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 15000 });
    await projectSettings.click();

    // The CREATOR field (placeholder "contoso") is the reported case; wait for it.
    await expect(page.locator('input[aria-labelledby="ppe-creatorlabel"]').first()).toBeVisible({ timeout: 10000 });

    const ratio = await minPlaceholderContrast(page, FIELDS);
    expect(
      ratio,
      `worst Project Settings placeholder contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
