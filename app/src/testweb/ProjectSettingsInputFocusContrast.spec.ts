/**
 * Project Settings text-field focus-indicator contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The Basic Information text inputs (Creator / Name / Short Name / Namespace / Title) and
 * the Description textarea in Project Settings drew their keyboard focus ring with brand
 * green4 (#52a535). green4 has nearly the same luminance as the light-grey field fill, so
 * the focus ring measured ~1.07:1 against its surround — far below the 3:1 minimum for a
 * focus indicator. The fix uses a theme-aware ring (dark green on light surfaces, light
 * green on dark) so it always clears 3:1. Mirrors the dropdown fix in the same editor.
 *
 * Run: npx playwright test ProjectSettingsInputFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;
const FIELDS = "input.ppe-fieldInput, textarea.ppe-fieldTextArea";

// Lowest focus-ring contrast across every text field, measured against both the field's
// own fill (inner edge) and the surrounding card (outer edge).
async function minFieldFocusContrast(page: Page, selector: string): Promise<number> {
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
    function compositeBg(el: Element | null): [number, number, number] {
      const layers: [number, number, number, number][] = [];
      let node: Element | null = el;
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
        node = node.parentElement;
      }
      let base: [number, number, number] = [255, 255, 255];
      if (layers.length && layers[layers.length - 1][3] === 1) {
        const last = layers.pop()!;
        base = [last[0], last[1], last[2]];
      }
      for (let i = layers.length - 1; i >= 0; i--) {
        const [r, g, b, a] = layers[i];
        base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
      }
      return base;
    }

    const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    if (els.length === 0) return -3;
    let worst = Number.POSITIVE_INFINITY;
    for (const el of els) {
      el.focus(); // text inputs/textarea trigger :focus-visible on programmatic focus
      const cs = getComputedStyle(el);
      const hasOutline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const indicator = parse(hasOutline ? cs.outlineColor : cs.borderTopColor);
      const li = lum([indicator[0], indicator[1], indicator[2]]);
      const ownBg = compositeBg(el);
      const cardBg = compositeBg(el.parentElement);
      const r = Math.min(ratio(li, lum(ownBg)), ratio(li, lum(cardBg)));
      worst = Math.min(worst, Math.round(r * 100) / 100);
    }
    return worst;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Project Settings text-field focus indicator meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 15000 });
    await projectSettings.click();

    const firstField = page.locator("input.ppe-fieldInput").first();
    await expect(firstField).toBeVisible({ timeout: 10000 });

    const ratio = await minFieldFocusContrast(page, FIELDS);
    expect(
      ratio,
      `text-field focus-indicator contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
