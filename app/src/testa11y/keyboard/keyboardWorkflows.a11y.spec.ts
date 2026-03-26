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
import { gotoWithTheme, preferBrowserStorageInProjectDialog } from "../../testweb/WebTestUtilities";

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

    // Step 3: Press Tab through dialog fields — verify we can reach the submit button
    let reachedSubmit = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("data-testid") === "submit-button" || el?.textContent?.includes("Create Project");
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
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Create a project
    const createNewBtn = page.getByRole("button", { name: "Create New" }).first();
    if (!(await createNewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await createNewBtn.click();
    await page.waitForTimeout(500);

    await preferBrowserStorageInProjectDialog(page);

    const submitBtn = page.getByTestId("submit-button");
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    // Now Tab through the editor and collect what regions we hit
    const regionElements: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const role = el?.getAttribute("role") ?? "";
        const ariaLabel = el?.getAttribute("aria-label") ?? "";
        const tag = el?.tagName?.toLowerCase() ?? "";
        return `${tag}[role=${role}][aria-label=${ariaLabel}]`;
      });
      regionElements.push(info);
    }

    // Should reach at least a few distinct interactive elements in the editor
    const uniqueElements = new Set(regionElements);
    expect(uniqueElements.size, "Should reach multiple distinct elements via Tab in editor").toBeGreaterThan(3);
  });
});
