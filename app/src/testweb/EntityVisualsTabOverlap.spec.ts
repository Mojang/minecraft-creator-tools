/**
 * Entity Visuals Tab Overlap Regression Test
 *
 * Repro for the "Entity Type Visuals — Textures / Geometry / Materials tabs
 * render overlapping headers" bug.
 *
 * Steps (matching the user's bug repro):
 *   1. Open Add-On Starter project.
 *   2. + Add → Mob from Minecraft → select "cat" → Add.
 *   3. Cat opens in the entity editor; click the Visuals tab.
 *   4. For each sub-tab (Textures / Geometry / Materials), screenshot the
 *      EntityTypeResourceEditor area and assert:
 *        - the rcHeader (".etre-rc-header") text appears exactly once,
 *        - the inline RenderControllerSetEditor (".rencoe-inline") top edge
 *          is at or below the rcHeader bottom edge (no vertical overlap),
 *        - the standalone resource form (".etre-form") bottom edge is
 *          at or above the rcHeader top edge.
 *
 * Run with:
 *   cd app
 *   npx playwright test EntityVisualsTabOverlap --project=chromium
 */

import { test, expect, ConsoleMessage, Page, Locator } from "@playwright/test";
import { processMessage, enterEditor, selectEditMode } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/entity-visuals-overlap";

test.setTimeout(180000);

async function openContentWizard(page: Page): Promise<boolean> {
  const addButton = page.locator('button[aria-label="Add new content"], button:has-text("Add")').first();
  if (!(await addButton.isVisible({ timeout: 3000 }))) return false;
  await addButton.click();
  await page.waitForTimeout(800);
  const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  if (await wizardDialog.isVisible({ timeout: 3000 })) return true;
  const muiDialog = page.locator(".MuiDialog-root").first();
  return muiDialog.isVisible({ timeout: 2000 });
}

async function clickMobFromMinecraft(page: Page): Promise<boolean> {
  // Use the GUIDED "New Mob" wizard (wizard-new-mob), not "Start from a Minecraft Mob".
  // The guided wizard produces a fully custom mob with its OWN render_controllers.json
  // child item, which is what populates renderControllerSets in the resource editor.
  // The vanilla-clone path (wizard-mob-from-mc) reuses vanilla render controllers and
  // therefore does not trigger the rcHeader / inline RenderControllerSetEditor layout.
  const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
  if (await newMob.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newMob.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

/**
 * Step through the guided New-Mob wizard accepting defaults at each step.
 * Entity wizard = 4 steps (Traits, Name, Stats, Appearance), so we click the
 * primary footer button (Next x3, then Create) 4 times in total.
 */
async function completeGuidedMobWizard(page: Page): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const primary = page.locator(".cwiz-btn-primary").first();
    if (!(await primary.isVisible({ timeout: 4000 }).catch(() => false))) {
      console.log(`completeGuidedMobWizard: primary button not visible at step ${i + 1}`);
      return false;
    }
    await primary.click();
    await page.waitForTimeout(700);
  }
  // Allow project save / item materialization
  await page.waitForTimeout(2500);
  return true;
}

async function clickEntityVisualsTab(page: Page): Promise<void> {
  const eteArea = page.locator(".ete-area");
  await expect(eteArea).toBeVisible({ timeout: 10000 });
  const visualsBtn = page.locator(`button[title*="visuals" i]:not([aria-haspopup])`).first();
  await expect(visualsBtn).toBeVisible({ timeout: 5000 });
  await visualsBtn.click();
  await page.waitForTimeout(1500);

  // The Visuals tab can race with EntityType resource-item resolution and render
  // "Unexpected error: No Valid State Found" if the resource childItem or its
  // primaryFile isn't loaded yet. When that happens, briefly switch to Overview
  // and back to force the editor to re-resolve. Retry a few times.
  for (let i = 0; i < 4; i++) {
    const etreArea = page.locator(".etre-area");
    if (await etreArea.isVisible({ timeout: 1500 }).catch(() => false)) {
      return;
    }
    const errorMsg = page.locator("text=/No Valid State Found/i").first();
    const errorVisible = await errorMsg.isVisible({ timeout: 500 }).catch(() => false);
    console.log(
      `clickEntityVisualsTab: .etre-area not visible (attempt ${i + 1}/4)${errorVisible ? " — saw 'No Valid State Found' error" : ""}`
    );
    const overviewBtn = page.locator(`button[title*="overview" i]:not([aria-haspopup])`).first();
    if (await overviewBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await overviewBtn.click();
      await page.waitForTimeout(800);
    }
    await visualsBtn.click();
    await page.waitForTimeout(2000);
  }
}

