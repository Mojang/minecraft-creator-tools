/**
 * Layout coverage for the "Start from a template" gallery cards under WCAG 1.4.12
 * text-spacing overrides.
 *
 * Each TemplateCard renders its title/description as a caption over the template
 * image via ImageOverlay. The caption must stay in normal flow so the card GROWS
 * when the user increases line/letter/word spacing. If the caption is positioned
 * out of flow (e.g. position:absolute), the growing text overflows the fixed image
 * height and visually overlaps the card's "Create New" button and the next card —
 * a loss of content/readability that fails 1.4.12. This guards against that
 * regression by asserting no caption text overlaps the action button after the
 * overrides are applied.
 *
 * Run (from app/):
 *   npx playwright test TemplateCardTextSpacing.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";
import { gotoWithTheme } from "./WebTestUtilities";

// WCAG 1.4.12 text-spacing user-style overrides.
const TEXT_SPACING_CSS = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

test("template cards do not overlap their action button under text spacing", async ({ page }) => {
  test.setTimeout(60000);
  await gotoWithTheme(page, "light");

  // Wait for the "Start from a template" gallery to render its cards.
  await expect(page.locator('[data-testid^="template-card-"]').first()).toBeVisible({ timeout: 15000 });

  await page.addStyleTag({ content: TEXT_SPACING_CSS });
  await page.waitForTimeout(400); // allow the override to reflow

  // For each template card, the caption text (title/description, rendered as an
  // image overlay) must stay above the "Create New" button. If the overlay grows
  // taller than the image area but is out of normal flow, it overflows the card
  // and visually overlaps the button / the next card.
  const overlaps = await page.evaluate(() => {
    const results: { card: string; worstText: string; overlapPx: number }[] = [];
    document.querySelectorAll('[data-testid^="template-card-"]').forEach((card) => {
      const btn = card.querySelector('[data-testid^="template-create-"]');
      if (!btn) return;
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.height === 0) return;

      let worstBottom = -Infinity;
      let worstText = "";
      card.querySelectorAll("p, span, h1, h2, h3, h4, h5, h6").forEach((el) => {
        if (btn.contains(el) || el.contains(btn)) return; // skip the button label and ancestors
        const txt = (el.textContent || "").trim();
        if (!txt) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.bottom > worstBottom) {
          worstBottom = r.bottom;
          worstText = txt.slice(0, 50);
        }
      });

      const overlapPx = worstBottom - btnRect.top;
      if (overlapPx > 4) {
        results.push({
          card: (card as HTMLElement).dataset.testid || "",
          worstText,
          overlapPx: Math.round(overlapPx),
        });
      }
    });
    return results;
  });

  expect(
    overlaps,
    `Template caption text overlaps the action button under text spacing: ${JSON.stringify(overlaps)}`
  ).toHaveLength(0);
});
