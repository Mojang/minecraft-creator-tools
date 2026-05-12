import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

/**
 * Regression test for the JsonSchemaItemInfoGenerator false-positive on
 * Bedrock manifest "version" fields.
 *
 * Manifest version fields legitimately accept either a string ("1.0.0") or
 * a three-number array ([1, 0, 0]) — the array form is the canonical form
 * for header.version, header.min_engine_version, modules[].version, and
 * dependencies[].version. The bundled JSON schemas sometimes only declare
 * the string form, which used to surface a "Version format needs updating"
 * warning that, if followed, would brick a real add-on.
 *
 * This test:
 * - opens the editor on a fresh starter project
 * - navigates to the Inspector view
 * - switches to the Items / Info tab
 * - asserts that NO row's title is "Version format needs updating"
 * - asserts that NO row contains the text "should be text like" (which was
 *   the misleading detail copy paired with the false-positive title)
 */
test.describe("Inspector — version false-positive regression @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("inspector should not show false-positive 'Version format needs updating' rows", async ({ page }) => {
    test.setTimeout(180000);

    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Navigate to the inspector / "Check for Problems" view.
    const inspectorItem = page
      .getByText("Check for Problems")
      .or(page.getByText("Validation"))
      .or(page.getByText("Inspector"))
      .first();

    await expect(inspectorItem).toBeVisible({ timeout: 15000 });
    await inspectorItem.click();

    // Wait for validation to run (it can take several seconds on a fresh project).
    await page.waitForTimeout(8000);

    // Take a screenshot for triage even when the test passes.
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-version-falsepositive-01-loaded.png",
      fullPage: true,
    });

    // Switch to the Info tab if present, where individual items are listed.
    const infoTab = page.locator("button[title='Info Tab']");
    if ((await infoTab.count()) > 0) {
      await infoTab.first().click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: "debugoutput/screenshots/inspector-version-falsepositive-02-info-tab.png",
      fullPage: true,
    });

    // Assert no row's title is the false-positive "Version format needs updating".
    const falsePositiveTitle = page.locator("text=/Version format needs updating/i");
    const falsePositiveCount = await falsePositiveTitle.count();
    expect(
      falsePositiveCount,
      `Found ${falsePositiveCount} 'Version format needs updating' row(s) — false positive regression`
    ).toBe(0);

    // Assert no row contains the misleading "should be text like" copy.
    const misleadingCopy = page.locator("text=/should be text like/i");
    const misleadingCount = await misleadingCopy.count();
    expect(
      misleadingCount,
      `Found ${misleadingCount} 'should be text like' row(s) — misleading copy regression`
    ).toBe(0);

    // Sanity: the inspector did surface SOME content (so the test isn't
    // passing trivially because the inspector view is blank).
    const bodyText = (await page.locator("body").textContent()) || "";
    expect(bodyText.length).toBeGreaterThan(100);
  });
});
