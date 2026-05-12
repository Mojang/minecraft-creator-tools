/**
 * InboundCreatorReview.spec.ts
 *
 * One-shot review spec that walks through the inbound-creator journey on
 * mctools.dev and captures screenshots at every notable step. Designed to
 * produce screenshots for a focused UX review — not for assertions.
 *
 * Captures (in both light and dark theme where reasonable):
 *  - Home page (above the fold + scrolled)
 *  - Template gallery interaction states
 *  - Project creation dialog
 *  - Editor (Focused) first-load state
 *  - Editor sidebar / file list
 *  - Add Content wizard
 *  - Validation / Inspector
 *  - Export / Share menu
 *  - Block viewer / Mob viewer (if reachable)
 *  - Mobile viewport (375x667)
 */

import { test, ConsoleMessage, Page } from "@playwright/test";
import {
  enterEditor,
  fillRequiredProjectDialogFields,
  gotoWithTheme,
  preferBrowserStorageInProjectDialog,
  processMessage,
} from "./WebTestUtilities";

const DIR = "debugoutput/screenshots/inbound-review";

async function fullPage(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

async function viewportShot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

test.describe("Inbound Creator Review @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("01 home page - dark", async ({ page }) => {
    await gotoWithTheme(page, "dark", "/");
    await page.waitForTimeout(2000);
    await viewportShot(page, "01-home-dark-fold");
    await fullPage(page, "01-home-dark-full");

    // capture the "see more templates" expansion if present
    const seeMore = page.locator('text="See more templates"').first();
    if (await seeMore.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeMore.click();
      await page.waitForTimeout(500);
      await fullPage(page, "01b-home-dark-all-templates");
    }
  });

  test("02 home page - light", async ({ page }) => {
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(2000);
    await viewportShot(page, "02-home-light-fold");
    await fullPage(page, "02-home-light-full");
  });

  test("03 home page - mobile dark", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await gotoWithTheme(page, "dark", "/");
    await page.waitForTimeout(2000);
    await viewportShot(page, "03-home-mobile-dark-fold");
    await fullPage(page, "03-home-mobile-dark-full");
  });

  test("04 home page - tablet light", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(2000);
    await viewportShot(page, "04-home-tablet-light-fold");
    await fullPage(page, "04-home-tablet-light-full");
  });

  test("05 project creation dialog", async ({ page }) => {
    await gotoWithTheme(page, "dark", "/");
    await page.waitForTimeout(1500);

    // Click Create New on the first template
    const createNew = page.getByRole("button", { name: "Create New" }).first();
    if (await createNew.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createNew.click();
      await page.waitForTimeout(1500);
      await viewportShot(page, "05a-project-dialog-fresh");

      // Show what storage choices look like
      const browserRadio = page.getByRole("radio", { name: /Browser|This Browser/i }).first();
      if (await browserRadio.isVisible({ timeout: 1500 }).catch(() => false)) {
        await fullPage(page, "05b-project-dialog-storage-options");
      }

      // Try to expose validation by clearing creator
      const creatorInput = page.locator('input[name="creator"]').first();
      if (await creatorInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await creatorInput.fill("");
        await page.waitForTimeout(300);
        await viewportShot(page, "05c-project-dialog-empty-creator");
      }

      // Now fill it correctly and screenshot the ready-to-go state
      await preferBrowserStorageInProjectDialog(page);
      await fillRequiredProjectDialogFields(page);
      await page.waitForTimeout(400);
      await viewportShot(page, "05d-project-dialog-filled");
    }
  });

  test("06 editor first load (Focused)", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) {
      await page.screenshot({ path: `${DIR}/06-editor-FAILED.png`, fullPage: true });
      return;
    }
    await page.waitForTimeout(2000);
    await viewportShot(page, "06a-editor-focused-dark");
    await fullPage(page, "06b-editor-focused-dark-full");

    // Try a light theme version in same editor
    // (re-entry needed because theme toggle in editor varies)
  });

  test("07 editor first load (Full mode)", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "full" });
    if (!ok) {
      await page.screenshot({ path: `${DIR}/07-editor-FAILED.png`, fullPage: true });
      return;
    }
    await page.waitForTimeout(2000);
    await viewportShot(page, "07a-editor-full-dark");
    await fullPage(page, "07b-editor-full-dark-full");
  });

  test("08 editor first load (Raw mode)", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "raw" });
    if (!ok) {
      await page.screenshot({ path: `${DIR}/08-editor-FAILED.png`, fullPage: true });
      return;
    }
    await page.waitForTimeout(2000);
    await viewportShot(page, "08a-editor-raw-dark");
    await fullPage(page, "08b-editor-raw-dark-full");
  });

  test("09 add content wizard from focused mode", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) {
      return;
    }
    await page.waitForTimeout(1500);

    const addBtn = page.locator('button[aria-label="Add new content"]').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await viewportShot(page, "09a-add-content-wizard");
      await fullPage(page, "09b-add-content-wizard-full");
    } else {
      await viewportShot(page, "09-add-button-MISSING");
    }
  });

  test("09L add content wizard - light theme", async ({ page }) => {
    // Light-mode capture for V2 contrast checks (GUIDED SETUP / EXAMPLE headings).
    const ok = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!ok) {
      return;
    }
    await page.waitForTimeout(1500);

    const addBtn = page.locator('button[aria-label="Add new content"]').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await viewportShot(page, "09La-add-content-wizard-light");
      await fullPage(page, "09Lb-add-content-wizard-light-full");
    } else {
      await viewportShot(page, "09L-add-button-MISSING");
    }
  });

  test("10 inspector / validation flow", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(1500);

    // Look for an Inspector button by aria-label or text
    const candidates = [
      page.getByRole("button", { name: /Inspector/i }).first(),
      page.locator('button[aria-label*="Inspector" i]').first(),
      page.locator('button[aria-label*="Validate" i]').first(),
      page.getByRole("button", { name: /Validate/i }).first(),
    ];
    let clicked = false;
    for (const b of candidates) {
      if (await b.isVisible({ timeout: 1500 }).catch(() => false)) {
        await b.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await viewportShot(page, "10-inspector-NOT-FOUND");
      return;
    }
    await page.waitForTimeout(2500);
    await viewportShot(page, "10a-inspector-results");
    await fullPage(page, "10b-inspector-results-full");
  });

  test("11 export / share menu", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(1500);

    const exportBtn = page.getByRole("button", { name: /^(Share|Export)( \(.+\))?$/i }).first();
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportBtn.click();
      await page.waitForTimeout(1200);
      await viewportShot(page, "11a-export-menu-open");
      await fullPage(page, "11b-export-menu-open-full");
    } else {
      await viewportShot(page, "11-export-button-MISSING");
    }
  });

  test("12 view / preview menu", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(1500);

    const viewBtn = page.getByRole("button", { name: /^View$/i }).first();
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(1200);
      await viewportShot(page, "12a-view-menu-open");
    } else {
      await viewportShot(page, "12-view-button-MISSING");
    }
  });

  test("13 editor light theme", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(2000);
    await viewportShot(page, "13a-editor-focused-light");
    await fullPage(page, "13b-editor-focused-light-full");
  });

  test("14 editor mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(2000);
    await viewportShot(page, "14a-editor-mobile");
    await fullPage(page, "14b-editor-mobile-full");
  });

  test("15 file open in focused mode", async ({ page }) => {
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!ok) return;
    await page.waitForTimeout(2000);

    // Try clicking the first item in the file list
    const firstFile = page.locator(".pil-outer button, .pil-outer [role=button]").first();
    if (await firstFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstFile.click();
      await page.waitForTimeout(2000);
      await viewportShot(page, "15a-first-file-open");
      await fullPage(page, "15b-first-file-open-full");
    }
  });

  test("16 home - direct route /docs", async ({ page }) => {
    await gotoWithTheme(page, "dark", "/docs");
    await page.waitForTimeout(2000);
    await fullPage(page, "16-docs-route");
  });

  test("17 home - direct route /create", async ({ page }) => {
    await gotoWithTheme(page, "dark", "/create");
    await page.waitForTimeout(2000);
    await fullPage(page, "17-create-route");
  });
});
