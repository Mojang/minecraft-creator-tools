import { ConsoleMessage, Page, expect } from "@playwright/test";

// List of ignorable messages
const ignorableTokens = [
  "CSSinJS Debug data collection is disabled",
  "You are running Fela in production mode.",
  "is deprecated in StrictMode",
  "No content for file", // Normal during project loading when files haven't been saved yet
  "renderingGroupId of an instanced mesh", // BabylonJS informational note
  "validateDOMNesting", // React DOM nesting warnings - not critical for functionality
];

export type ThemeMode = "light" | "dark";

export function isIgnorableMessage(message: string): boolean {
  return ignorableTokens.some((ignorable) => message.indexOf(ignorable) >= 0);
}

export function processMessage(
  msg: ConsoleMessage,
  page: Page,
  consoleErrors: { url: string; error: string }[],
  consoleWarnings: { url: string; error: string }[]
) {
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
 * Navigates to the home page with a specific theme mode.
 *
 * Uses the URL parameter `theme=l` for light mode or `theme=d` for dark mode.
 * Note: FluentUI Northstar theme is set on page load, so navigating with
 * the theme parameter is the reliable way to test specific themes.
 *
 * @param page - The Playwright page object
 * @param mode - The theme mode to use ("light" or "dark")
 * @param path - Optional path to navigate to (defaults to "/")
 */
export async function gotoWithTheme(page: Page, mode: ThemeMode, path: string = "/"): Promise<void> {
  const themeParam = mode === "light" ? "theme=l" : "theme=d";
  const separator = path.includes("?") ? "&" : "?";
  const url = `${path}${separator}${themeParam}`;

  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

/**
 * Enters the editor by creating a new project.
 *
 * This is the standard way to get into the editor interface:
 * 1. Click the "New" button under a project template (e.g., Add-On Starter)
 * 2. Fill out the project dialog and click "Create Project"
 * 3. Wait for the editor to load
 *
 * @param page - The Playwright page object
 * @param themeMode - Optional theme mode to use ("light" or "dark"). If not specified, uses default.
 * @returns true if successfully entered the editor, false otherwise
 */
export async function enterEditor(page: Page, themeMode?: ThemeMode): Promise<boolean> {
  try {
    // Make sure we're on the home page with the right theme
    if (themeMode) {
      await gotoWithTheme(page, themeMode, "/");
    } else {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
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
    // The button has data-testid="submit-button" and text "Create Project"
    const createButton = page.getByTestId("submit-button");

    try {
      await expect(createButton).toBeVisible({ timeout: 5000 });
      console.log("enterEditor: Clicking 'Create Project' on project dialog");
      await createButton.click();
    } catch {
      // Fallback: try to find button by text
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

    // Wait for editor to load - give it more time as project creation can be slow
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle");

    // Verify we're in the editor by checking for the Project Editor main toolbar
    // The toolbar has aria-label="Project Editor main toolbar" or class "pe-toolbar"
    const editorToolbar = page.locator('[aria-label="Project Editor main toolbar"]');
    const editorToolbarByClass = page.locator(".pe-toolbar, .pe-toolbar-compact");

    try {
      // Try the aria-label first
      await expect(editorToolbar).toBeVisible({ timeout: 10000 });
      console.log("enterEditor: Successfully entered editor interface (found toolbar by aria-label)");
      return true;
    } catch {
      // Fall back to class-based selector
      try {
        await expect(editorToolbarByClass.first()).toBeVisible({ timeout: 5000 });
        console.log("enterEditor: Successfully entered editor interface (found toolbar by class)");
        return true;
      } catch {
        // Last resort: check for Home button which is always in editor toolbar
        const homeButton = page.getByRole("button", { name: /home/i }).first();
        try {
          await expect(homeButton).toBeVisible({ timeout: 3000 });
          console.log("enterEditor: Successfully entered editor interface (found Home button)");
          return true;
        } catch {
          console.log("enterEditor: Could not verify editor interface loaded");
          return false;
        }
      }
    }
  } catch (error) {
    console.log(`enterEditor: Error entering editor - ${error}`);
    return false;
  }
}

/**
 * Checks if the page is currently showing the editor interface.
 *
 * @param page - The Playwright page object
 * @returns true if in editor, false otherwise
 */
export async function isInEditor(page: Page): Promise<boolean> {
  try {
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    return await viewButton.isVisible({ timeout: 1000 });
  } catch {
    return false;
  }
}
