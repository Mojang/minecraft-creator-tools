/**
 * Settings checkbox "tick" contrast (WCAG 1.4.11).
 *
 * MUI's checked checkbox is a filled square whose check mark is a transparent cutout —
 * so the "tick" shows whatever background sits behind the control. The theme filled the
 * checked checkbox with brand green4 (#52a535); on the light settings panel (a grey
 * surface) the green4 fill against the grey cutout measured ~1.93:1, below the 3:1
 * minimum for a graphical control indicator. The checked fill must contrast >=3:1 with
 * the panel behind it in both themes.
 *
 * The cut-out tick takes the colour of the panel behind the control, so this measures
 * the checked fill colour against the checkbox's composited ancestor background.
 *
 * Run: npx playwright test SettingsCheckboxTickContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;
const CHECKBOX = ".csp-formatbeforesave .MuiCheckbox-root";

async function checkboxTickContrast(page: Page, selector: string): Promise<number> {
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
    const el = document.querySelector(sel);
    if (!el) return -1;
    const fill = parse(getComputedStyle(el).color); // the checked square / tick fill colour
    const bg = effBg(el); // colour showing through the cut-out tick
    return Math.round(ratio(lum([fill[0], fill[1], fill[2]]), lum(bg)) * 100) / 100;
  }, selector);
}

for (const theme of ["light", "dark"] as const) {
  test(`Settings checkbox tick meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    const ok = await enterEditor(page, theme as ThemeMode);
    test.skip(!ok, "Could not enter editor");

    // Open the Settings panel (toolbar button), which hosts the "Format JSON and
    // script on save" checkbox.
    await page.locator('button[title="Settings"], [aria-label="Settings"]').first().click();
    const checkbox = page.locator(CHECKBOX).first();
    await expect(checkbox).toBeVisible({ timeout: 15000 });

    // The setting is off by default; check it so the tick is rendered.
    const input = page.locator(`.csp-formatbeforesave input[type="checkbox"]`).first();
    if (!(await input.isChecked())) {
      await checkbox.click();
      await expect(input).toBeChecked({ timeout: 5000 });
    }

    const ratio = await checkboxTickContrast(page, CHECKBOX);
    expect(
      ratio,
      `checkbox tick contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
