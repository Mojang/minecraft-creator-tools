/**
 * Device folder picking on the home page: one native dialog at a time, and
 * honest guidance where the browser has no directory picker.
 *
 * Chromium will not open a second `showDirectoryPicker` while one is up; the
 * rejection ("NotAllowedError: File picker already active") used to escape a
 * double-activated button handler as an unhandled promise rejection and land
 * in the global error overlay (public issues #146, #144, #132). Firefox,
 * Safari and the Android / iOS browsers have no directory picker at all, so a
 * folder button there either did nothing or promised an API the device does
 * not have (public issue #100).
 *
 * Playwright cannot drive the real native dialog, so the first test replaces
 * `window.showDirectoryPicker` with a stub that stays open until the test
 * settles it, which is the behaviour of the real one while the user is looking
 * at the dialog. The second test removes the API before the app loads, which
 * is what a browser without File System Access looks like to the app.
 *
 * Run (from app/):
 *   npx playwright test DirectoryPickerFeedback.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";
import { clickTemplateCreateButton, getTemplateCard } from "./WebTestUtilities";

declare global {
  interface Window {
    __pickerCalls: number;
    __settlePicker?: { resolve: (handle: unknown) => void; reject: (error: unknown) => void };
  }
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function gotoHome(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 45000 });
}

test.describe("Directory picker feedback @full", () => {
  test("repeated activation opens a single picker and cancelling it shows no error", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = collectPageErrors(page);

    await page.addInitScript(() => {
      window.__pickerCalls = 0;
      Object.defineProperty(window, "showDirectoryPicker", {
        configurable: true,
        writable: true,
        value: () => {
          window.__pickerCalls++;
          return new Promise((resolve, reject) => {
            window.__settlePicker = { resolve, reject };
          });
        },
      });
    });

    await gotoHome(page);

    const openFolder = page.getByRole("button", { name: /open a folder on this device/i });
    await expect(openFolder).toBeVisible({ timeout: 30000 });

    // Two activations while the dialog is "open": a double click, or Enter
    // followed by a click. Only the first may reach the browser.
    await openFolder.dispatchEvent("click");
    await openFolder.dispatchEvent("click");
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => window.__pickerCalls)).toBe(1);

    // The user closes the dialog.
    await page.evaluate(() => {
      window.__settlePicker!.reject(new DOMException("The user aborted a request.", "AbortError"));
    });
    await page.waitForTimeout(500);

    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(pageErrors).toEqual([]);

    // Once the dialog is closed, the button opens a new one.
    await openFolder.dispatchEvent("click");
    await expect.poll(() => page.evaluate(() => window.__pickerCalls)).toBe(2);
    await page.evaluate(() => {
      window.__settlePicker!.reject(new DOMException("The user aborted a request.", "AbortError"));
    });
    await page.waitForTimeout(300);
    expect(pageErrors).toEqual([]);
  });

  test("a browser without a directory picker gets guidance and the file import path", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = collectPageErrors(page);

    await page.addInitScript(() => {
      Object.defineProperty(window, "showDirectoryPicker", { configurable: true, writable: true, value: undefined });
    });

    await gotoHome(page);

    // Choose Files (and drag and drop) remain the import path; no folder
    // button is offered, and the hint says why and what to do instead.
    await expect(page.getByRole("button", { name: /choose files/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: /open a folder on this device/i })).toHaveCount(0);

    const hint = page.getByTestId("folder-picker-unsupported-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(/choose files/i);
    await expect(hint).toContainText(/chrome or edge/i);

    // The footer already tells the user that storage is browser-only.
    await expect(page.getByText(/only be stored in this browser/i)).toBeVisible();

    // The new-project dialog does not offer "Save to My Computer" as a live
    // option; it explains why and leaves browser storage selected. The
    // template gallery loads after the panels above it, so wait for its card.
    await page.waitForLoadState("networkidle");
    await getTemplateCard(page, "addonStarter").waitFor({ state: "visible", timeout: 30000 });
    const opened = await clickTemplateCreateButton(page, "addonStarter");
    expect(opened, "should open the New Project dialog").toBe(true);

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const deviceRadio = dialog.getByRole("radio", { name: /save to my computer/i });
    await expect(deviceRadio).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: /this browser only/i })).toBeChecked();
    await expect(dialog.getByTestId("storage-device-unavailable")).toContainText(/chrome or edge/i);
    await expect(dialog.getByRole("button", { name: /choose folder/i })).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
