/**
 * Focused MUI input-label contrast (WCAG 1.4.3).
 *
 * MUI paints a focused outlined-TextField's floating label with the theme primary
 * color (the brand green4 #52a535), which is only ~3.09:1 on the light field — and
 * ~3.08:1 on the dark dialog. A focused input label is regular text, so it must use a
 * contrast-safe accent instead of the mid-tone brand green.
 *
 * This is a theme-level issue (every labeled MUI TextField is affected). It's reached
 * here via the File Map → a file's "File actions" menu → Rename dialog, whose "Name"
 * field auto-focuses, so its label renders in the focused (primary) color on open.
 *
 * Run: npx playwright test InputLabelContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`Focused MUI input label meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);

    // Measure settled colors, not mid-transition (the label color animates on focus).
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Switch to the File Map (file list), where each file exposes an actions menu.
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    await expect(viewButton).toBeVisible({ timeout: 10000 });
    await viewButton.click();
    const filesItem = page.locator("text=Show list as files").first();
    await expect(filesItem).toBeVisible({ timeout: 5000 });
    await filesItem.click();
    await page.waitForTimeout(1000);

    // Open a file's "File actions" menu and choose Rename. The rename dialog's Name
    // field auto-focuses, so its floating label is in the focused (primary-colored)
    // state we need to measure.
    const actionsBtn = page.locator('button[aria-label="File actions"]').first();
    await actionsBtn.scrollIntoViewIfNeeded();
    await actionsBtn.click({ force: true });

    const renameItem = page.locator('[role="menuitem"]:has-text("Rename")').first();
    await expect(renameItem).toBeVisible({ timeout: 5000 });
    await renameItem.click();

    // Focus the Name field so its floating label renders in the focused (primary) color.
    const nameInput = page.locator('input[aria-label="File name (without extension)"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.click();

    const focusedLabel = page.locator(".MuiInputLabel-root.Mui-focused").first();
    await expect(focusedLabel).toBeVisible({ timeout: 5000 });

    const ratios = await getRenderedContrast(page, ".MuiInputLabel-root.Mui-focused");
    expect(ratios.length, "expected a focused input label").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(r, `focused label contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
        MIN_CONTRAST
      );
    }
  });
}
