/**
 * Project Inspector Items rows must not expose an interactive role on the <tr>.
 *
 * A table row's implicit ARIA role is "row". Overriding it with role="button"
 * (to make the whole row clickable) breaks the table's structural semantics for
 * assistive technology AND nests the row's own interactive children (the info
 * and fix buttons) inside an interactive element — an axe `nested-interactive`
 * violation and a WCAG 4.1.2 (Name, Role, Value) failure. The clickable
 * navigation instead lives on a real <button> rendered as the file-path link
 * inside a cell, so the row stays a plain row and keyboard/AT users still get a
 * focusable, labelled control to open the offending file.
 *
 * Run (from app/): npx playwright test ProjectInspectorRowRole.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, takeScreenshot } from "./WebTestUtilities";

test.describe("Project Inspector Items rows expose no interactive role on the <tr>", () => {
  test("clickable inspector rows are plain rows with a keyboard-reachable path button", async ({ page }) => {
    test.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    // Open a project and the Project Inspector (the "Check for Problems" entry,
    // full mode only).
    expect(await enterEditor(page, { editMode: "full" })).toBe(true);

    await page.getByText("Check for Problems").first().click();
    await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });

    // Switch to the Items list and reveal every result type (Information/Passed
    // rows are hidden by default, and those are the clickable navigable rows).
    await page.locator("#pid-tab-items").click();
    await page.getByRole("button", { name: "Show all filter types" }).click();

    // Wait for the items table to populate.
    await page.locator(".piid-row").first().waitFor({ timeout: 20000 });

    // There must be clickable rows for this assertion to be meaningful...
    const clickableRowCount = await page.locator("tr.piid-rowClickable").count();
    expect(clickableRowCount, "expected at least one navigable inspector row").toBeGreaterThan(0);

    // ...and no <tr> may carry an interactive role.
    const trButtonCount = await page.locator("tr[role=button]").count();
    expect(trButtonCount, "a <tr> must keep its native row role, not role=button").toBe(0);

    // The navigation affordance must remain keyboard-reachable: the file path is
    // a real <button> styled as a link living inside the row's cell.
    const locationButtonCount = await page.locator("button.piid-locationLink").count();
    expect(locationButtonCount, "expected keyboard-accessible file-path buttons in rows").toBeGreaterThan(0);

    await takeScreenshot(page, "debugoutput/screenshots/inspector-rows-no-interactive-role");

    expect(consoleErrors, `unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });
});
