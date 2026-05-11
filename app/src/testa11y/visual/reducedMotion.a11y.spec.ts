/**
 * Reduced motion accessibility tests.
 *
 * Verifies that when `prefers-reduced-motion: reduce` is set, animations
 * are disabled or minimized and no content is lost.
 *
 * MAS / WCAG criteria: 2.3.3 (Animation from Interactions).
 *
 * Tags: @comprehensive-a11y @reduced-motion @visual-a11y
 */

import { test, expect } from "../fixtures";
import { assertNoCriticalViolations, setMediaEmulation } from "../a11yTestUtils";

test.describe("Reduced Motion — Home Page @comprehensive-a11y @reduced-motion @visual-a11y", () => {
  test("home page with reduced-motion — no critical violations", async ({ page }) => {
    await page.goto("/");
    await setMediaEmulation(page, { reducedMotion: "reduce" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await assertNoCriticalViolations(page, "Home (reduced-motion)", {
      screenshotPath: "debugoutput/screenshots/a11y-reduced-motion-home.png",
    });
  });

  test("no CSS animations active with reduced-motion preference", async ({ page }) => {
    await page.goto("/");
    await setMediaEmulation(page, { reducedMotion: "reduce" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check for elements with active animations or transitions
    const animatedElements = await page.evaluate(() => {
      const results: string[] = [];
      const elements = document.querySelectorAll("*");

      for (const el of elements) {
        const styles = window.getComputedStyle(el);
        const animName = styles.animationName;
        const animDuration = parseFloat(styles.animationDuration);
        const transitionDuration = parseFloat(styles.transitionDuration);

        // Only flag animations that take longer than 200ms — anything
        // shorter is imperceptible to a user who has requested reduced
        // motion. This avoids false positives from no-op animations that
        // libraries use as event-firing hooks (e.g. MUI's
        // `mui-auto-fill-cancel`, which has a 0.00001s duration whose only
        // purpose is to trigger `animationend` so MUI can detect browser
        // autofill).
        if (animName !== "none" && animDuration > 0.2) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === "string" ? el.className.split(" ")[0] : "";
          results.push(`${tag}.${cls}: animation=${animName} (${animDuration}s)`);
        }
        // Transitions over 200ms are potentially problematic for reduced-motion
        if (transitionDuration > 0.2) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === "string" ? el.className.split(" ")[0] : "";
          results.push(`${tag}.${cls}: transition=${transitionDuration}s`);
        }
      }
      return results.slice(0, 10);
    });

    if (animatedElements.length > 0) {
      console.log("Elements with animations despite reduced-motion:", animatedElements);
    }

    console.log(`Animated elements with reduced-motion: ${animatedElements.length} (should be 0)`);

    // Hardened: we install a global `@media (prefers-reduced-motion: reduce)`
    // rule in `App.css` that neutralizes every animation and transition
    // duration to 0.01ms, so any leak indicates either (a) an inline `style`
    // override that forgot to gate on the preference, or (b) a `!important`
    // animation duration somewhere that overrides our global rule. Either
    // way it is a real bug — fail the test and surface the offending
    // selectors.
    expect(
      animatedElements,
      "No elements should have non-trivial animations / transitions when the user has requested reduced motion"
    ).toHaveLength(0);
  });
});

test.describe("Reduced Motion — Content Integrity @comprehensive-a11y @reduced-motion @visual-a11y", () => {
  test("all content visible — no content hidden behind animations", async ({ page }) => {
    // Load page normally first
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const normalElementCount = await page.evaluate(() => {
      return document.querySelectorAll("button, a, input, [role='button'], h1, h2, h3, p").length;
    });

    // Now reload with reduced-motion
    await setMediaEmulation(page, { reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const reducedMotionElementCount = await page.evaluate(() => {
      return document.querySelectorAll("button, a, input, [role='button'], h1, h2, h3, p").length;
    });

    console.log(`Elements: normal=${normalElementCount}, reduced-motion=${reducedMotionElementCount}`);

    // No content should be lost when reduced-motion is active
    expect(
      reducedMotionElementCount,
      "No interactive elements should disappear with reduced-motion preference"
    ).toBeGreaterThanOrEqual(normalElementCount);
  });
});
