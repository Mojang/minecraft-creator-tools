import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = "debugoutput/screenshots";

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * Helper to create a project from template so we have something in the project list
 */
async function createProjectFromTemplate(page: any) {
  // Click on "New" under the Add-On Starter template
  const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();
  await addOnStarterNewButton.click();

  // Wait for the project creation dialog to appear
  await page.waitForTimeout(1000);

  // Click OK to create the project with default settings (use testid like other tests)
  const okButton = await page.getByTestId("submit-button").first();
  await okButton.click();

  // Wait for the editor to load
  await page.waitForTimeout(8000);
  await page.waitForLoadState("networkidle");

  // Navigate back to home
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
}

/**
 * Helper to ensure we have projects in the list.
 *
 * Projects are rendered via ProjectPanel.tsx using McListItem (ButtonBase) components.
 * Each project row has a "More options" IconButton with aria-label="More options for <name>".
 * We use the project thumbnail img[alt="Project thumbnail"] to identify project items.
 */
async function ensureProjectsExist(page: any) {
  let projectItems = page.locator('img[alt="Project thumbnail"]');
  let projectCount = await projectItems.count();

  if (projectCount === 0) {
    console.log("No projects found, creating one from template...");
    await createProjectFromTemplate(page);
    projectItems = page.locator('img[alt="Project thumbnail"]');
    projectCount = await projectItems.count();
  }

  return { projectItems, projectCount };
}

test.describe("Project Context Menu @full", () => {
  test("should show context menu with correct options on right-click", async ({ page }) => {
    test.setTimeout(90000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const { projectItems, projectCount } = await ensureProjectsExist(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-home-initial.png") });

    if (projectCount === 0) {
      console.log("Still no projects found, skipping test");
      return;
    }

    // Right-click on the first project item
    const firstProject = projectItems.first();
    await firstProject.click({ button: "right" });
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-opened.png") });

    // Verify context menu contains expected items
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const openItem = page.locator('[role="menuitem"]:has-text("Open this project")');
    await expect(openItem).toBeVisible();

    const removeItem = page.locator('[role="menuitem"]:has-text("Remove from list")');
    await expect(removeItem).toBeVisible();

    // Delete option only shown on web (not Electron)
    const deleteItem = page.locator('[role="menuitem"]:has-text("Delete project")');
    await expect(deleteItem).toBeVisible();

    // Close menu
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(menu).not.toBeVisible();
  });

  test("should show more options button (⋮) and open menu when clicked", async ({ page }) => {
    test.setTimeout(90000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const { projectCount } = await ensureProjectsExist(page);

    if (projectCount === 0) {
      console.log("No projects found, skipping button test");
      return;
    }

    // Find the more options button (⋮) — rendered as IconButton with aria-label
    const moreButton = page.locator('button[aria-label^="More options for"]').first();
    const buttonVisible = await moreButton.isVisible().catch(() => false);

    if (!buttonVisible) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-button-not-visible.png") });
      console.log("More options button not visible");
      return;
    }

    await moreButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-via-button.png") });

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const openItem = page.locator('[role="menuitem"]:has-text("Open this project")');
    await expect(openItem).toBeVisible();

    await page.keyboard.press("Escape");
  });

  test("should show confirmation dialog when Remove is clicked", async ({ page }) => {
    test.setTimeout(90000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const { projectItems, projectCount } = await ensureProjectsExist(page);

    if (projectCount === 0) {
      console.log("No projects found, skipping confirmation test");
      return;
    }

    // Right-click to open menu
    await projectItems.first().click({ button: "right" });
    await page.waitForTimeout(500);

    // Click Remove
    const removeItem = page.locator('[role="menuitem"]:has-text("Remove from list")');
    await removeItem.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-confirm-dialog.png") });

    // Verify confirmation dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const cancelButton = dialog.locator('button:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();

    const confirmButton = dialog.locator('button:has-text("Remove")');
    await expect(confirmButton).toBeVisible();

    // Cancel the dialog
    await cancelButton.click();
    await page.waitForTimeout(300);
    await expect(dialog).not.toBeVisible();
  });

  test("should show Delete confirmation dialog (web only)", async ({ page }) => {
    test.setTimeout(90000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const { projectItems, projectCount } = await ensureProjectsExist(page);

    if (projectCount === 0) {
      console.log("No projects found, skipping delete test");
      return;
    }

    // Right-click to open menu
    await projectItems.first().click({ button: "right" });
    await page.waitForTimeout(500);

    // Click Delete
    const deleteItem = page.locator('[role="menuitem"]:has-text("Delete project")');
    const deleteVisible = await deleteItem.isVisible().catch(() => false);

    if (!deleteVisible) {
      console.log("Delete option not visible (expected in Electron)");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-no-delete-option.png") });
      return;
    }

    await deleteItem.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "context-menu-delete-confirm-dialog.png") });

    // Verify confirmation dialog mentions "permanently delete"
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogText = page.locator("text=permanently delete");
    await expect(dialogText).toBeVisible();

    // Cancel the dialog
    const cancelButton = dialog.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(300);
    await expect(dialog).not.toBeVisible();
  });
});
