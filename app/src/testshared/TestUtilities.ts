/**
 * Shared test utilities for MCTools testing.
 *
 * This module contains reusable test helpers that work in both web (Playwright browser)
 * and Electron (Playwright Electron) contexts.
 */

import { Page, expect, ConsoleMessage } from "@playwright/test";

// List of ignorable console messages
const ignorableTokens = [
  "CSSinJS Debug data collection is disabled",
  "You are running Fela in production mode.",
  "is deprecated in StrictMode",
  "No content for file", // Normal during project loading when files haven't been saved yet
  "renderingGroupId of an instanced mesh", // BabylonJS informational note
  "session.getAllExtensions", // Electron deprecation warning
  "session.loadExtension", // Electron deprecation warning
  "Added Extension:", // Electron extension loading info
  "ERR_CONNECTION_REFUSED", // Expected when dev server not running
];

export type ThemeMode = "light" | "dark";

/**
 * Check if a console message is ignorable (expected noise).
 */
export function isIgnorableMessage(message: string): boolean {
  return ignorableTokens.some((ignorable) => message.indexOf(ignorable) >= 0);
}

/**
 * Process a console message, collecting errors and warnings.
 */
export function processMessage(
  msg: ConsoleMessage,
  page: Page,
  consoleErrors: { url: string; error: string }[],
  consoleWarnings: { url: string; error: string }[]
): void {
  const messageType = msg.type();
  const messageText = msg.text();

  if (!isIgnorableMessage(messageText)) {
    if (messageType === "error") {
      console.log("Page error received: " + messageText);
      consoleErrors.push({
        url: page.url(),
        error: messageText,
      });
    } else if (messageType === "warning") {
      console.log("Page warning received:" + messageText);
      consoleWarnings.push({
        url: page.url(),
        error: messageText,
      });
    }
  }
}

/**
 * Wait for the MCTools app to be fully loaded and ready for interaction.
 * Works in both web and Electron contexts.
 */
export async function waitForAppReady(page: Page, timeoutMs: number = 10000): Promise<boolean> {
  try {
    // Wait for the body to be visible
    await expect(page.locator("body")).toBeVisible({ timeout: timeoutMs });

    // Wait for network to be idle (if supported)
    await page.waitForLoadState("domcontentloaded");

    // Wait a bit for React to finish rendering
    await page.waitForTimeout(1000);

    // Check if we have actual content (not an error page)
    const hasContent = await page.evaluate(() => {
      const body = document.body;
      // Should have more than just error text
      return body.innerText.trim().length > 100;
    });

    return hasContent;
  } catch {
    return false;
  }
}

/**
 * Check if we're on the home page (not in editor).
 */
