/**
 * MUI contained-primary button contrast (WCAG 1.4.3).
 *
 * MUI fills `<Button variant="contained">` with the theme primary color (the brand
 * green4 #52a535) and white text, which is only 3.09:1 — failing for normal-size
 * button text. Primary action buttons must use a dark-enough green for white text.
 *
 * This is a theme-level issue (every contained primary button is affected). It's
 * reached here via a project-item category's "+" add button → the SetNameAndFolder
 * dialog, whose folder picker shows a plain MUI contained "Create" button. That
 * button is disabled (gray) until a folder name is typed, so the test fills the
 * field first to get the enabled (green) state.
 *
 * Run: npx playwright test ContainedButtonContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`MUI contained primary button meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme, editMode: "full" })).toBe(true);

    // Measure settled colors, not mid-transition (button background animates).
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Open a project-item category's add flow (the first "+" header button), which
    // shows the SetNameAndFolder dialog containing the green "Create" folder button.
    // The add button is revealed on header hover, so hover before clicking.
    const addBtn = page.locator("button.pil-headerAddButton").first();
    await page.locator(".pil-itemTypeHeader").first().hover();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // Type a folder name so the (otherwise disabled, gray) Create button becomes the
    // enabled green primary button.
    const newFolderInput = page.locator(".fex-newFolderName input").first();
    await expect(newFolderInput).toBeVisible({ timeout: 10000 });
    await newFolderInput.fill("test");

    const createBtn = page.locator(".fex-newFolderGo .MuiButton-contained").first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await page.mouse.move(0, 0);

    const ratios = await getRenderedContrast(page, ".fex-newFolderGo .MuiButton-contained");
    expect(ratios.length, "expected the Create button").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(r, `contained button contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
        MIN_CONTRAST
      );
    }
  });
}