async function clickResourceSubTab(page: Page, name: "Textures" | "Geometry" | "Materials"): Promise<void> {
  const etreArea = page.locator(".etre-area");
  await expect(etreArea).toBeVisible({ timeout: 20000 });
  const titleKey = name === "Textures" ? /textur/i : name === "Geometry" ? /geometr|model/i : /material/i;
  // Tabs have a `title` tooltip (and text label that may be hidden in compact mode).
  let btn = etreArea.locator(`.etre-toolBarArea button[title]`).filter({ has: page.locator("*") });
  const count = await btn.count();
  for (let i = 0; i < count; i++) {
    const b = btn.nth(i);
    const title = (await b.getAttribute("title")) || "";
    if (titleKey.test(title)) {
      await b.click();
      await page.waitForTimeout(1500);
      return;
    }
  }
  // Fallback by inner text.
  const byText = etreArea
    .locator("button")
    .filter({ hasText: new RegExp(`^${name}$`, "i") })
    .first();
  await expect(byText).toBeVisible({ timeout: 5000 });
  await byText.click();
  await page.waitForTimeout(1500);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function bbox(loc: Locator): Promise<Box | null> {
  return (await loc.boundingBox()) as Box | null;
}

test.describe("Entity Visuals Resource Tabs - Overlap Regression", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  for (const sub of ["Textures", "Geometry", "Materials"] as const) {
    test(`${sub} tab — rcHeader does not overlap resource form or inline editor`, async ({ page }) => {
      const entered = await enterEditor(page);
      expect(entered).toBe(true);
      await page.waitForTimeout(1000);

      // The Textures/Geometry/Materials sub-tab strip only renders when edit
      // preference is NOT summarized (i.e. Full or Raw, not Focused). Switch
      // to Full mode so the sub-tabs are present.
      await selectEditMode(page, "full");
      await page.waitForTimeout(800);

      expect(await openContentWizard(page)).toBe(true);
      expect(await clickMobFromMinecraft(page)).toBe(true);
      expect(await completeGuidedMobWizard(page)).toBe(true);
      // Skip the gallery+confirm path — the guided wizard creates the mob directly.
      await page.waitForTimeout(2000);

      const eteArea = page.locator(".ete-area");
      if (!(await eteArea.isVisible({ timeout: 5000 }).catch(() => false))) {
        // Try to click any "mob" sidebar item that's not "main"/"Dashboard".
        const mobItem = page.locator('.pil-outer:has-text("mob"), .pit-name:has-text("mob")').first();
        if (await mobItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await mobItem.click();
          await page.waitForTimeout(2000);
        }
      }

      await clickEntityVisualsTab(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${sub.toLowerCase()}-00-after-visuals.png`,
        fullPage: true,
      });
      await clickResourceSubTab(page, sub);
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${sub.toLowerCase()}-fullpage.png`,
        fullPage: true,
      });

      const etreArea = page.locator(".etre-area");
      await etreArea.screenshot({
        path: `${SCREENSHOT_DIR}/${sub.toLowerCase()}-etre.png`,
      });

      // ── Assertions ──────────────────────────────────────────────────────
      const rcHeader = page.locator(".etre-rc-header");
      const rcCount = await rcHeader.count();
      expect(rcCount, "exactly one render-controller header expected").toBe(1);
      await expect(rcHeader).toBeVisible();

      const rcText = (await rcHeader.innerText()).trim();
      const expectedToken =
        sub === "Textures"
          ? /Texture render controllers/i
          : sub === "Geometry"
            ? /Geometry render controllers/i
            : /Materials render controllers/i;
      expect(rcText).toMatch(expectedToken);

      const rcBox = await bbox(rcHeader);
      expect(rcBox, "rcHeader bounding box").not.toBeNull();

      // The standalone resource form (etre-form) must occupy real vertical
      // space — when it collapses (flex 1 1 auto with min-height 0 next to a
      // sibling that forces viewport height) the DataForm content overflows
      // visually and paints on top of the rcHeader. A height < 40px means
      // collapse has happened.
      const etreForm = page.locator(".etre-form");
      const formBox = await bbox(etreForm);
      expect(formBox, "etre-form bounding box").not.toBeNull();
      if (formBox) {
        expect(
          formBox.height,
          `etre-form height (${formBox.height.toFixed(1)}) must be > 40px — collapse indicates layout bug`
        ).toBeGreaterThan(40);
      }

      // etre-form must sit ABOVE the rcHeader in screen space.
      if (formBox && rcBox) {
        const formBottom = formBox.y + formBox.height;
        expect(
          formBottom,
          `etre-form bottom (${formBottom.toFixed(1)}) must be <= rcHeader top (${rcBox.y.toFixed(1)})`
        ).toBeLessThanOrEqual(rcBox.y + 2);
      }

      // The inline RenderControllerSetEditor must sit BELOW the rcHeader.
      const rencoe = page.locator(".rencoe-inline").first();
      if (await rencoe.isVisible({ timeout: 3000 }).catch(() => false)) {
        const rBox = await bbox(rencoe);
        if (rBox && rcBox) {
          const rcBottom = rcBox.y + rcBox.height;
          expect(
            rBox.y,
            `rencoe-inline top (${rBox.y.toFixed(1)}) must be >= rcHeader bottom (${rcBottom.toFixed(1)})`
          ).toBeGreaterThanOrEqual(rcBottom - 2);
        }
      }
    });
  }
});
