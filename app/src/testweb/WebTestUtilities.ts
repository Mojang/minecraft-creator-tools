import { ConsoleMessage, Page, expect, Request } from "@playwright/test";

// List of ignorable messages
const ignorableTokens = [
  "CSSinJS Debug data collection is disabled",
  "You are running Fela in production mode.",
  "is deprecated in StrictMode",
  "No content for file", // Normal during project loading when files haven't been saved yet
  "renderingGroupId of an instanced mesh", // BabylonJS informational note
  "validateDOMNesting", // React DOM nesting warnings - not critical for functionality
  'unique "key" prop', // React key warnings - tracked separately as tech debt
  "Encountered two children with the same key", // React duplicate key warning
  "404 (Not Found)", // Map viewer may request textures that don't exist for certain block types
  "Support for defaultProps will be removed", // React 18 deprecation warning from FluentUI Northstar
  "findDOMNode is deprecated", // React 18 deprecation warning from FluentUI Northstar
  "with both value and defaultValue props", // MUI controlled/uncontrolled input warnings
  "getDerivedStateFromProps", // React class component lifecycle warning
  "Invalid prop `value` supplied to", // MUI TextareaAutosize prop type warning
  "not yet mounted", // React setState on unmounted component warning
];

// URL patterns that are expected to 404 and can be safely ignored
const ignorable404Patterns = [
  /\/res\/latest\/van\/serve\/resource_pack\/textures\/blocks\//, // Map viewer block textures
  /\/textures\/.*_carried\.png$/, // Carried item textures (inventory display variants)
  /\.map$/, // Source maps
  /\/api\/worldContent\/\d+\/world\/db\//, // LevelDB files that may not exist for new worlds
];

export type ThemeMode = "light" | "dark";

export function isIgnorableMessage(message: string): boolean {
  return ignorableTokens.some((ignorable) => message.indexOf(ignorable) >= 0);
}

/**
 * Check if a 404 URL is expected/ignorable (e.g., optional textures for map viewer)
 */
export function isIgnorable404Url(url: string): boolean {
  return ignorable404Patterns.some((pattern) => pattern.test(url));
}

/**
 * Extract a short component hint from the URL path for better error context.
 * This helps identify which UX component is requesting the resource.
 */
export function getComponentHintFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Map viewer texture requests
    if (path.includes("/textures/blocks/")) {
      return "[MapViewer:BlockTexture]";
    }
    if (path.includes("/textures/items/")) {
      return "[MapViewer:ItemTexture]";
    }
    if (path.includes("/textures/entity/")) {
      return "[EntityViewer:Texture]";
    }
    if (path.includes("/terrain_texture.json")) {
      return "[MapViewer:TerrainAtlas]";
    }

    // Data/form requests
    if (path.includes("/data/forms/")) {
      return "[DataForm:Schema]";
    }
    if (path.includes("/data/schemas/")) {
      return "[Validator:Schema]";
    }

    // Web app resources
    if (path.includes("/app/")) {
      return "[WebApp:Bundle]";
    }
    if (path.includes("/res/")) {
      return "[Resource:Asset]";
    }

    // API requests
    if (path.includes("/api/")) {
      return "[API:Endpoint]";
    }

    return "[Unknown]";
  } catch {
    return "[InvalidURL]";
  }
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
 * Information about a failed network request
 */
export interface FailedRequest {
  url: string;
  status: number;
  statusText: string;
  componentHint: string;
  resourceType: string;
}

/**
 * Sets up request failure tracking on a page.
 * This captures 404s and other failed requests with full URL and component context.
 *
 * @param page - The Playwright page object
 * @param failedRequests - Array to collect failed requests
 * @param options - Options for filtering
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```typescript
 * const failedRequests: FailedRequest[] = [];
 * const cleanup = setupRequestFailureTracking(page, failedRequests);
 *
 * // ... run test ...
 *
 * // Check for unexpected failures
 * const unexpectedFailures = failedRequests.filter(r => !isIgnorable404Url(r.url));
 * expect(unexpectedFailures).toHaveLength(0);
 *
 * cleanup();
 * ```
 */
