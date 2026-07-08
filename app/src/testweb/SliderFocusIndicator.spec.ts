/**
 * Keyboard focus indicator for MUI Slider controls (WCAG 2.4.7 Focus Visible).
 *
 * The app's MUI theme styles slider thumbs with a Minecraft bevel and previously
 * gave the hover and keyboard-focus states the same look (and suppressed MUI's
 * default focus halo with !important), leaving keyboard users no visible focus
 * indicator. This guards the theme-level focus outline. Exercised via the
 * Create Mob wizard's Mob Stats step, which renders sliders.
 */

import { test, expect, Page } from "@playwright/test";

async function openMobWizard(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("h3")).find((e) => (e.textContent || "").trim() === "Make a Mob");
    const b = h && h.closest("button");
    if (b) (b as HTMLElement).click();
  });
  await page.waitForTimeout(800);
}

/** Advance the wizard until the Mob Stats sliders are on screen. */
async function gotoSlidersStep(page: Page): Promise<void> {
  const slider = page.locator(".MuiSlider-root").first();
  for (let i = 0; i < 6; i++) {
    if (await slider.isVisible().catch(() => false)) return;
    const next = page.getByRole("button", { name: /^Next/i }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
      await page.waitForTimeout(400);
    } else {
      await page.waitForTimeout(400);
    }
  }
}

test.describe("MUI slider keyboard focus indicator", () => {
  test("a keyboard-focused slider thumb shows a visible focus indicator", async ({ page }) => {
    await openMobWizard(page);
    await gotoSlidersStep(page);
    await expect(page.locator(".MuiSlider-root").first()).toBeVisible({ timeout: 15000 });

    // Tab (keyboard) until a slider thumb becomes focus-visible.
    let focused = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => !!document.querySelector(".MuiSlider-thumb.Mui-focusVisible"));
      if (focused) break;
    }
    expect(focused, "expected to keyboard-focus a slider thumb").toBe(true);

    // The focused thumb must have a visible focus indicator (outline or an outer
    // box-shadow halo) — not just the same bevel it has at rest/hover.
    const indicator = await page.evaluate(() => {
      const thumb = document.querySelector(".MuiSlider-thumb.Mui-focusVisible");
      if (!thumb) return null;
      const cs = getComputedStyle(thumb);
      const outlinePx = parseFloat(cs.outlineWidth) || 0;
      const hasOutline = cs.outlineStyle !== "none" && outlinePx >= 2;
      // Detect a non-inset (outer) box-shadow ring. Mask out rgb()/rgba() first so
      // their internal commas don't corrupt the per-shadow split.
      const masked = cs.boxShadow.replace(/rgba?\([^)]*\)/g, "C");
      const segments = masked === "none" ? [] : masked.split(",");
      const hasOuterShadow = segments.some((s) => s.trim() !== "" && !s.includes("inset"));
      return { outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow, hasOutline, hasOuterShadow };
    });
    expect(indicator, "expected a focus-visible thumb").not.toBeNull();
    expect(
      indicator!.hasOutline || indicator!.hasOuterShadow,
      `slider thumb has no visible focus indicator: ${JSON.stringify(indicator)}`
    ).toBe(true);
  });
});
