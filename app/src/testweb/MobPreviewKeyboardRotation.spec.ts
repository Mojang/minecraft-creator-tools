/**
 * The 3D model-preview canvas on the mob editor must be operable by keyboard,
 * not just the mouse (WCAG 2.1.1). The viewer can be rotated by mouse drag; this
 * verifies the keyboard equivalent (focus + arrow keys orbit the model).
 *
 * The preview scene is static (no idle animation), so a byte-for-byte change in
 * the canvas pixels after pressing arrow keys reliably proves the model rotated.
 *
 * Run (from app/): npx playwright test MobPreviewKeyboardRotation.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

/** Walk the "Make a Mob" wizard until the editor with the preview canvas opens. */
async function makeMobAndOpenEditor(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  await page.getByRole("heading", { name: "Make a Mob" }).click();
  await page.waitForTimeout(1500);

  const canvas = page.locator('[data-testid="mob-viewer-canvas"]');

  for (let i = 0; i < 10; i++) {
    if (await canvas.isVisible().catch(() => false)) break;

    const next = page.getByRole("button", { name: "Next" }).first();
    if ((await next.isVisible({ timeout: 1500 }).catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
    } else {
      const finish = page.getByRole("button", { name: /^(Create|Create Project|Finish|Done)$/i }).first();
      if (await finish.isVisible({ timeout: 1500 }).catch(() => false)) {
        await finish.click();
      }
    }
    await page.waitForTimeout(2000);
  }

  await expect(canvas).toBeVisible({ timeout: 30000 });
  return canvas;
}

test.describe("Mob model preview is keyboard operable", () => {
  test("preview canvas is focusable and arrow keys rotate the model", async ({ page }) => {
    test.setTimeout(120000);

    const canvas = await makeMobAndOpenEditor(page);

    // The viewer sits in normal tab order (a positive tabindex would be a focus
    // order anti-pattern).
    await expect(canvas).toHaveAttribute("tabindex", "0");

    // Let the (static) scene finish its first render.
    await page.waitForTimeout(2500);

    // Reachable by keyboard.
    await canvas.focus();
    await expect(canvas).toBeFocused();

    const before = await canvas.screenshot();

    // Arrow keys must rotate the model.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(500);

    const after = await canvas.screenshot();

    expect(
      Buffer.compare(before, after),
      "pressing ArrowRight on the focused preview canvas must rotate the model (canvas pixels must change)"
    ).not.toBe(0);
  });
});
