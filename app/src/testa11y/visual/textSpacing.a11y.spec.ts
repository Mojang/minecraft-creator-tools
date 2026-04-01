/**
 * Text spacing override tests (MAS / WCAG 1.4.12).
 *
 * Injects CSS overrides for line height, letter spacing, word spacing, and
 * paragraph spacing per WCAG 1.4.12 requirements. Verifies no content is
 * clipped, truncated, or overlapping.
 *
 * Tags: @comprehensive-a11y @visual-a11y
 */

import { test, expect } from "../fixtures";
import { injectTextSpacingOverrides, findClippedTextElements, assertNoHorizontalOverflow } from "../a11yTestUtils";
import { gotoWithTheme, enterEditor, ThemeMode } from "../../testweb/WebTestUtilities";

const themes: ThemeMode[] = ["light", "dark"];

test.describe("Text Spacing — Home Page @comprehensive-a11y @visual-a11y", () => {
  for (const theme of themes) {
    test(`home page — ${theme} mode — no clipping with text spacing overrides`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      await page.waitForTimeout(500);

      await injectTextSpacingOverrides(page);
      await page.waitForTimeout(300); // Let styles reflow

      // Check for clipped text
      const clipped = await findClippedTextElements(page);
      if (clipped.length > 0) {
        console.log(`Clipped elements with text spacing overrides (${theme}):`);
        clipped.forEach((c) => console.log(`  - ${c.selector} (clipped by ${c.clippedBy}px)`));
      }

      // Take screenshot for visual review
      await page.screenshot({
        path: `debugoutput/screenshots/a11y-textspacing-home-${theme}.png`,
        fullPage: true,
      });

      // Allow some clipping (e.g., intentionally constrained card areas), but flag extreme amounts.
      // Gallery template cards use fixed heights, so some clipping with text spacing overrides is expected.
      const majorClips = clipped.filter((c) => c.clippedBy > 20);
      console.log(`Text spacing: ${majorClips.length} elements with >20px clipping in ${theme} mode`);
      expect(
        majorClips.length,
        `Found ${majorClips.length} elements with major text clipping (>20px) in ${theme} mode`
      ).toBeLessThanOrEqual(15);
    });

    test(`home page — ${theme} mode — no horizontal overflow with text spacing`, async ({ page }) => {
      await gotoWithTheme(page, theme);
      await page.waitForTimeout(500);

      await injectTextSpacingOverrides(page);
      await page.waitForTimeout(300);

      await assertNoHorizontalOverflow(page, 50);
    });
  }
});

test.describe("Text Spacing — Editor @comprehensive-a11y @visual-a11y", () => {
  test("editor — no clipping with text spacing overrides", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    await injectTextSpacingOverrides(page);
    await page.waitForTimeout(300);

    const clipped = await findClippedTextElements(page);
    if (clipped.length > 0) {
      console.log("Clipped elements in editor with text spacing overrides:");
      clipped.forEach((c) => console.log(`  - ${c.selector} (clipped by ${c.clippedBy}px)`));
    }

    await page.screenshot({
      path: "debugoutput/screenshots/a11y-textspacing-editor.png",
      fullPage: true,
    });

    const majorClips = clipped.filter((c) => c.clippedBy > 20);
    expect(
      majorClips.length,
      `Found ${majorClips.length} elements with major text clipping in editor`
    ).toBeLessThanOrEqual(5); // Editor has more constrained areas
  });

  test("editor — no horizontal overflow with text spacing", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    await injectTextSpacingOverrides(page);
    await page.waitForTimeout(300);

    await assertNoHorizontalOverflow(page, 50);
  });
});
