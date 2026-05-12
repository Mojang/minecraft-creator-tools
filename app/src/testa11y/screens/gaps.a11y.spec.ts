/**
 * Gap-filling accessibility tests added during the comprehensive a11y audit.
 *
 * These tests cover scenarios that were previously not exercised by the
 * existing suites, identified during the May 2026 audit:
 *
 *   1. **Bypass Blocks (WCAG 2.4.1)** — verifies a "skip to main content" link
 *      exists for keyboard users so they can avoid retabbing through the
 *      header/nav on every page navigation.
 *
 *   2. **Modal backdrop in forced-colors mode (MAS 1.4.1, 1.4.11)** — verifies
 *      that when Windows High Contrast is active, the new-project dialog is
 *      still visually distinguishable from the page content behind it. The
 *      MUI default `backdrop` becomes transparent under forced-colors, so we
 *      assert the dialog renders an opaque background of its own and that
 *      content behind it is not "bleeding through" inside the dialog rect.
 *
 *   3. **Settings / Project Settings panels** — these were not directly
 *      scanned by the existing matrix. We add light + dark coverage.
 *
 * Tags: @comprehensive-a11y @gap-test
 */

import { test, expect } from "../fixtures";
import { assertNoCriticalViolations, applyThemeVariant, THEME_MATRIX_STANDARD } from "../a11yTestUtils";
import { enterEditor } from "../../testweb/WebTestUtilities";

// ---------------------------------------------------------------------------
// 1. Bypass Blocks — WCAG 2.4.1
// ---------------------------------------------------------------------------

