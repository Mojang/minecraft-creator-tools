/**
 * Accessibility coverage for the Project Inspector.
 *
 * 1. Semantic structure (WCAG 1.3.1): the Summary section headers ("Content
 *    Statistics", "Project Information") look like headings — Minecrafter font,
 *    green accent bar — but were rendered as plain <div>s, so assistive
 *    technology could not reach them via heading navigation. They must be
 *    exposed as semantic headings (<h*> elements).
 * 2. Name, Role, Value (WCAG 4.1.2): the toolbar "Suite" selector is a MUI
 *    <Select> whose role="combobox" display element had no accessible name —
 *    a top-level aria-labelledby is not forwarded onto it by MUI. The name must
 *    be set via SelectDisplayProps so screen readers can announce the field.
 *    The name belongs on that role="combobox" element, NOT on MUI's hidden
 *    native <input> (aria-hidden, tabindex=-1): that input only carries the value
 *    for form submission and is excluded from the accessibility tree, so naming
 *    it would do nothing for assistive technology.
 *
 * Each test drives the real editor → Project Inspector and fails on the defect,
 * passing once the markup is correct.
 *
 * Run: npx playwright test ProjectInspectorAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { enterEditor, processMessage, takeScreenshot, waitForInspectorValidationComplete } from "./WebTestUtilities";

test("Project Inspector Summary section header is a semantic heading", async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page, { editMode: "full" })).toBe(true);

  // Open the Project Inspector and switch to the Summary view.
  await page.getByText("Check for Problems").first().click();
  await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });
  // Validation runs in a worker and is slow on the Vite dev server; wait for it to
  // finish so the Summary section headers are actually rendered before asserting.
  await waitForInspectorValidationComplete(page);
  await page.locator("#pid-tab-summary").click();

  // The "Content Statistics" section header is visually a heading; it must be
  // reachable via heading role (a styled <div> is invisible to heading
  // navigation). Rendered as an <h2>, subordinate to the project name <h1>.
  const heading = page.getByRole("heading", { name: /content statistics/i });
  await expect(heading).toBeVisible({ timeout: 20000 });

  await takeScreenshot(page, "debugoutput/screenshots/project-inspector-summary-heading");
});

test("Project Inspector Suite selector has an accessible name", async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page, { editMode: "full" })).toBe(true);

  // Open the Project Inspector (the Suite selector lives in its toolbar).
  await page.getByText("Check for Problems").first().click();
  await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });

  // The MUI <Select> combobox must expose a non-empty accessible name (WCAG
  // 4.1.2) so screen readers can announce what the field controls.
  const combobox = page.locator('.pid-suiteDropdown [role="combobox"]');
  await expect(combobox).toBeVisible({ timeout: 20000 });
  await expect(combobox).toHaveAccessibleName(/\S/);

  // The name belongs on the combobox, not on MUI's hidden native <input>. That
  // input is aria-hidden (a form-submission shadow), so it never reaches the
  // accessibility tree and naming it would help no one. Lock that in so a later
  // change can't "fix" the name by moving it onto the input instead.
  const nativeInput = page.locator(".pid-suiteDropdown input.MuiSelect-nativeInput");
  await expect(nativeInput).toHaveAttribute("aria-hidden", "true");

  // It must also clear the exact axe rule the audit flagged.
  const results = await new AxeBuilder({ page })
    .include(".pid-suiteDropdown")
    .withRules(["aria-input-field-name"])
    .analyze();
  expect(
    results.violations,
    `aria-input-field-name violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);
});