export function setupRequestFailureTracking(
  page: Page,
  failedRequests: FailedRequest[],
  options: { logAll?: boolean; logIgnored?: boolean } = {}
): () => void {
  const { logAll = false, logIgnored = false } = options;

  const onResponse = (response: {
    url: () => string;
    status: () => number;
    statusText: () => string;
    request: () => Request;
  }) => {
    const status = response.status();
    if (status >= 400) {
      const url = response.url();
      const componentHint = getComponentHintFromUrl(url);
      const resourceType = response.request().resourceType();
      const isIgnored = isIgnorable404Url(url);

      const failedRequest: FailedRequest = {
        url,
        status,
        statusText: response.statusText(),
        componentHint,
        resourceType,
      };

      failedRequests.push(failedRequest);

      // Log based on options
      if (logAll || (logIgnored && isIgnored) || (!isIgnored && !logAll)) {
        const prefix = isIgnored ? "[Ignored] " : "";
        console.log(`${prefix}Request failed: ${componentHint} ${status} ${url}`);
      }
    }
  };

  page.on("response", onResponse);

  // Return cleanup function
  return () => {
    page.off("response", onResponse);
  };
}

/**
 * Get a summary of failed requests, grouped by component and status
 */
export function summarizeFailedRequests(failedRequests: FailedRequest[]): string {
  if (failedRequests.length === 0) {
    return "No failed requests";
  }

  const byComponent = new Map<string, FailedRequest[]>();
  for (const req of failedRequests) {
    const key = `${req.componentHint} (${req.status})`;
    if (!byComponent.has(key)) {
      byComponent.set(key, []);
    }
    byComponent.get(key)!.push(req);
  }

  const lines: string[] = [`Failed requests summary (${failedRequests.length} total):`];
  for (const [key, reqs] of byComponent) {
    lines.push(`  ${key}: ${reqs.length} requests`);
    // Show first few URLs as examples
    const examples = reqs.slice(0, 3);
    for (const req of examples) {
      const shortUrl = req.url.length > 80 ? "..." + req.url.slice(-77) : req.url;
      lines.push(`    - ${shortUrl}`);
    }
    if (reqs.length > 3) {
      lines.push(`    ... and ${reqs.length - 3} more`);
    }
  }

  return lines.join("\n");
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

export async function preferBrowserStorageInProjectDialog(page: Page): Promise<void> {
  const browserStorageRadio = page.getByRole("radio", { name: /Browser|This Browser/i }).first();

  if (await browserStorageRadio.isVisible({ timeout: 1500 }).catch(() => false)) {
    await browserStorageRadio.scrollIntoViewIfNeeded().catch(() => {});
    await browserStorageRadio.check({ force: true });
    await page.waitForTimeout(250);
    console.log("preferBrowserStorageInProjectDialog: Selected Browser Storage for automated test flow");
  }
}

export function getExportToolbarButton(page: Page) {
  return page.getByRole("button", { name: /^(Share|Export)( \(.+\))?$/i }).first();
}

export function getTestToolbarButton(page: Page) {
  return page.getByRole("button", { name: /^(Run|Test)$/i }).first();
}

export async function waitForEditorReady(page: Page, timeoutMs: number = 15000): Promise<boolean> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const indicators = [
      page.locator('[aria-label="Project Editor main toolbar"]').first(),
      page.locator(".pe-toolbar, .pe-toolbar-compact").first(),
      page.getByRole("button", { name: "Save" }).first(),
      page.getByRole("button", { name: "View" }).first(),
      getExportToolbarButton(page),
      getTestToolbarButton(page),
      page
        .locator("h2")
        .filter({ hasText: /Getting Started|Export Project|Test in Minecraft/i })
        .first(),
      page
        .locator("button, .pact-cardTitle")
        .filter({
          hasText:
            /Download .*Minecraft \(\.mcaddon\)|Save project files to a folder|flat test world|regular project world/i,
        })
        .first(),
    ];

    for (const indicator of indicators) {
      if (await indicator.isVisible({ timeout: 750 }).catch(() => false)) {
        return true;
      }
    }

    await page.waitForTimeout(250);
  }

  return false;
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
export async function enterEditor(
  page: Page,
  themeModeOrOptions?: ThemeMode | { theme?: ThemeMode; editMode?: EditModePreference }
): Promise<boolean> {
  // Normalize arguments: support both old signature (themeMode) and new options object
  let themeMode: ThemeMode | undefined;
  let editMode: EditModePreference = "focused";

  if (typeof themeModeOrOptions === "string") {
    themeMode = themeModeOrOptions;
  } else if (themeModeOrOptions) {
    themeMode = themeModeOrOptions.theme;
    editMode = themeModeOrOptions.editMode ?? "focused";
  }

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
    const newButton = page.getByRole("button", { name: "Create New" }).first();

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
    await preferBrowserStorageInProjectDialog(page);

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
    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    // Now that the editor is loaded, the FRE panel should be visible.
    // Select the desired editing mode (Focused/Full/Raw) before verifying UI.
    await selectEditMode(page, editMode);

    if (await waitForEditorReady(page, 15000)) {
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

/**
 * Alias for isInEditor() with a more consistent name.
 *
 * @param page - The Playwright page object
 * @returns true if in editor, false otherwise
 */
export async function verifyInEditor(page: Page): Promise<boolean> {
  return isInEditor(page);
}

/**
 * The editing mode preference: focused (simplified), full (all files visible), or raw (JSON editing).
 */
export type EditModePreference = "focused" | "full" | "raw";

/**
 * Selects a specific editing mode on the First Run Experience panel.
 *
 * This is the primary way to set the editing mode in tests. It:
 * 1. Looks for the FRE panel's mode buttons ("Focused", "Full", "Raw")
 * 2. Clicks the requested mode
 * 3. Dismisses the panel via the close button
 *
 * @param page - The Playwright page object
 * @param mode - The editing mode to select ("focused", "full", or "raw")
 * @returns true if mode was selected, false if FRE panel wasn't found
 */
export async function selectEditMode(page: Page, mode: EditModePreference = "focused"): Promise<boolean> {
  try {
    // Map mode to the button label text
    const modeLabel = mode === "focused" ? "Focused" : mode === "full" ? "Full" : "Raw";

    // First close any open menus by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Use specific FRE panel button selector for reliable clicks
    const modeButton = page.locator(`button.frp-option:has-text("${modeLabel}")`).first();
    if (await modeButton.isVisible({ timeout: 2000 })) {
      await modeButton.click();
      console.log(`selectEditMode: Selected ${modeLabel} mode`);
      // Wait for preference change to propagate through React re-render cycle
      await page.waitForTimeout(1000);

      // Dismiss the panel via close button
      const closeButton = page
        .locator('[aria-label="Dismiss welcome panel"], [aria-label="Close"], button:has-text("×")')
        .first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        console.log("selectEditMode: Dismissed welcome panel");
        await page.waitForTimeout(500);
      }

      // Close any lingering menus
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      return true;
    }

    // Fallback: use View menu to switch mode (works when FRE panel is not shown)
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    if (await viewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(500);

      const modeMenuItem = page.locator(`text="${modeLabel} Mode"`).first();
      if (await modeMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modeMenuItem.click();
        console.log(`selectEditMode: Selected ${modeLabel} mode via View menu`);
        await page.waitForTimeout(1000);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        return true;
      }

      // Close the menu if the item wasn't found
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // Fallback: try generic text selector (for backwards compatibility)
    const modeButtonFallback = page.locator(`text="${modeLabel}"`).first();
    if (await modeButtonFallback.isVisible({ timeout: 1000 })) {
      await modeButtonFallback.click();
      console.log(`selectEditMode: Selected ${modeLabel} mode (fallback)`);
      await page.waitForTimeout(1000);

      const closeButton = page
        .locator('[aria-label="Dismiss welcome panel"], [aria-label="Close"], button:has-text("×")')
        .first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        console.log("selectEditMode: Dismissed welcome panel");
        await page.waitForTimeout(500);
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      return true;
    }

    // Try the "Don't show this again" checkbox as fallback dismissal
    const dontShowCheckbox = page.locator("text=Don't show this again").first();
    if (await dontShowCheckbox.isVisible({ timeout: 1000 })) {
      await dontShowCheckbox.click();
      console.log("selectEditMode: Dismissed via 'Don't show this again'");
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      return true;
    }

    console.log("selectEditMode: No welcome panel found (may already be dismissed)");
    await page.keyboard.press("Escape");
    return false;
  } catch {
    console.log("selectEditMode: Error while trying to select mode");
    return false;
  }
}

/**
 * Convenience wrapper to select Focused (simplified) editing mode.
 * This is the default mode that matches the first-time user experience.
 */
export async function ensureFocusedMode(page: Page): Promise<boolean> {
  return selectEditMode(page, "focused");
}

/**
 * Convenience wrapper to select Full editing mode.
 * Use this when tests need to see all files including manifests and advanced items.
 */
export async function ensureFullMode(page: Page): Promise<boolean> {
  return selectEditMode(page, "full");
}

/**
 * Dismisses the welcome dialog if it appears.
 *
 * The welcome dialog typically appears after creating a new project and
 * contains a "Don't Show Again" checkbox and options for editing experience.
 *
 * NOTE: This now defaults to Focused mode (matching the product default)
 * instead of potentially falling through to Raw mode. If your test needs
 * Full or Raw mode, use selectEditMode(page, 'full') or selectEditMode(page, 'raw') instead.
 *
 * @param page - The Playwright page object
 * @returns true if dialog was dismissed, false if no dialog found
 */
export async function dismissWelcomeDialog(page: Page): Promise<boolean> {
  return selectEditMode(page, "focused");
}

/**
 * Enables visibility of all file types in the project tree.
 *
 * By default, many file types (like manifest.json) are hidden. This function
 * clicks the "Show" button to open the dropdown, then selects
 * "All Single Files (Advanced)" to reveal all files.
 *
 * @param page - The Playwright page object
 * @returns true if all files were enabled, false otherwise
 */
export async function enableAllFileTypes(page: Page): Promise<boolean> {
  try {
    // First, look for the "Show" button and click it to open the dropdown
    const showButton = page.locator('button:has-text("Show")').first();

    if (await showButton.isVisible({ timeout: 2000 })) {
      await showButton.click();
      console.log("enableAllFileTypes: Opened Show dropdown");

      // Wait for the MUI Menu popover to appear
      const menuPopover = page.locator(".MuiPopover-root, .MuiModal-root");
      await menuPopover
        .first()
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      // Scope menu item search to the MUI Menu list to avoid matching page content
      const menuList = page.locator(".MuiList-root, .MuiMenu-list");
      const allFilesOption = menuList.getByRole("menuitem", { name: "All Single Files (Advanced)" });
      if (await allFilesOption.isVisible({ timeout: 2000 })) {
        await allFilesOption.click();
        console.log("enableAllFileTypes: Selected 'All Single Files (Advanced)'");
      } else {
        // Fallback: try simpler text match within menu
        const allFilesSimple = menuList.locator('li:has-text("All Single Files")');
        if (await allFilesSimple.isVisible({ timeout: 1000 })) {
          await allFilesSimple.click();
          console.log("enableAllFileTypes: Selected 'All Single Files'");
        } else {
          // "All Single Files" only exists in Focused/Summarized mode — close menu gracefully
          await page.keyboard.press("Escape");
          console.log("enableAllFileTypes: 'All Single Files' not in menu (may be in Full mode where it's not needed)");
          await page.waitForTimeout(300);
          return true;
        }
      }

      // Wait for MUI Menu popover to fully close
      await menuPopover
        .first()
        .waitFor({ state: "detached", timeout: 5000 })
        .catch(async () => {
          console.log("enableAllFileTypes: Menu did not auto-close, pressing Escape");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        });

      // Ensure no MUI backdrop remains
      await expect(page.locator(".MuiBackdrop-root"))
        .toHaveCount(0, { timeout: 3000 })
        .catch(async () => {
          console.log("enableAllFileTypes: MUI backdrop still present, pressing Escape");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        });

      await page.waitForTimeout(300);
      return true;
    }

    console.log("enableAllFileTypes: Show button not found");
    return false;
  } catch (error) {
    console.log(`enableAllFileTypes: Error - ${error}`);
    // Emergency cleanup: press Escape to close any open menus
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    return false;
  }
}

/**
 * Opens a file in the Monaco editor by clicking it in the project tree.
 *
 * @param page - The Playwright page object
 * @param fileNameOrPattern - Part of the file name to search for (case-insensitive)
 * @returns true if file was opened successfully, false otherwise
 */
export async function openFileInMonaco(page: Page, fileNameOrPattern: string): Promise<boolean> {
  try {
    // First try to expand any collapsed sections
    const sectionHeader = page
      .locator(`text="${fileNameOrPattern}"`)
      .or(page.locator(`:text-matches("${fileNameOrPattern}", "i")`))
      .first();

    // Different locator strategies for finding files
    // The project tree uses various element types - try text matching first
    const selectors = [
      `text="${fileNameOrPattern}"`, // Exact text match
      `:text-matches("${fileNameOrPattern}", "i")`, // Case-insensitive match
      `[title*="${fileNameOrPattern}" i]`, // Title attribute match
      `*:has-text("${fileNameOrPattern}")`, // Any element with text
    ];

    for (const selector of selectors) {
      try {
        const fileItem = page.locator(selector).first();
        if (await fileItem.isVisible({ timeout: 1500 })) {
          // Scroll element into view if needed
          await fileItem.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);

          await fileItem.click();
          console.log(`openFileInMonaco: Clicked on file matching "${fileNameOrPattern}" (selector: ${selector})`);
          await page.waitForTimeout(1500);

          // Verify Monaco editor appeared
          const monacoEditor = page.locator(".monaco-editor").first();
          if (await monacoEditor.isVisible({ timeout: 3000 })) {
            console.log("openFileInMonaco: Monaco editor is now visible");
            return true;
          } else {
            console.log("openFileInMonaco: File clicked but Monaco editor not visible - may be using form editor");
            // File was clicked but Monaco not visible - might be using a form-based editor
            return true; // Still return true since file was opened
          }
        }
      } catch {
        // Try next selector
        continue;
      }
    }

    console.log(`openFileInMonaco: Could not find file matching "${fileNameOrPattern}".`);
    return false;
  } catch (error) {
    console.log(`openFileInMonaco: Error opening file - ${error}`);
    return false;
  }
}

/**
 * Switches from form-based editor to Raw/Monaco text editor.
 *
 * Some JSON files (like entities, items) have a form-based editor by default.
 * This function clicks the "Raw" or "JSON" tab to switch to the Monaco editor.
 *
 * @param page - The Playwright page object
 * @returns true if switched to raw mode, false otherwise
 */
export async function switchToRawMode(page: Page): Promise<boolean> {
  try {
    // Look for Raw/JSON tab buttons
    const rawButtons = [
      page.locator("button:has-text('Raw')").first(),
      page.locator("button:has-text('JSON')").first(),
      page.locator("[aria-label='Raw']").first(),
      page.locator(".tab-item:has-text('Raw')").first(),
    ];

    for (const button of rawButtons) {
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        console.log("switchToRawMode: Clicked Raw/JSON tab");
        await page.waitForTimeout(1000);

        // Verify Monaco editor appeared
        const monacoEditor = page.locator(".monaco-editor").first();
        if (await monacoEditor.isVisible({ timeout: 3000 })) {
          console.log("switchToRawMode: Monaco editor is now visible");
          return true;
        }
      }
    }

    // If no raw button found, Monaco might already be visible
    const monacoEditor = page.locator(".monaco-editor").first();
    if (await monacoEditor.isVisible({ timeout: 1000 })) {
      console.log("switchToRawMode: Already in raw mode (Monaco visible)");
      return true;
    }

    console.log("switchToRawMode: Could not switch to raw mode");
    return false;
  } catch (error) {
    console.log(`switchToRawMode: Error - ${error}`);
    return false;
  }
}

