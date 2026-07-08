/**
 * Accessible-name coverage for the Content Wizard slider controls (WCAG 4.1.2,
 * axe rule "label").
 *
 * Each wizard step renders MUI <Slider> controls (Mob: health/attack/speed,
 * Block: mining speed/light, Item: max stack/durability) with a sibling <label>
 * that is not associated with the slider's hidden <input type="range">. Without
 * an explicit association the input has no accessible name, so screen-reader users
 * cannot tell what the slider adjusts. Each slider must reference its visible
 * label via aria-labelledby (the label carries an id).
 *
 * Run (from app/):
 *   npx playwright test WizardSliderAccessibility.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoWithTheme } from "./WebTestUtilities";

async function openWizard(page: Page, goalName: RegExp): Promise<void> {
  await gotoWithTheme(page, "light");
  // The home "What do you want to make?" goal picker launches the wizard. The
  // cards are MUI CardActionArea buttons named by their visible title.
  const card = page.getByRole("button", { name: goalName }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await page.waitForTimeout(600);
}

/** Advance the wizard until its first slider step is on screen. */
async function gotoSlidersStep(page: Page): Promise<void> {
  const slider = page.locator(".cwiz-step-content .MuiSlider-root").first();
  for (let i = 0; i < 6; i++) {
    if (await slider.isVisible().catch(() => false)) return;
    const next = page.getByRole("button", { name: /^Next/i }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
      await page.waitForTimeout(400);
    } else {
      await page.waitForTimeout(400);
    }
  }
}

const wizards: { label: string; goal: RegExp }[] = [
  { label: "Mob", goal: /make a mob/i },
  { label: "Block", goal: /make a block/i },
  { label: "Item", goal: /make an item/i },
];

for (const { label, goal } of wizards) {
  test(`${label} wizard sliders each expose an accessible name`, async ({ page }) => {
    test.setTimeout(90000);
    await openWizard(page, goal);
    await gotoSlidersStep(page);

    const sliders = page.locator(".cwiz-step-content .MuiSlider-root");
    await expect(sliders.first()).toBeVisible({ timeout: 15000 });
    const count = await sliders.count();
    expect(count, `expected the ${label} stats step to render sliders`).toBeGreaterThan(0);

    // Each MUI Slider's hidden <input type="range"> must have a non-empty
    // accessible name so screen readers can announce what the slider controls.
    for (let i = 0; i < count; i++) {
      const input = sliders.nth(i).locator('input[type="range"]');
      await expect(input, `${label} slider #${i} input must have an accessible name`).toHaveAccessibleName(/\S/);
    }

    // And the step must clear the axe rule the audit flagged.
    const results = await new AxeBuilder({ page }).include(".cwiz-step-content").withRules(["label"]).analyze();
    expect(
      results.violations,
      `label violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
    ).toHaveLength(0);
  });
}
