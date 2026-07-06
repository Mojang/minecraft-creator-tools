/**
 * Settings "Edit Experience" option focus-indicator contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The edit-experience picker (Focused / Full / Raw) uses native buttons that removed
 * the browser focus ring (`outline: none`) and signalled focus only by changing the
 * border to a translucent brand green (rgba(82,165,53,0.6)). On the grey settings panel
 * that green border measured ~1.87:1 against the surround — below the 3:1 minimum for a
 * focus indicator — and it is the same colour as the selected-state border, so focusing
 * the already-selected option produced no distinct indicator. The fix restores a
 * visible, theme-aware keyboard focus ring.
 *
 * Native buttons only get :focus-visible from keyboard focus, so this Tab-walks to the
 * option before measuring.
 *
 * Run: npx playwright test SettingsEditOptionFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;
const OPTION = ".csp-editOption";

async function focusIndicatorContrast(page: Page, selector: string): Promise<number> {
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
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return -3;
    const cs = getComputedStyle(el);
    const ownBg = compositeBg(el);
    const parentBg = compositeBg(el.parentElement);
    // Consider whichever focus affordance is drawn: the outline ring and/or the
    // focus border. Report the most-visible one (best contrast against the surround).
    const candidates: number[] = [];
    if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) {
      const oc = parse(cs.outlineColor);
      const c = over(oc, parentBg);
      candidates.push(ratio(lum(c), lum(parentBg)));
    }
    // The focus border sits between the button fill and the panel; require it to be
    // visible against both sides (take the weaker side).
    const bc = parse(cs.borderTopColor);
    const onOwn = over(bc, ownBg);
    const onParent = over(bc, parentBg);
    candidates.push(Math.min(ratio(lum(onOwn), lum(ownBg)), ratio(lum(onParent), lum(parentBg))));
    return Math.round(Math.max(...candidates) * 100) / 100;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Settings edit-option focus indicator meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    await page.locator('button[title="Settings"], [aria-label="Settings"]').first().click();
    const option = page.locator(OPTION).first();
    await expect(option).toBeVisible({ timeout: 15000 });

    // The edit-option buttons animate their focus ring via `transition: all 0.15s`;
    // disable transitions so the outline is measured at its final state, not mid-fade.
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Keyboard-focus the option so :focus-visible applies (native buttons don't get
    // focus-visible from programmatic focus).
    let focused = false;
    for (let i = 0; i < 60 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await option.evaluate((el) => el === document.activeElement);
    }
    expect(focused, "expected to keyboard-focus the first edit-experience option").toBe(true);

    const ratio = await focusIndicatorContrast(page, OPTION);
    expect(
      ratio,
      `edit-option focus indicator contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
