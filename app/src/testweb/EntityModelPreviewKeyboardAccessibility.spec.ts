/**
 * Keyboard accessibility for the entity Overview 3D model preview (WCAG 2.1.1,
 * 2.1.2, 2.4.7).
 *
 * The preview is an interactive Babylon canvas: it is a tab stop (arrow keys
 * rotate, +/- zoom) with a descriptive accessible name. It must not be wrapped in
 * a role="img" container — that treats the subtree as a single static image and
 * prunes the focusable canvas from the accessibility tree. It must also show a
 * focus ring while focused, and Tab / Shift+Tab must move focus OUT of it (the
 * canvas must not be a keyboard trap). This guards all of those.
 *
 * Run (from app/):
 *   npx playwright test EntityModelPreviewKeyboardAccessibility.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";
import { preferBrowserStorageInProjectDialog } from "./WebTestUtilities";

test.setTimeout(120000);

/** Create a mob locally via the home "Make a Mob" wizard and land on its editor. */
async function makeMobAndOpenOverview(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(500);

  const makeMob = page.getByRole("button", { name: /make a mob/i }).first();
  await expect(makeMob).toBeVisible({ timeout: 20000 });
  await makeMob.click();

  // Step through the wizard by clicking the primary button (Next … Create). The
  // fields are pre-filled, so each click advances; the final click creates the mob.
  const primary = page.locator(".cwiz-btn-primary");
  for (let i = 0; i < 8; i++) {
    if (
      await page
        .locator(".etop-modelViewer")
        .isVisible()
        .catch(() => false)
    ) {
      break;
    }
    await preferBrowserStorageInProjectDialog(page).catch(() => {});
    if (
      await primary
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await primary
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(700);
    } else {
      await page.waitForTimeout(700);
    }
  }

  await expect(page.locator(".etop-modelViewer")).toBeVisible({ timeout: 30000 });
}

test("entity overview model preview is a keyboard-reachable, AT-exposed control", async ({ page }) => {
  await makeMobAndOpenOverview(page);

  const info = await page.evaluate(() => {
    const wrapper = document.querySelector(".etop-modelViewer");
    if (!wrapper) return null;
    // The 3D preview is an interactive, keyboard-operable canvas. A wrapping
    // role="img" prunes its focusable canvas from the accessibility tree.
    return { wrapperRole: wrapper.getAttribute("role"), insideRoleImg: !!wrapper.closest('[role="img"]') };
  });
  expect(info, "model preview wrapper should exist").not.toBeNull();

  // The preview area must not be exposed as a single static image.
  expect(info!.wrapperRole, "model viewer wrapper must not be role=img").not.toBe("img");
  expect(info!.insideRoleImg, "model viewer must not be inside a role=img").toBe(false);

  // The Babylon canvas (rendered once the model loads) must be a focusable tab
  // stop with a descriptive accessible name.
  const canvas = page.locator('.etop-modelViewer [data-testid="mob-viewer-canvas"]');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('.etop-modelViewer [data-testid="mob-viewer-canvas"]') as HTMLElement | null;
    return c ? { tabindex: c.getAttribute("tabindex"), ariaLabel: c.getAttribute("aria-label") || "" } : null;
  });
  expect(canvasInfo!.tabindex, "model canvas must be a tab stop").toBe("0");
  expect(canvasInfo!.ariaLabel, "model canvas needs an accessible name").toMatch(/\S/);

  await canvas.focus();
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("data-testid") === "mob-viewer-canvas"
  );
  expect(focused, "model canvas should accept keyboard focus").toBe(true);

  // A focus ring must be visible while the canvas holds keyboard focus (WCAG 2.4.7).
  // The ring is drawn as a ::after overlay on the preview wrapper (a plain canvas
  // outline disappears against the 3D scene), shown via :focus-within.
  const ring = await page.evaluate(() => {
    const wrap = document.querySelector(".etop-modelViewer .ve-canvas-wrapper--preview");
    if (!wrap) return null;
    const cs = getComputedStyle(wrap, "::after");
    return { content: cs.content, border: `${cs.borderTopWidth} ${cs.borderTopStyle}` };
  });
  expect(ring, "preview canvas wrapper should exist").not.toBeNull();
  expect(ring!.content, "focus ring overlay must be generated while focused").not.toBe("none");
  expect(ring!.border, "focused preview must show a focus ring").toContain("solid");

  // Tab / Shift+Tab must move focus OUT of the canvas — it must not be a keyboard
  // trap (WCAG 2.1.2). Babylon's camera input is attached to the canvas, so this
  // guards the explicit focus-out handling.
  await canvas.focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "mob-viewer-canvas"),
    "Tab must move focus off the canvas"
  ).toBe(false);

  await canvas.focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "mob-viewer-canvas"),
    "Shift+Tab must move focus off the canvas"
  ).toBe(false);
});
