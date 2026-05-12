/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - SHARED HELPERS
 * ==========================================================================================
 *
 * Common helper functions and utilities for VS Code web extension testing.
 * Import these helpers in your test files to avoid code duplication.
 *
 * ==========================================================================================
 */

import { Page, Frame, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Screenshot directory
const SCREENSHOT_DIR = path.join(__dirname, "../../debugoutput/screenshots/vscweb");

// Ensure screenshot directory exists
export function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/**
 * Wait for VS Code to fully load and be ready for interaction
 */
export async function waitForVSCodeReady(page: Page, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 30000;

  // Wait for the main workbench to be visible
  await page.waitForSelector(".monaco-workbench", { timeout });

  // Wait for activity bar (indicates UI is loaded)
  await page.waitForSelector(".activitybar", { timeout: 10000 });

  // Wait for sidebar to be present
  await page.waitForSelector(".sidebar", { timeout: 10000 });

  // Give extensions time to activate
  await page.waitForTimeout(3000);
}

/**
 * Check if the MCTools extension activated without errors
 */
export async function checkExtensionActivated(page: Page): Promise<boolean> {
  // Check for error notifications
  const errorToast = page.locator(".notifications-toasts .notification-toast.error");
  const hasError = (await errorToast.count()) > 0;

  if (hasError) {
    const errorText = await errorToast.first().textContent();
    console.error("Extension error notification:", errorText);
    return false;
  }

  return true;
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  ensureScreenshotDir();
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

/**
 * Open the Command Palette
 */
export async function openCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press("F1");
  await page.waitForTimeout(500);

  const commandPalette = page.locator(".quick-input-widget");
  await expect(commandPalette).toBeVisible({ timeout: 5000 });
}

/**
 * Close the Command Palette
 */
export async function closeCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/**
 * Search for a command in Command Palette and return result count
 */
export async function searchCommand(page: Page, searchText: string): Promise<number> {
  await openCommandPalette(page);
  await page.keyboard.type(searchText, { delay: 50 });
  await page.waitForTimeout(800);

  const results = page.locator(".quick-input-list .monaco-list-row");
  return await results.count();
}

/**
 * Execute a command from Command Palette
 */
export async function executeCommand(page: Page, commandTitle: string): Promise<void> {
  await openCommandPalette(page);
  await page.keyboard.type(commandTitle, { delay: 50 });
  await page.waitForTimeout(800);

  const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
  if ((await firstResult.count()) > 0) {
    await firstResult.click();
  }

  await page.waitForTimeout(1500);
}

/**
 * Click on an activity bar item by title pattern
 */
export async function clickActivityBarItem(page: Page, titlePattern: string): Promise<boolean> {
  const activityItem = page
    .locator(
      `.activitybar .action-item[aria-label*="${titlePattern}"], .activitybar .action-item[title*="${titlePattern}"]`
    )
    .first();

  if ((await activityItem.count()) > 0) {
    await activityItem.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

/**
 * Get all activity bar item labels
 */
export async function getActivityBarItems(page: Page): Promise<string[]> {
  const items = page.locator(".activitybar .action-item");
  const labels: string[] = [];

  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const label = await items.nth(i).getAttribute("aria-label");
    if (label) {
      labels.push(label);
    }
  }
  return labels;
}

/**
 * Open the Explorer view
 */
export async function openExplorer(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+E");
  await page.waitForTimeout(1500);
}

/**
 * Expand folders and navigate to a file in the Explorer.
 * Uses double-click to expand folders and waits for children to appear.
 *
 * IMPORTANT: VS Code uses "compact folders" - when a folder has only one child,
 * they display together on one row like "behavior_packs \ diverse_bp".
 * This function handles both compact and non-compact folder structures.
 */
export async function navigateToFile(page: Page, filePath: string[]): Promise<boolean> {
  await openExplorer(page);
  await page.waitForTimeout(1000);

  let currentPathIndex = 0;

  while (currentPathIndex < filePath.length) {
    const item = filePath[currentPathIndex];
    const isLastItem = currentPathIndex === filePath.length - 1;

    // Find the item in the tree - use :has-text which is more reliable
    let treeItem = page.locator(`.monaco-list-row:has-text("${item}")`).first();

    if ((await treeItem.count()) === 0) {
      // Wait and retry once
      await page.waitForTimeout(1000);
      treeItem = page.locator(`.monaco-list-row:has-text("${item}")`).first();
      if ((await treeItem.count()) === 0) {
        console.log(`Could not find tree item: ${item}`);
        return false;
      }
    }

    // Check if this row contains multiple path segments (compact folder display)
    // VS Code shows "folder1 \ folder2" on one row when folder1 only has folder2 as child
    const rowText = await treeItem.textContent();
    let segmentsInRow = 1;
    for (let j = currentPathIndex + 1; j < filePath.length; j++) {
      if (rowText && rowText.includes(filePath[j])) {
        segmentsInRow++;
      } else {
        break;
      }
    }

    // Skip ahead by the segments we found in this row
    currentPathIndex += segmentsInRow;

    // Is this the final target (a file we want to open)?
    const isAtFinalTarget = currentPathIndex >= filePath.length;

    // First click to select the row
    await treeItem.click();
    await page.waitForTimeout(200);

    if (isAtFinalTarget && isLastItem) {
      // This is the file - double-click to open it
      await treeItem.dblclick();
    } else {
      // This is a folder - use Right Arrow key to expand (more reliable than double-click)
      // First ensure it's expanded by pressing Right Arrow
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(800);
    }
  }

  await page.waitForTimeout(1500);
  return true;
}

/**
 * Check if a webview editor is visible (custom editor)
 */
export async function isWebviewEditorVisible(page: Page): Promise<boolean> {
  const webviewFrame = page.locator(
    'iframe[class*="webview"], .webview-container, [data-keybinding-context*="webview"]'
  );
  return (await webviewFrame.count()) > 0;
}

/**
 * Check if Monaco text editor is visible
 */
export async function isMonacoEditorVisible(page: Page): Promise<boolean> {
  const monacoEditor = page.locator(".monaco-editor .view-lines");
  return (await monacoEditor.count()) > 0;
}

/**
 * Find an MCTools webview frame
 */
export async function findWebviewFrame(page: Page): Promise<Frame | null> {
  await page.waitForTimeout(2000);

  const frames = page.frames();

  for (const frame of frames) {
    const url = frame.url();
    if (url.includes("webview") || url.includes("vscode-webview")) {
      const hasContent = await frame.locator(".ct-outer, .pe-grid, [class*='project']").count();
      if (hasContent > 0) {
        return frame;
      }
    }
  }

  return null;
}

/**
 * Wait for MCTools webview content to load
 */
export async function waitForWebviewContent(page: Page, timeout = 10000): Promise<Frame | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const frame = await findWebviewFrame(page);
    if (frame) {
      return frame;
    }
    await page.waitForTimeout(500);
  }

  return null;
}

