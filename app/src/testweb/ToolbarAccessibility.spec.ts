/**
 * Toolbar accessibility regression tests.
 *
 * Covers two related concerns the inbound UX review flagged:
 *   A1 — Icon-only toolbar buttons (especially in mobile/compact mode) must
 *        carry an accessible name (`aria-label`, `title`, or visible text).
 *        A bug in ProjectEditor.tsx was setting `title=""` on the export button
 *        when `isButtonCompact` was true, which stripped the aria-label and
 *        produced an unlabelled button on small viewports.
 *   A3 — Every interactive toolbar button must show a visible focus indicator
 *        when reached via keyboard navigation. The global `:focus-visible`
 *        rule in `index.css` paints a 2px green outline on `.MuiButtonBase-root.Mui-focusVisible`.
 *        This test programmatically focuses every toolbar button and asserts
 *        the indicator is present and non-zero width.
 *
 * The test runs against the editor in two viewports — desktop (1280x720) and
 * mobile (390x844, iPhone 12) — because compactness changes button rendering
 * in ProjectEditor.tsx and we want both code paths covered.
 */

import { test, expect, Page } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

const DIR = "debugoutput/screenshots/toolbar-a11y";

async function captureFocusedButton(page: Page, fileLabel: string) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${DIR}/${fileLabel}.png`, fullPage: false });
}

/**
 * Walk every IconButton/Button inside the toolbar and check that:
 *  - it has an accessible name (aria-label, title, or visible text)
 *  - when focused via keyboard, it shows a visible focus outline
 */
async function auditToolbar(page: Page, viewportLabel: string) {
  const toolbar = page.locator('[role="toolbar"]').first();
  await expect(toolbar).toBeVisible({ timeout: 10000 });

  const allButtons = toolbar.locator("button");
  const count = await allButtons.count();
  expect(count, `${viewportLabel}: toolbar has at least one button`).toBeGreaterThan(0);

  const missingNames: { index: number; html: string }[] = [];
  const missingFocusRings: { index: number; name: string }[] = [];

  for (let i = 0; i < count; i++) {
    const btn = allButtons.nth(i);

    // Skip if not visible (e.g. hidden by overflow-collapse measurement).
    const isVisible = await btn.isVisible();
    if (!isVisible) continue;

    const accessibleName = await btn.evaluate((el) => {
      const html = el as HTMLElement;
      const ariaLabel = html.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
      const ariaLabelledBy = html.getAttribute("aria-labelledby");
      if (ariaLabelledBy) {
        const target = document.getElementById(ariaLabelledBy);
        if (target?.textContent?.trim()) return target.textContent.trim();
      }
      const title = html.getAttribute("title");
      if (title && title.trim()) return title.trim();
      const text = html.textContent?.trim() || "";
      return text;
    });

    if (!accessibleName) {
      const html = await btn.evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 200));
      missingNames.push({ index: i, html });
      continue;
    }

    // Focus the button and verify a visible focus indicator is applied.
    // We rely on the global :focus-visible rule (index.css) which sets
    // outline: 2px solid #52a535 on .MuiButtonBase-root.Mui-focusVisible.
    await btn.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
    // Force focus-visible state since programmatic .focus() doesn't always
    // trigger :focus-visible in Chromium. We dispatch a keydown to flip the
    // browser's heuristic into "keyboard focus" mode.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await btn.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));

    const focusInfo = await btn.evaluate((el) => {
      const html = el as HTMLElement;
      const cs = getComputedStyle(html);
      return {
        outlineWidth: cs.outlineWidth,
        outlineStyle: cs.outlineStyle,
        outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow,
        focused: html === document.activeElement,
      };
    });

    // A button has a focus indicator if EITHER it has a visible outline
    // OR a non-empty box-shadow that's not "none".
    const hasOutline =
      focusInfo.outlineStyle !== "none" &&
      focusInfo.outlineWidth !== "0px" &&
      focusInfo.outlineWidth !== "";
    const hasBoxShadow = focusInfo.boxShadow && focusInfo.boxShadow !== "none";
    const hasFocusIndicator = hasOutline || hasBoxShadow;

    if (focusInfo.focused && !hasFocusIndicator) {
      missingFocusRings.push({ index: i, name: accessibleName });
    }
  }

  if (missingNames.length > 0) {
    console.log(`${viewportLabel} - missing accessible names:`, JSON.stringify(missingNames, null, 2));
  }
  if (missingFocusRings.length > 0) {
    console.log(`${viewportLabel} - missing focus indicators:`, JSON.stringify(missingFocusRings, null, 2));
  }

  expect(missingNames, `${viewportLabel}: every visible toolbar button must have an accessible name`).toEqual([]);
  expect(
    missingFocusRings,
    `${viewportLabel}: every focusable toolbar button must show a focus indicator on keyboard focus`
  ).toEqual([]);
}

test.describe("Toolbar accessibility @focused", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => processMessage(msg, page, [], []));
  });

  test("desktop toolbar buttons are labelled and show focus rings", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    test.skip(!ok, "Could not enter editor");
    await page.waitForTimeout(1500);
    await auditToolbar(page, "desktop");
    await captureFocusedButton(page, "01-desktop-toolbar-final-focus");
  });

  test("mobile toolbar buttons are labelled and show focus rings", async ({ page }) => {
    // 390x844 = iPhone 12 viewport — triggers isButtonCompact path in ProjectEditor.
    await page.setViewportSize({ width: 390, height: 844 });
    const ok = await enterEditor(page, { theme: "dark", editMode: "focused" });
    test.skip(!ok, "Could not enter editor");
    await page.waitForTimeout(1500);
    await auditToolbar(page, "mobile");
    await captureFocusedButton(page, "02-mobile-toolbar-final-focus");
  });
});
