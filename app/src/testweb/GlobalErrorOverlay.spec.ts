import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the GlobalErrorOverlay surface.
 *
 * These tests trigger errors from the page context (window 'error' and
 * 'unhandledrejection') and verify the recoverable overlay appears, the
 * details expando works, and dismissing the overlay restores the page.
 *
 * The fatal/render-error path is intentionally not covered here because
 * forcing a render-time throw inside the running app requires patching a
 * component, which is out of scope for a smoke test.
 */
test.describe("Global Error Overlay @focused", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 45000 });
  });

  test("shows a dismissible dialog when an unhandled rejection occurs", async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.reject(new Error("playwright-test-async-boom"));
    });

    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/something went wrong/i).first()).toBeVisible();

    // Open the details expando.
    await page.getByRole("button", { name: /show details/i }).click();
    await expect(page.getByText(/playwright-test-async-boom/i).first()).toBeVisible();

    // Dismiss and confirm the dialog goes away.
    await page.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(dialog.first()).toBeHidden({ timeout: 5000 });
  });

  test("shows a dismissible dialog when a synchronous window error occurs", async ({ page }) => {
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("playwright-test-sync-boom");
      }, 0);
    });

    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /show details/i }).click();
    await expect(page.getByText(/playwright-test-sync-boom/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(dialog.first()).toBeHidden({ timeout: 5000 });
  });
});
