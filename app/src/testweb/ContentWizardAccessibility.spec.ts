/**
 * Semantic-structure coverage for the Content Wizard (WCAG 1.3.1, Info & Relationships).
 *
 * The step-by-step wizard's title ("Create Mob" / "Create Block" / "Create Item")
 * looks like a heading but was rendered as a plain <div>, so assistive technology
 * could not reach it via heading navigation. It must be exposed as a semantic
 * heading (an <h*> element or role="heading").
 *
 * This drives the real launcher → step wizard and asserts the title is reachable
 * by heading role, so it fails on the plain-div defect and passes once the title
 * is a heading.
 *
 * Run: npx playwright test ContentWizardAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

test("Content Wizard step title is exposed as a semantic heading", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page)).toBe(true);

  // Open the Add → Content Wizard launcher.
  const addButton = page.getByRole("button", { name: /add new content/i }).first();
  await expect(addButton).toBeVisible({ timeout: 15000 });
  await addButton.click();

  // Launch the step-by-step "New Mob" wizard, whose frame shows the "Create Mob" title.
  const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
  await expect(newMob).toBeVisible({ timeout: 10000 });
  await newMob.click();

  // The visually-heading title must be reachable via heading role (WCAG 1.3.1),
  // not a styled <div>.
  const heading = page.getByRole("heading", { name: /create mob/i });
  await expect(heading).toBeVisible({ timeout: 10000 });
});
