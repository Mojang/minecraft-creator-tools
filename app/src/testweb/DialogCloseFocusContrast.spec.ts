/**
 * Global keyboard focus-ring contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The app's global focus ring (`:focus-visible`, `.Mui-focusVisible`) is drawn with
 * `outline: 2px solid #52a535` (brand green4). On light surfaces green4 is only
 * ~1.5–2.1:1 against the adjacent background — below the 3:1 minimum for a focus
 * indicator. A modal dialog's Close (X) button sits on a light header, where the ring
 * measures ~1.5:1. In dark mode the surfaces are dark, so green4 passes; this is a
 * light-mode failure. The ring must use a colour that clears 3:1 on its surface.
 *
 * The ring can sit over a header image, whose colour getComputedStyle can't read, so
 * this test reads the rendered global ring colour and measures it against a
 * representative surface for the theme (a mid-light grey in light mode).
 *
 * Run: npx playwright test DialogCloseFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { gotoWithTheme, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;

// Representative surface the focus ring must remain visible on, per theme: a
// mid-light grey header in light mode, a dark header in dark mode.
const REFERENCE_BG: Record<ThemeMode, [number, number, number]> = {
  light: [177, 179, 173], // ~#B1B3AD
  dark: [38, 36, 35], // ~gray6 #262423
};

async function focusRingContrast(page: Page, selector: string, ref: [number, number, number]): Promise<number> {
  return await page.evaluate(
    ({ sel, refBg }) => {
      function parse(c: string): [number, number, number, number] {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0, 1];
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
      if (!el) return -1;
      const oc = parse(getComputedStyle(el).outlineColor);
      return Math.round(ratio(lum([oc[0], oc[1], oc[2]]), lum(refBg)) * 100) / 100;
    },
    { sel: selector, refBg: ref }
  );
}

for (const theme of ["light", "dark"] as const) {
  test(`Dialog close-button focus ring meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme, "/");

    // Open a modal dialog with a Close (X) button. "Create New" opens the
    // project-creation dialog; a session-restore dialog may also be present — either
    // way its close button carries the same global focus ring under test.
    await page.getByRole("button", { name: "Create New" }).first().click();
    const closeBtn = page.locator('.MuiDialog-root button[aria-label="Close"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 15000 });

    // Keyboard-focus the close button so the :focus-visible / Mui-focusVisible ring
    // applies (programmatic focus does not trigger focus-visible in Chromium).
    let focused = false;
    for (let i = 0; i < 25 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await closeBtn.evaluate((el) => el === document.activeElement);
    }
    expect(focused, "expected to keyboard-focus the close button").toBe(true);

    const ratio = await focusRingContrast(page, '.MuiDialog-root button[aria-label="Close"]', REFERENCE_BG[theme]);
    expect(
      ratio,
      `close-button focus ring contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
