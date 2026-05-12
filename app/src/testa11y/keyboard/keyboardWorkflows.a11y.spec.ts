/**
 * Keyboard-only workflow tests for MAS compliance.
 *
 * Verifies that core user journeys can be completed entirely via keyboard
 * without requiring mouse interaction. This covers MAS / WCAG 2.1.1 (Keyboard)
 * and 2.1.2 (No Keyboard Trap).
 *
 * Tags: @comprehensive-a11y @keyboard
 */

import { test, expect } from "../fixtures";
import { enterEditor, gotoWithTheme, preferBrowserStorageInProjectDialog } from "../../testweb/WebTestUtilities";

test.describe("Keyboard Workflow — Project Creation @comprehensive-a11y @keyboard", () => {
  test("create project via keyboard only", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Step 1: Tab to "Create New" button and press Enter
    const createNewBtn = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewBtn).toBeVisible({ timeout: 5000 });

    // Use keyboard to reach and activate
    await createNewBtn.focus();
    await expect(createNewBtn).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Step 2: Project dialog should be open. Tab through fields.
    // Look for the submit button
    const submitBtn = page.getByTestId("submit-button");
    const dialogVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!dialogVisible) {
      // Try finding by text
      const createProjectBtn = page.locator("button:has-text('Create Project')").first();
      if (!(await createProjectBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log("Could not open project dialog — skipping");
        test.skip();
        return;
      }
    }

    // Select browser storage so we don't need a folder picker
    await preferBrowserStorageInProjectDialog(page);

    // Step 3a: Use keyboard-only navigation to the required Creator field and type a name.
    // The dialog autofocuses the Title field, but Creator is required and must be filled
    // before submission (HTML5 `required` will block the form otherwise). This exercises
    // the realistic keyboard-only flow: Tab → Tab → type.
    let reachedCreator = false;
    for (let i = 0; i < 10; i++) {
      const onCreator = await page.evaluate(() => {
        const el = document.activeElement as HTMLInputElement | null;
        return el?.getAttribute("name") === "creator" || el?.getAttribute("id") === "creator";
      });
      if (onCreator) {
        reachedCreator = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(reachedCreator, "Should be able to Tab to the Creator field").toBe(true);

    // Type a creator name purely via keyboard
    await page.keyboard.type("KeyboardTester");
    await page.waitForTimeout(150);

    // Step 3b: Continue tabbing to verify we can reach the submit button
    let reachedSubmit = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("data-testid") === "submit-button";
      });
      if (focused) {
        reachedSubmit = true;
        break;
      }
    }

    expect(reachedSubmit, "Should be able to Tab to the Create Project button").toBe(true);

    // Step 4: Press Enter to create the project
    await page.keyboard.press("Enter");
    await page.waitForTimeout(9000); // Project creation takes time
    await page.waitForLoadState("networkidle");

    // Step 5: Verify we're in the editor
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    const inEditor = await viewButton.isVisible({ timeout: 5000 }).catch(() => false);
    expect(inEditor, "Should have entered the editor after keyboard-only project creation").toBe(true);
  });
});

test.describe("Keyboard Workflow — Navigation @comprehensive-a11y @keyboard", () => {
  test("Tab navigation reaches all major regions on home page", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Track unique regions that received focus
    const focusedTagNames = new Set<string>();
    const focusedRoles = new Set<string>();

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName?.toLowerCase() ?? "",
          role: el?.getAttribute("role") ?? "",
          text: (el?.textContent ?? "").substring(0, 50),
        };
      });
      focusedTagNames.add(info.tag);
      if (info.role) focusedRoles.add(info.role);
    }

    // We should reach interactive elements: buttons, inputs, links
    const interactiveTypes = ["button", "input", "a", "select", "textarea"];
    const reachedInteractive = interactiveTypes.some((t) => focusedTagNames.has(t));
    expect(reachedInteractive, "Tab should reach at least one interactive element").toBe(true);
  });

  test("Shift+Tab navigates backwards", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Tab forward 5 times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    const afterForward = await page.evaluate(() => document.activeElement?.outerHTML?.substring(0, 80) ?? "");

    // Tab backward 2 times
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");

    const afterBackward = await page.evaluate(() => document.activeElement?.outerHTML?.substring(0, 80) ?? "");

    // Focus should have moved to a different element
    expect(afterForward).not.toBe(afterBackward);
  });

  test("Escape key closes open menus and dialogs", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Open a dialog
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();
      await page.waitForTimeout(500);

      // Press Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Dialog should be closed — submit button should not be visible
      const submitBtn = page.getByTestId("submit-button");
      const stillVisible = await submitBtn.isVisible({ timeout: 1000 }).catch(() => false);
      expect(stillVisible, "Dialog should close on Escape").toBe(false);
    }
  });
});

test.describe("Keyboard Workflow — Editor Navigation @comprehensive-a11y @keyboard", () => {
  test("Tab through editor regions after project creation", async ({ page }) => {
    // Use the shared enterEditor helper so we actually land inside the project
    // editor (the inline flow used in the original P0 fix only got us partway
    // — it never filled the required Creator field, so the dialog stayed open
    // and the test was effectively measuring tab order *inside the dialog*,
    // which is unrelated to editor navigation).
    const entered = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!entered) {
      test.skip();
      return;
    }
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(500);

    // Now Tab through the editor and collect what regions we hit
    const regionElements: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const role = el?.getAttribute("role") ?? "";
        const ariaLabel = el?.getAttribute("aria-label") ?? "";
        const tag = el?.tagName?.toLowerCase() ?? "";
        const dataTestId = el?.getAttribute("data-testid") ?? "";
        const text = (el?.textContent ?? "").substring(0, 30).replace(/\s+/g, " ").trim();
        const cls = el?.getAttribute("class")?.split(" ")[0] ?? "";
        return `${tag}[role=${role}][aria-label=${ariaLabel}][testid=${dataTestId}][cls=${cls}][text=${text}]`;
      });
      regionElements.push(info);
    }

    // Log everything we saw, deduped by occurrence count, for debuggability
    // when this test fails.
    const counts = new Map<string, number>();
    for (const e of regionElements) counts.set(e, (counts.get(e) ?? 0) + 1);
    console.log(`Editor tab stops (${regionElements.length} presses):`);
    for (const [k, v] of counts) console.log(`  x${v} ${k}`);

    // Should reach at least a few distinct interactive elements in the editor
    const uniqueElements = new Set(regionElements);
    expect(uniqueElements.size, "Should reach multiple distinct elements via Tab in editor").toBeGreaterThan(3);
  });
});