/**
 * Count editor tabs
 */
export async function getEditorTabCount(page: Page): Promise<number> {
  const tabs = page.locator(".tabs-container .tab");
  return await tabs.count();
}

/**
 * Close all editors using command palette (more reliable than keyboard shortcuts)
 */
export async function closeAllEditors(page: Page): Promise<void> {
  // Use command palette to close all editors - more reliable than keyboard shortcuts
  await page.keyboard.press("F1");
  await page.waitForTimeout(300);
  await page.keyboard.type("Close All Editors", { delay: 30 });
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
}

/**
 * Dismiss any visible notifications
 */
export async function dismissNotifications(page: Page): Promise<void> {
  const closeButtons = page.locator(".notifications-toasts .codicon-close");
  const count = await closeButtons.count();

  for (let i = 0; i < count; i++) {
    await closeButtons.first().click();
    await page.waitForTimeout(200);
  }
}

/**
 * Wait for an element and return whether it appeared
 */
export async function waitForElement(page: Page, selector: string, options?: { timeout?: number }): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: options?.timeout ?? 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get console errors from the page
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  return errors;
}

/**
 * Subscribe to every channel that can surface a runtime failure inside the VS Code
 * workbench OR any embedded webview iframe, and append messages into a shared array.
 *
 * Captures:
 *  - `console.error` from any frame (Playwright fires `page.on('console')` for frames too)
 *  - Uncaught exceptions via `page.on('pageerror')`
 *  - Extension-surfaced info/warning/error notifications whose text starts with
 *    "Webview:" — these are produced by MCT's `logMessage` -> `showInformationMessage`
 *    pipeline in ExtensionManager, which is how our client-side error handlers in
 *    `vscwebindex.tsx` get errors out of the webview and into the host.
 *
 * The returned `errors` array is populated asynchronously as the page runs. The
 * returned `assertNoErrors` helper is intended for use at the end of a test:
 *
 *   const { errors, assertNoErrors } = collectAllWebviewErrors(page);
 *   await doStuff(page);
 *   assertNoErrors();
 *
 * The `ignorePatterns` parameter lets tests whitelist known-benign noise (e.g.
 * monaco worker rejections, favicon 404s).
 */
