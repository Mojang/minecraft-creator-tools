/**
 * Home-page action controls rendered via the shared TextButton — "See more
 * templates" and "See more snippets" — must be reachable and operable by
 * keyboard (WCAG 2.1.1).
 *
 * A href-less MUI Link renders an <a> with no href attribute, which browsers
 * leave out of the tab order, so the control worked with a mouse only. The fix
 * exposes it as a focusable button (role + tab stop + Enter/Space activation).
 */

import { test, expect } from "@playwright/test";

test.describe("Home action links are keyboard accessible", () => {
  test('"See more templates" is a focusable button in the tab order', async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);

    const seeMore = page.getByRole("button", { name: /see more templates/i });
    await expect(seeMore).toBeVisible({ timeout: 20000 });

    // Reachable by keyboard (focusable / in the tab order).
    await seeMore.focus();
    await expect(seeMore).toBeFocused();

    // Operable by keyboard: pressing Enter runs the action, loading more
    // template cards into the grid.
    const createButtons = page.getByRole("button", { name: /create new/i });
    const before = await createButtons.count();
    await page.keyboard.press("Enter");
    await expect.poll(async () => createButtons.count(), { timeout: 20000 }).toBeGreaterThan(before);
  });

  test('"See more snippets" is a focusable button after expanding advanced tools', async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);

    await page
      .getByRole("button", { name: /show (optional )?advanced tools/i })
      .first()
      .click();

    const seeMore = page.getByRole("button", { name: /see more snippets/i });
    await expect(seeMore).toBeVisible({ timeout: 20000 });

    await seeMore.focus();
    await expect(seeMore).toBeFocused();
  });
});
