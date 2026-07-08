/**
 * Reflow / resize-text coverage (MAS 1.4.4) for the New Project dialog hero.
 *
 * The hero header Box had a fixed `height: 140` and was a flex child of the MUI
 * Dialog Paper (a flex column). When the viewport is short (e.g. 200% zoom) the
 * Paper runs out of room and flexbox shrank the hero to a sliver; the caption,
 * which was `position: absolute; bottom: 0`, then overflowed the TOP of the hero
 * — its "Creating from template" overline rode up off the dark scrim band onto
 * the bright template artwork and became unreadable. The hero now uses
 * `minHeight` + `flexShrink: 0` and lays the caption out in normal flow, so it
 * keeps its size (and grows for its caption) instead of collapsing.
 *
 * Asserts the caption does not overflow the top of the hero at a constrained
 * (zoomed) viewport.
 *
 * Run (from app/):
 *   npx playwright test --config=playwright-reflow.config.js NewProjectDialogHeroReflow.spec.ts --project=reflow-200pct
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, clickTemplateCreateButton } from "../testweb/WebTestUtilities";

// 200% zoom on a typical ~1800px-wide laptop display ⇒ a wide-but-short effective
// CSS viewport, which is what vertically constrains the dialog and squeezes the hero.
test.use({ viewport: { width: 900, height: 440 } });

test("New Project dialog hero overline stays in the scrim band at 200% zoom @reflow", async ({ page }) => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const opened = await clickTemplateCreateButton(page, "addonStarter");
  expect(opened, "should open the New Project dialog").toBe(true);

  const overline = page.locator(".npd-heroOverline");
  await expect(overline).toBeVisible({ timeout: 10000 });
  // Let the dialog's grow/fade transition settle before measuring geometry.
  await page.waitForTimeout(600);

  const paper = page.locator(".MuiDialog-paper").first();
  await paper.screenshot({ path: "debugoutput/screenshots/repro-1632292-200pct.png" });

  // Measure the hero header, its caption band, and the overline.
  const geo = await page.evaluate(() => {
    const ol = document.querySelector(".npd-heroOverline");
    if (!ol) return null;
    const caption = ol.parentElement; // the absolutely-positioned caption Box
    const hero = caption?.parentElement; // the fixed-height hero Box
    if (!caption || !hero) return null;
    const o = ol.getBoundingClientRect();
    const c = caption.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    return {
      overlineTop: o.top,
      captionTop: c.top,
      heroTop: h.top,
      heroHeight: h.height,
    };
  });

  expect(geo, "hero/caption/overline should exist").not.toBeNull();

  // The caption (and therefore the overline) must not spill above the hero's top
  // edge — if it does, the overline is no longer over the dark scrim band.
  expect(
    geo!.captionTop,
    `caption top ${geo!.captionTop} should not overflow above hero top ${geo!.heroTop} (hero height ${geo!.heroHeight})`
  ).toBeGreaterThanOrEqual(geo!.heroTop - 2);
});
