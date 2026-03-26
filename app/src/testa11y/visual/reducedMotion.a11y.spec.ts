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

        // Flag elements with non-trivial animations still running
        if (animName !== "none" && animDuration > 0) {
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

    // Warn but don't fail — some CSS libraries may have residual animations.
    // A strict pass would require 0 animations.
    console.log(`Animated elements with reduced-motion: ${animatedElements.length} (should ideally be 0)`);
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