/**
 * Takes a screenshot and saves it to the specified path.
 *
 * @param page - The Playwright page object
 * @param basePath - The base path for the screenshot (without extension)
 */
export async function takeScreenshot(page: Page, basePath: string): Promise<void> {
  const path = basePath.endsWith(".png") ? basePath : `${basePath}.png`;
  await page.screenshot({ path });
  console.log(`takeScreenshot: Saved screenshot to ${path}`);
}

/**
 * Complete setup to get a JSON file open in Monaco editor.
 *
 * This is a high-level utility that combines all the steps:
 * 1. Enter editor (create project)
 * 2. Dismiss welcome dialog
 * 3. Enable all file types visibility
 * 4. Open specified file
 * 5. Switch to Raw mode (Monaco editor)
 *
 * @param page - The Playwright page object
 * @param filePattern - Part of the file name to open
 * @param options - Additional options
 * @returns true if Monaco editor is open with the file, false otherwise
 */
export async function setupJsonEditor(
  page: Page,
  filePattern: string = "manifest",
  options: {
    themeMode?: ThemeMode;
    takeScreenshots?: boolean;
    screenshotDir?: string;
    editMode?: EditModePreference;
  } = {}
): Promise<boolean> {
  const { themeMode, takeScreenshots = false, screenshotDir = "debugoutput/screenshots", editMode = "full" } = options;

  // Step 1: Enter editor
  const entered = await enterEditor(page, themeMode);
  if (!entered) {
    console.log("setupJsonEditor: Failed to enter editor");
    if (takeScreenshots) {
      await takeScreenshot(page, `${screenshotDir}/setup-failed-enter`);
    }
    return false;
  }

  // Step 2: Select editing mode (defaults to Full for JSON editing)
  await selectEditMode(page, editMode);

  // Step 3: Enable all file types
  await enableAllFileTypes(page);
  await page.waitForTimeout(500);

  if (takeScreenshots) {
    await takeScreenshot(page, `${screenshotDir}/setup-files-visible`);
  }

  // Step 4: Open the specified file
  const opened = await openFileInMonaco(page, filePattern);
  if (!opened) {
    console.log(`setupJsonEditor: Failed to open file "${filePattern}"`);
    if (takeScreenshots) {
      await takeScreenshot(page, `${screenshotDir}/setup-failed-open`);
    }
    return false;
  }

  // Step 5: Switch to Raw mode
  const rawMode = await switchToRawMode(page);

  if (takeScreenshots) {
    await takeScreenshot(page, `${screenshotDir}/setup-complete`);
  }

  if (!rawMode) {
    console.log("setupJsonEditor: Failed to switch to raw mode");
    return false;
  }

  console.log(`setupJsonEditor: Successfully opened "${filePattern}" in Monaco editor`);
  return true;
}
