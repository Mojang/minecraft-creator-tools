/**
 * SettingsAndProjectSettings.spec.ts
 *
 * Captures screenshots of the Settings dialog (toolbar gear) and the
 * Project Settings page (left-sidebar entry) in Focused Mode, plus
 * the "Check for Problems" / Inspector view that is hidden in Focused
 * but reachable in Full Mode.
 *
 * These three surfaces had no screenshot coverage in the @focused suite
 * but every user encounters them when configuring a project, validating
 * content, or changing app preferences. Added during the focused UX
 * review in run20260506 to fill that gap.
 */

import { test, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, ensureFullMode, processMessage } from "./WebTestUtilities";

const DIR = "debugoutput/screenshots/settings-and-project-settings";

async function fullPageShot(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

async function viewportShot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

test.describe("Settings and Project Settings @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("01 settings dialog - dark", async ({ page }) => {
    const ok = await enterEditor(page, "dark");
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }

    // Click the toolbar Settings button (gear icon, label "Settings")
    const settingsBtn = page
      .getByRole("button", { name: /^Settings$/i })
      .first();
    if (!(await settingsBtn.isVisible({ timeout: 4000 }).catch(() => false))) {
      // fall back to finding any element labeled "Settings" in the toolbar
      const altSettings = page.locator('[aria-label="Settings"]').first();
      if (await altSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altSettings.click();
      } else {
        test.skip(true, "Settings button not found");
        return;
      }
    } else {
      await settingsBtn.click();
    }
    await page.waitForTimeout(800);
    await viewportShot(page, "01-settings-dialog-dark");
    await fullPageShot(page, "01-settings-dialog-dark-full");
  });

  test("02 settings dialog - light", async ({ page }) => {
    const ok = await enterEditor(page, "light");
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }

    const settingsBtn = page
      .getByRole("button", { name: /^Settings$/i })
      .first();
    if (!(await settingsBtn.isVisible({ timeout: 4000 }).catch(() => false))) {
      const altSettings = page.locator('[aria-label="Settings"]').first();
      if (!(await altSettings.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, "Settings button not found");
        return;
      }
      await altSettings.click();
    } else {
      await settingsBtn.click();
    }
    await page.waitForTimeout(800);
    await viewportShot(page, "02-settings-dialog-light");
  });

  test("03 project settings page - focused dark", async ({ page }) => {
    const ok = await enterEditor(page, "dark");
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }

    // The Project Settings entry is in the left sidebar in Focused Mode
    const projectSettings = page
      .locator("text=/^Project Settings$/")
      .first();
    if (!(await projectSettings.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, "Project Settings sidebar entry not found");
      return;
    }
    await projectSettings.click();
    await page.waitForTimeout(1000);
    await viewportShot(page, "03-project-settings-focused-dark");
    await fullPageShot(page, "03-project-settings-focused-dark-full");
  });

  test("04 project settings page - focused light", async ({ page }) => {
    const ok = await enterEditor(page, "light");
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }

    const projectSettings = page
      .locator("text=/^Project Settings$/")
      .first();
    if (!(await projectSettings.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, "Project Settings sidebar entry not found");
      return;
    }
    await projectSettings.click();
    await page.waitForTimeout(1000);
    await viewportShot(page, "04-project-settings-focused-light");
  });

  test("05 inspector check-for-problems - full mode", async ({ page }) => {
    // Inspector / Check for Problems is hidden in Focused. Switch to Full.
    const ok = await enterEditor(page, { theme: "dark", editMode: "full" });
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }
    await ensureFullMode(page);
    await page.waitForTimeout(500);

    const checkForProblems = page
      .locator("text=/^Check for Problems$/")
      .first();
    if (!(await checkForProblems.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, "Check for Problems not visible (expected in Full Mode)");
      return;
    }
    await checkForProblems.click();
    await page.waitForTimeout(1500);
    await viewportShot(page, "05-inspector-check-problems-dark");
    await fullPageShot(page, "05-inspector-check-problems-dark-full");
  });

  test("06 inspector check-for-problems - full mode light", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!ok) {
      test.skip(true, "Could not enter editor");
      return;
    }
    await ensureFullMode(page);
    await page.waitForTimeout(500);

    const checkForProblems = page
      .locator("text=/^Check for Problems$/")
      .first();
    if (!(await checkForProblems.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, "Check for Problems not visible (expected in Full Mode)");
      return;
    }
    await checkForProblems.click();
    await page.waitForTimeout(1500);
    await viewportShot(page, "06-inspector-check-problems-light");
  });

  test.afterEach(async () => {
    if (consoleErrors.length > 0) {
      console.log(
        `Console errors during settings/inspector capture: ${consoleErrors.length}`
      );
    }
  });
});