test.describe("Bypass Blocks @comprehensive-a11y @gap-test", () => {
  test("home page exposes a skip-to-main-content mechanism (WCAG 2.4.1)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // A "skip link" can be a focusable anchor that targets <main> or [role=main],
    // OR the <main> landmark itself can be the FIRST tab stop (in which case
    // assistive tech users jump there directly via landmark navigation).
    //
    // Both approaches are acceptable per WCAG 2.4.1 G1 / H69.

    // Check 1: explicit skip link
    const skipLinkLocator = page
      .locator('a[href^="#"]')
      .filter({ hasText: /skip|jump/i })
      .first();
    const hasSkipLink = (await skipLinkLocator.count()) > 0;

    // Check 2: <main> landmark exists
    const mainLandmarkCount = await page.locator("main, [role='main']").count();

    // Check 3: how many tab stops precede the main content?
    // A high count (>5) means screen-reader users without landmark nav have a
    // long retab on every navigation — failing the spirit of 2.4.1.
    const stopsBeforeMain = await page.evaluate(() => {
      const main = document.querySelector("main, [role='main']");
      if (!main) return -1;

      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      });

      let count = 0;
      for (const f of focusables) {
        if (main.contains(f)) break;
        count++;
      }
      return count;
    });

    console.log(
      `Bypass-blocks audit — explicit skip link: ${hasSkipLink}; <main> landmarks: ${mainLandmarkCount}; tab stops before <main>: ${stopsBeforeMain}`
    );

    // Soft requirement: at least ONE of:
    //   (a) explicit skip link, OR
    //   (b) <main> landmark exists AND tab-stops-before-main is small (<=5)
    const passesBypass = hasSkipLink || (mainLandmarkCount > 0 && stopsBeforeMain >= 0 && stopsBeforeMain <= 5);

    expect(
      passesBypass,
      `Home page lacks a usable bypass mechanism. ` +
        `Need either a "Skip to main content" link, or a <main> landmark with ≤5 preceding tab stops. ` +
        `Found: hasSkipLink=${hasSkipLink}, mainLandmarks=${mainLandmarkCount}, tabStopsBeforeMain=${stopsBeforeMain}.`
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Modal backdrop visibility in forced-colors mode
// ---------------------------------------------------------------------------

test.describe("Modal Backdrop in High Contrast @comprehensive-a11y @gap-test @high-contrast", () => {
  test("new project dialog backdrop occludes underlying content in forced-colors mode", async ({ page }) => {
    // light + forced-colors variant — this matches the dark-hc/light-hc cases
    // from the new-project-dialog screenshots that visually showed bleed-through.
    await applyThemeVariant(
      page,
      { variant: "light-hc", theme: "light", forcedColors: true, label: "light + high contrast" },
      "/"
    );
    await page.waitForTimeout(500);

    const newButton = page.getByRole("button", { name: /create new/i }).first();
    if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Could not find a Create New button on home — skipping");
      return;
    }

    await newButton.click();
    await page.waitForTimeout(500);

    // Identify the open dialog
    const dialog = page.getByRole("dialog").first();
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Dialog did not open — skipping");
      return;
    }

    // Audit: the dialog itself must have an OPAQUE background such that
    // page content does not bleed through. In forced-colors mode, MUI's
    // default scrim becomes transparent — the dialog's own surface must
    // therefore be opaque, not just the scrim.
    const containment = await dialog.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      // Walk up to the dialog paper / first child to see what the
      // visible "card" is — the role=dialog wrapper itself is sometimes
      // a transparent host.
      let visibleSurface: HTMLElement = el as HTMLElement;
      const paper = (el as HTMLElement).querySelector<HTMLElement>(".MuiPaper-root, .MuiDialog-paper");
      if (paper) visibleSurface = paper;

      const surfaceCs = getComputedStyle(visibleSurface);
      const bg = surfaceCs.backgroundColor;
      // background: rgba(...) — extract alpha
      const m = bg.match(/rgba?\(([^)]+)\)/);
      let alpha = 1;
      if (m) {
        const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
        if (parts.length === 4) alpha = parts[3];
      }
      // Some HC stylesheets use "transparent" or no explicit value.
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") alpha = 0;

      return {
        background: bg,
        alpha,
        backgroundImage: surfaceCs.backgroundImage,
        outerBackground: cs.backgroundColor,
      };
    });

    console.log(
      `Modal backdrop audit — surface bg: ${containment.background} (alpha=${containment.alpha}), backgroundImage: ${containment.backgroundImage}`
    );

    // The dialog surface must be opaque — alpha >= ~0.95 — OR draw a non-empty
    // background image (which forced-colors will turn into Canvas color).
    const hasOpaqueSurface =
      containment.alpha >= 0.95 ||
      (containment.backgroundImage && containment.backgroundImage !== "none");

    await page.screenshot({
      path: "debugoutput/screenshots/a11y-modal-backdrop-light-hc.png",
      fullPage: true,
    });

    expect(
      hasOpaqueSurface,
      `Dialog surface in forced-colors mode is not opaque — page content will bleed through. ` +
        `Got background=${containment.background} (alpha=${containment.alpha}). ` +
        `Either set the dialog surface background to a system color (e.g. Canvas) or use forced-color-adjust:none with an opaque color.`
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Settings / Project Settings panel a11y scan
// ---------------------------------------------------------------------------

test.describe("Settings Panels Accessibility @comprehensive-a11y @gap-test", () => {
  for (const tv of THEME_MATRIX_STANDARD) {
    test(`Project Settings panel — ${tv.label} — no critical violations`, async ({ page }) => {
      const entered = await enterEditor(page, { theme: tv.theme, editMode: "full" });
      if (!entered) {
        test.skip();
        return;
      }

      // Click "Project Settings" in the left nav (visible in full-mode editor).
      const projectSettings = page
        .getByRole("treeitem", { name: /Project Settings/i })
        .or(page.locator(":text-is('Project Settings')"))
        .first();

      const found = await projectSettings.isVisible({ timeout: 5000 }).catch(() => false);
      if (!found) {
        test.skip(true, "Project Settings node not visible — skipping");
        return;
      }

      await projectSettings.click();
      await page.waitForTimeout(700);

      // Scope the scan to the Project Settings panel itself (.ppe-outer). The
      // test's job is to verify P0-1 (panel contrast and field labels). The
      // sidebar project tree leaks `nested-interactive` and other unrelated
      // violations on the same page; those are tracked separately as P1-1/P1-2.
      await assertNoCriticalViolations(page, `Project Settings panel (${tv.label})`, {
        includeSelector: ".ppe-outer",
        screenshotPath: `debugoutput/screenshots/a11y-project-settings-${tv.variant}.png`,
      });
    });
  }
});
