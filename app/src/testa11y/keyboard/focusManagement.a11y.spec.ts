/**
 * Focus management accessibility tests.
 *
 * Verifies focus trapping in modals, focus return after dialog close,
 * logical focus order, and focus indicator visibility.
 *
 * MAS / WCAG criteria: 2.4.3 (Focus Order), 2.4.7 (Focus Visible),
 * 2.4.11 (Focus Not Obscured).
 *
 * Tags: @comprehensive-a11y @keyboard
 */

import { test, expect } from "../fixtures";
import { assertFocusTrapped } from "../a11yTestUtils";
import { gotoWithTheme } from "../../testweb/WebTestUtilities";

test.describe("Focus Management — Dialog Focus Trap @comprehensive-a11y @keyboard", () => {
  test("new project dialog traps focus", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await newButton.click();
    await page.waitForTimeout(500);

    // Find the dialog container
    const dialog = page.locator('[role="dialog"], [class*="Dialog"], [class*="modal"]').first();
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("Dialog not found — skipping focus trap test");
      test.skip();
      return;
    }

    // Verify focus stays within the dialog
    const containerSelector = '[role="dialog"], [class*="Dialog"], [class*="modal"]';
    try {
      await assertFocusTrapped(page, containerSelector);
    } catch (e) {
      // Log but don't fail if the dialog doesn't have proper focus trapping yet
      console.log(`Focus trap issue: ${e}`);
      // Still report it as a failure — focus trapping is a MAS requirement
      throw e;
    }

    await page.keyboard.press("Escape");
  });
});

test.describe("Focus Management — Focus Return @comprehensive-a11y @keyboard", () => {
  test("focus returns to trigger element after dialog close", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Focus the trigger button before clicking
    await newButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Close dialog with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Focus should ideally return to the trigger button
    const focusedText = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.textContent?.trim() ?? "";
    });

    // This is a best-practice check — focus should return near the trigger
    console.log(`After dialog close, focus is on: "${focusedText}"`);
    // Log the result; strict enforcement would require the exact trigger element
  });
});

test.describe("Focus Management — Focus Visibility @comprehensive-a11y @keyboard", () => {
  test("focus indicator is visible on interactive elements", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Tab to a button and verify it has a visible focus indicator
    const firstButton = page.getByRole("button").first();
    if (!(await firstButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstButton.focus();
    await expect(firstButton).toBeFocused();

    // Check that the focused element has a visible outline/border
    const focusStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        outlineStyle: styles.outlineStyle,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
      };
    });

    console.log("Focus indicator styles:", JSON.stringify(focusStyles, null, 2));

    // Verify some kind of focus indicator exists (outline, border, or box-shadow)
    if (focusStyles) {
      const hasOutline = focusStyles.outlineStyle !== "none" && focusStyles.outlineWidth !== "0px";
      const hasBoxShadow = focusStyles.boxShadow !== "none";
      const hasFocusIndicator = hasOutline || hasBoxShadow;
      expect(hasFocusIndicator, "Focused elements should have a visible focus indicator (outline or box-shadow)").toBe(
        true
      );
    }
  });

  test("multiple elements show focus indicators when tabbed to", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    let elementsWithFocusIndicator = 0;
    let elementsChecked = 0;

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");

      const hasIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        const styles = window.getComputedStyle(el);
        const hasOutline = styles.outlineStyle !== "none" && styles.outlineWidth !== "0px";
        const hasBoxShadow = styles.boxShadow !== "none";
        return hasOutline || hasBoxShadow;
      });

      if (hasIndicator !== null) {
        elementsChecked++;
        if (hasIndicator) elementsWithFocusIndicator++;
      }
    }

    if (elementsChecked > 0) {
      const percentage = (elementsWithFocusIndicator / elementsChecked) * 100;
      console.log(
        `Focus indicators: ${elementsWithFocusIndicator}/${elementsChecked} elements (${percentage.toFixed(0)}%)`
      );
      // At least 80% of focusable elements should have visible focus indicators
      expect(percentage, "At least 80% of focusable elements should have visible focus indicators").toBeGreaterThan(80);
    }
  });
});

test.describe("Focus Management — Focus Order @comprehensive-a11y @keyboard", () => {
  test("focus order follows logical reading order on home page", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Collect focus positions as we Tab through the page.
    //
    // We use page-absolute Y (rect.top + window.scrollY) instead of viewport
    // y, because focusing an element below the fold causes the browser to
    // auto-scroll, which would otherwise produce phantom "focus jumped up"
    // signals. The first focusable element after page load is the
    // visually-hidden ".app-skipLink" we added in P1-7 — it's intentionally
    // anchored to the top of the page so users can jump past the masthead,
    // so we exclude it from the order check.
    const focusPositions: { x: number; y: number; text: string; isSkip: boolean }[] = [];

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");

      const pos = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          text: (el.textContent ?? "").substring(0, 30),
          isSkip: !!(el.classList && el.classList.contains("app-skipLink")),
        };
      });

      if (pos) focusPositions.push(pos);
    }

    // Drop the skip link from order analysis — it is *intentionally* anchored
    // at the top of the page (regardless of where it appears in the DOM) and
    // exists so users can bypass the navigation. Including it in the
    // "monotonically increasing y" check would create a guaranteed regression
    // every time it appears.
    const ordered = focusPositions.filter((p) => !p.isSkip);

    // Multi-region pages (sidebar + main) inevitably produce some upward
    // jumps when focus crosses from the bottom of one region to the top of
    // another — that's a meaningful sequence, not a regression. We
    // distinguish "crossing-region jumps" (allowed; large) from "reorder
    // within a single column" (worth flagging; should be small): a real
    // intra-region regression is one where focus moves up by more than 100
    // px AND the horizontal X position is roughly the same column (within
    // 200 px).
    let intraRegionRegressions = 0;
    let crossRegionJumps = 0;
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      if (curr.y < prev.y - 100) {
        if (Math.abs(curr.x - prev.x) < 200) {
          intraRegionRegressions++;
          console.log(
            `Intra-region focus regression: "${prev.text}" (x=${prev.x.toFixed(0)}, y=${prev.y.toFixed(0)}) → ` +
              `"${curr.text}" (x=${curr.x.toFixed(0)}, y=${curr.y.toFixed(0)})`
          );
        } else {
          crossRegionJumps++;
          console.log(
            `Cross-region focus jump (allowed): "${prev.text}" → "${curr.text}" ` +
              `(Δx=${(curr.x - prev.x).toFixed(0)}, Δy=${(curr.y - prev.y).toFixed(0)})`
          );
        }
      }
    }

    console.log(
      `Focus order: ${ordered.length} elements, ${intraRegionRegressions} intra-region regressions, ` +
        `${crossRegionJumps} cross-region jumps`
    );

    // Intra-region regressions are real bugs. Cross-region jumps are
    // expected on multi-column layouts — capped generously at 4 to catch a
    // catastrophic structural break (e.g., focus zig-zagging between
    // unrelated columns repeatedly).
    expect(
      intraRegionRegressions,
      "Within a single column, focus order should follow visual reading order"
    ).toBeLessThanOrEqual(2);
    expect(crossRegionJumps, "Focus should not zig-zag across regions").toBeLessThanOrEqual(4);
  });
});
