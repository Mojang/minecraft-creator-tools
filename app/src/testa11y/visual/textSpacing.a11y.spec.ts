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

      // Allow at most 2 minor clips (small MUI internals like <legend>
      // elements or any harmless 3-5px leftovers). The previously-allowed
      // 15-element budget masked real card-content clipping per WCAG
      // 1.4.12 — that has now been fixed at the component level
      // (TemplateCard / GoalPicker / ImageOverlay no longer hard-clip
      // content), so we tighten the threshold to lock in the gain.
      const majorClips = clipped.filter((c) => c.clippedBy > 20);
      console.log(`Text spacing: ${majorClips.length} elements with >20px clipping in ${theme} mode`);
      expect(
        majorClips.length,
        `Found ${majorClips.length} elements with major text clipping (>20px) in ${theme} mode`
      ).toBeLessThanOrEqual(2);
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
    ).toBeLessThanOrEqual(2); // Editor: tightened from 5 once the card-level fixes from the home page were validated; allow a very small budget for MUI internals.
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