export async function isOnHomePage(page: Page): Promise<boolean> {
  try {
    // Home page has "New" buttons under project templates
    const newButton = page.getByRole("button", { name: "New" }).first();
    return await newButton.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * Check if we're in the editor interface.
 */
export async function isInEditor(page: Page): Promise<boolean> {
  try {
    // Editor has specific toolbar buttons
    const homeButton = page.getByRole("button", { name: /home/i }).first();
    const viewButton = page.getByRole("button", { name: /view/i }).first();

    const hasHome = await homeButton.isVisible({ timeout: 1000 }).catch(() => false);
    const hasView = await viewButton.isVisible({ timeout: 1000 }).catch(() => false);

    return hasHome || hasView;
  } catch {
    return false;
  }
}

/**
 * Enter the editor by creating a new project.
 * This is the standard workflow to get into the editor interface.
 *
 * @param page - The Playwright page object
 * @returns true if successfully entered the editor
 */
export async function enterEditor(page: Page): Promise<boolean> {
  try {
    // Check if we're already in editor
    if (await isInEditor(page)) {
      console.log("enterEditor: Already in editor");
      return true;
    }

    // Make sure app is ready
    const isReady = await waitForAppReady(page);
    if (!isReady) {
      console.log("enterEditor: App not ready");
      return false;
    }

    // Click "New" button under a project template (first one is usually Add-On Starter)
    const newButton = page.getByRole("button", { name: "New" }).first();

    try {
      await expect(newButton).toBeVisible({ timeout: 10000 });
    } catch {
      console.log("enterEditor: Could not find 'New' button on home page");
      return false;
    }

    console.log("enterEditor: Clicking 'New' button to create project");
    await newButton.click();
    await page.waitForTimeout(1000);

    // Look for and click the "Create Project" button on the project creation dialog
    const createButton = page.getByTestId("submit-button");

    try {
      await expect(createButton).toBeVisible({ timeout: 5000 });
      console.log("enterEditor: Clicking 'Create Project' on project dialog");
      await createButton.click();
    } catch {
      // Fallback: try to find button by text or press Enter
      const createByText = page.locator("button:has-text('Create Project')").first();
      try {
        await expect(createByText).toBeVisible({ timeout: 2000 });
        console.log("enterEditor: Clicking 'Create Project' button (by text)");
        await createByText.click();
      } catch {
        console.log("enterEditor: Could not find Create Project button, trying Enter key");
        await page.keyboard.press("Enter");
      }
    }

    // Wait for editor to load
    await page.waitForTimeout(3000);

    // Verify we're in the editor
    const inEditor = await isInEditor(page);
    if (inEditor) {
      console.log("enterEditor: Successfully entered editor interface");
      return true;
    }

    console.log("enterEditor: Could not verify editor interface loaded");
    return false;
  } catch (error) {
    console.log(`enterEditor: Error entering editor - ${error}`);
    return false;
  }
}

/**
 * Navigate back to the home page from the editor.
 */
export async function goToHome(page: Page): Promise<boolean> {
  try {
    // If already on home, we're done
    if (await isOnHomePage(page)) {
      return true;
    }

    // Click the Home button in the editor toolbar
    const homeButton = page.getByRole("button", { name: /home/i }).first();

    if (await homeButton.isVisible({ timeout: 2000 })) {
      await homeButton.click();
      await page.waitForTimeout(2000);
      return await isOnHomePage(page);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Open the Add menu in the editor to see available item types.
 */
export async function openAddMenu(page: Page): Promise<boolean> {
  try {
    // The Add button has content="Add" and icon with faPlus
    // Try multiple selectors to find it
    const addButton = page
      .locator("button:has-text('Add')")
      .filter({ hasNot: page.locator("text='Add-On'") }) // Exclude "Add-On" text
      .first();

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click();
      await page.waitForTimeout(500);
      return true;
    }

    // Fallback: look for button with plus icon in the project list area
    const plusButton = page.locator(".pab-outer button").first();
    if (await plusButton.isVisible({ timeout: 2000 })) {
      await plusButton.click();
      await page.waitForTimeout(500);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Select an item from the project item list by name.
 */
export async function selectProjectItem(page: Page, itemName: string): Promise<boolean> {
  try {
    // Look for the item in the list
    const item = page.locator(`[role='option']:has-text('${itemName}')`).first();

    if (await item.isVisible({ timeout: 3000 })) {
      await item.click();
      await page.waitForTimeout(500);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the count of project items in the list.
 */
export async function getProjectItemCount(page: Page): Promise<number> {
  try {
    const items = page.locator("[role='option']");
    return await items.count();
  } catch {
    return 0;
  }
}

/**
 * Check if a specific toolbar button is visible.
 */
export async function hasToolbarButton(page: Page, buttonName: string): Promise<boolean> {
  try {
    const button = page.getByRole("button", { name: new RegExp(buttonName, "i") }).first();
    return await button.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * Take a screenshot with a descriptive name.
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  folder: string = "debugoutput/screenshots"
): Promise<void> {
  await page.screenshot({
    path: `${folder}/${name}.png`,
    fullPage: true,
  });
}
