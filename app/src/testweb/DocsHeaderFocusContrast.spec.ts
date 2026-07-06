/**
 * Home-header "Docs" link focus-indicator contrast (WCAG 1.4.11 / 2.4.11).
 *
 * The header nav links (Docs / Command Line / GitHub) sit on the wool-texture banner and
 * take the app's global keyboard focus ring. On the light wool the brand green4 ring
 * measured ~2.85:1 — below the 3:1 minimum. The ring must clear 3:1 against the lightest
 * wool pixel (the worst-case adjacent) in both themes.
 *
 * The ring sits on a background-image, so this samples the wool PNG's lightest pixel
 * (loaded into a canvas) as the adjacent surface rather than reading a solid bg color.
 *
 * Run: npx playwright test DocsHeaderFocusContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { gotoWithTheme, processMessage, ThemeMode } from "./WebTestUtilities";

const MIN_CONTRAST = 3.0;
const DOCS = "a.hhdr-docsLink";

async function docsFocusRingContrast(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    function lum(r: number, g: number, b: number): number {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    }
    function ratio(a: number, b: number): number {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      return (hi + 0.05) / (lo + 0.05);
    }
    const el = document.querySelector("a.hhdr-docsLink") as HTMLElement | null;
    if (!el) return -3;
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) === 0) return -2;
    const m = cs.outlineColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return -6;
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    const ringLum = lum(p[0], p[1], p[2]);

    // Find the header wool background image and sample its lightest (worst-case) pixel.
    let woolUrl: string | null = null;
    for (const e of Array.from(document.querySelectorAll("*"))) {
      const bi = getComputedStyle(e).backgroundImage;
      if (bi && bi.includes("bg-wool")) {
        const um = bi.match(/url\(["']?([^"')]+)["']?\)/);
        if (um) {
          woolUrl = um[1];
          break;
        }
      }
    }
    if (!woolUrl) return -4;
    const woolLum = await new Promise<number>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        let data: Uint8ClampedArray;
        try {
          data = ctx.getImageData(0, 0, c.width, c.height).data;
        } catch {
          resolve(-1);
          return;
        }
        let best = -1;
        for (let i = 0; i < data.length; i += 4) {
          const L = lum(data[i], data[i + 1], data[i + 2]);
          if (L > best) best = L;
        }
        resolve(best);
      };
      img.onerror = () => resolve(-1);
      img.src = woolUrl!;
    });
    if (woolLum < 0) return -5;
    return Math.round(ratio(ringLum, woolLum) * 100) / 100;
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Docs header link focus indicator meets 3:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    await gotoWithTheme(page, theme as ThemeMode, "/");
    const link = page.locator(DOCS).first();
    await expect(link).toBeVisible({ timeout: 20000 });

    // Keyboard-focus the link so :focus-visible applies.
    let focused = false;
    for (let i = 0; i < 40 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await link.evaluate((el) => el === document.activeElement);
    }
    expect(focused, "expected to keyboard-focus the Docs link").toBe(true);

    const ratio = await docsFocusRingContrast(page);
    expect(
      ratio,
      `Docs link focus ring contrast ${ratio}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
}
