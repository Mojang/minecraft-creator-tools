/**
 * Structural accessibility coverage for the New Project dialog (WCAG 1.3.1 /
 * 4.1.2, axe rule aria-allowed-role).
 *
 * The dialog's <form> must live INSIDE the dialog, not on the Dialog Paper: MUI
 * applies role="dialog" to the Paper, and a <form> element may not carry
 * role="dialog" (it confuses assistive technology). This asserts the
 * role="dialog" element is a plain element, the dialog clears aria-allowed-role,
 * and the form is still present (so Enter-to-submit / Create Project keep working).
 *
 * Run (from app/):
 *   npx playwright test NewProjectDialogAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { processMessage, clickTemplateCreateButton } from "./WebTestUtilities";

test("New Project dialog role=dialog is not on a form element", async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const opened = await clickTemplateCreateButton(page, "addonStarter");
  expect(opened, "should open the New Project dialog").toBe(true);

  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // The element carrying role="dialog" must not be a <form>.
  const tagName = await dialog.evaluate((el) => el.tagName.toLowerCase());
  expect(tagName, `role="dialog" should not sit on a <${tagName}>`).not.toBe("form");

  // And the dialog must clear the exact axe rule the audit flagged.
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withRules(["aria-allowed-role"]).analyze();
  expect(
    results.violations,
    `aria-allowed-role violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);

  // The form behaviour must still exist (Enter-to-submit / Create Project): a
  // <form> should be present inside the dialog.
  const formInside = dialog.locator("form");
  await expect(formInside).toHaveCount(1);
});
