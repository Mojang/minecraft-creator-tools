/**
 * Project Inspector unselected filter-chip contrast (WCAG 1.4.3).
 *
 * Filter chips in the inspector toolbar (ALL / Errors / Warnings / Recommendations /
 * Info / Passed / Failed) are McChips. In the UNSELECTED (filter-off) state they used a
 * translucent 15%-opacity tint as their background, so the medium-grey inspector toolbar
 * showed through and the light variant-coloured text measured only ~1.6-2.7:1 against it —
 * below the 4.5:1 body-text minimum. The fix gives unselected chips a solid dark fill so
 * the text always clears 4.5:1, while selected chips stay bright (active = "lit",
 * inactive = "unlit").
 *
 * This measures every chip's text against its composited background in both the default
 * state and with the Errors filter toggled off (so the error variant is exercised
 * unselected — the exact control on the bug).
 *
 * Run: npx playwright test ProjectInspectorUnselectedChipContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;
const CHIP = ".mcc-chipContent";

async function chipContrasts(page: Page): Promise<{ text: string; selected: boolean; contrast: number }[]> {
  return await page.evaluate((sel) => {
    function parse(c: string): number[] {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 1];
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
    }
    function over(fg: number[], bg: number[]): number[] {
      const a = fg[3];
      return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
    }
    function lum(c: number[]): number {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    }
    function ratio(a: number, b: number): number {
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    function compositeBg(el: Element | null): number[] {
      const stack: number[][] = [];
      let n: Element | null = el;
      while (n) {
        stack.push(parse(getComputedStyle(n).backgroundColor));
        n = n.parentElement;
      }
      let base = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i][3] > 0) base = over(stack[i], base);
      return base;
    }
    return Array.from(document.querySelectorAll(sel)).map((el) => {
      const cs = getComputedStyle(el);
      const btn = el.closest("[aria-pressed]");
      return {
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20),
        selected: btn?.getAttribute("aria-pressed") === "true",
        contrast: Math.round(ratio(lum(parse(cs.color).slice(0, 3)), lum(compositeBg(el).slice(0, 3))) * 100) / 100,
      };
    });
  }, CHIP);
}

function assertAllPass(rows: { text: string; selected: boolean; contrast: number }[], theme: string) {
  expect(rows.length, "expected filter chips to be present").toBeGreaterThan(0);
  for (const r of rows) {
    expect(
      r.contrast,
      `chip "${r.text}" (${r.selected ? "selected" : "unselected"}) contrast ${r.contrast}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`Project Inspector filter chips meet 4.5:1 contrast, selected and unselected (${theme})`, async ({ page }) => {
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
    await page.locator("#pid-tab-items").click();
    await page.locator(CHIP).first().waitFor({ timeout: 20000 });
    await page.mouse.move(0, 0);

    // Default state: a mix of selected (problems) and unselected (passed/info/all) chips.
    assertAllPass(await chipContrasts(page), theme);

    // Toggle the Errors filter off so the error variant is exercised in its unselected
    // (dark-fill) state — the exact control reported on the bug.
    const errorsChip = page.locator('[aria-label^="Filter by errors"]').first();
    if (await errorsChip.count()) {
      await errorsChip.click();
      await page.waitForTimeout(150);
      await page.mouse.move(0, 0);
      assertAllPass(await chipContrasts(page), theme);
    }
  });
}