export function collectAllWebviewErrors(
  page: Page,
  ignorePatterns: (string | RegExp)[] = []
): {
  errors: string[];
  assertNoErrors: (context?: string) => void;
} {
  const errors: string[] = [];

  const isIgnored = (msg: string) =>
    ignorePatterns.some((p) => (typeof p === "string" ? msg.includes(p) : p.test(msg)));

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!isIgnored(text)) {
        errors.push("[console.error] " + text);
      }
    }
  });

  page.on("pageerror", (err) => {
    const text = (err && (err.stack || err.message)) || String(err);
    if (!isIgnored(text)) {
      errors.push("[pageerror] " + text);
    }
  });

  const assertNoErrors = (context?: string) => {
    if (errors.length === 0) return;
    const header = context ? `Unexpected errors during "${context}":` : "Unexpected errors:";
    const detail = errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
    throw new Error(`${header}\n${detail}`);
  };

  return { errors, assertNoErrors };
}

/**
 * Collect any VS Code notifications whose visible text matches the given predicate.
 * MCT surfaces uncaught webview errors via `showInformationMessage("Webview: ...")`
 * from the extension host; this helper asserts none of those have appeared.
 */
export async function assertNoMctErrorNotifications(page: Page): Promise<void> {
  const toasts = page.locator(".notifications-toasts .notification-toast");
  const count = await toasts.count();
  const bad: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await toasts.nth(i).textContent()) || "";
    if (
      /Webview:\s*(Uncaught error|Unhandled promise rejection|initAsync failed|Error processing message)/i.test(text)
    ) {
      bad.push(text.trim());
    }
  }
  if (bad.length > 0) {
    throw new Error("MCT surfaced webview error notifications:\n" + bad.map((b, i) => `  ${i + 1}. ${b}`).join("\n"));
  }
}

/**
 * Find the MCT main view webview frame (nested inside VS Code's outer webview
 * iframe). VS Code wraps webview content in two iframes — the outer one is the
 * host-side `vscode-webview` iframe, the inner one (`#active-frame`) contains the
 * actual extension HTML. We return the innermost frame that contains MCT's
 * `#root` element.
 */
export async function findMctMainViewFrame(page: Page, timeoutMs = 20000): Promise<Frame | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const frame of page.frames()) {
      try {
        const hasRoot = await frame.locator("#root").count();
        if (hasRoot > 0) {
          // Make sure this isn't the outer root (VS Code's own body has no #root).
          const url = frame.url();
          if (url.includes("vscode-webview") || url.includes("vscode-cdn") || url.includes("webview")) {
            return frame;
          }
        }
      } catch {
        // frame may have been detached; skip
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}
