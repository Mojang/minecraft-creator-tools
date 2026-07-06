/**
 * "Choose Files" upload button focus-indicator contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The file-upload button (role=button div) takes the global keyboard focus ring. On the
 * light home surface the brand green4 ring measured ~2.66:1 — below the 3:1 minimum for
 * a focus indicator. The ring must clear 3:1 against the surface in both themes.
 *
 * Run: npx playwright test ChooseFilesFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { gotoWithTheme, processMessage } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;
const BTN = '[aria-label="Choose files to upload"]';

async function focusRingContrast(page: Page, selector: string): Promise<number> {
  return await page.evaluate((sel) => {
    function parse(c: string): [number, number, number, number] {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
    }
    function over(fg: number[], bg: number[]): [number, number, number] {
      const a = fg[3];
      return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    }
    function compositeBg(el: Element | null): [number, number, number] {
      const layers: [number, number, number, number][] = [];
      let n: Element | null = el;
      while (n) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
        n = n.parentElement;
      }
      let base: [number, number, number] = [255, 255, 255];
      if (layers.length && layers[layers.length - 1][3] === 1) {
        const last = layers.pop()!;
        base = [last[0], last[1], last[2]];
      }
      for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
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
    const el = document.querySelector(sel);
    if (!el) return -3;
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) === 0) return -2;
    const oc = parse(cs.outlineColor);
    const bg = compositeBg(el.parentElement);
    return Math.round(ratio(lum([oc[0], oc[1], oc[2]]), lum(bg)) * 100) / 100;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Choose Files focus indicator meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme, "/");
    const btn = page.locator(BTN).first();
    await expect(btn).toBeVisible({ timeout: 20000 });

    // Disable transitions so the focus ring is measured at its final state.
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Keyboard-focus the button so :focus-visible applies (a role=button div only gets
    // focus-visible from keyboard focus, not programmatic .focus()).
    let focused = false;
    for (let i = 0; i < 60 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await btn.evaluate((el) => el === document.activeElement);
    }
    expect(focused, "expected to keyboard-focus the Choose Files button").toBe(true);

    const ratio = await focusRingContrast(page, BTN);
    expect(
      ratio,
      `Choose Files focus ring contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
