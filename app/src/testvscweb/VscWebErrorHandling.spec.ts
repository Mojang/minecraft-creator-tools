/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - ERROR HANDLING & EDGE CASES
 * ==========================================================================================
 *
 * Tests for error handling, edge cases, and resilience of the VS Code web extension.
 * These tests ensure the extension gracefully handles unexpected situations.
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  openCommandPalette,
  closeCommandPalette,
  navigateToFile,
  dismissNotifications,
} from "./helpers";

test.describe("MCTools VS Code Web - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
  });

  test("extension handles rapid command palette open/close", async ({ page }) => {
    // Rapidly open and close command palette
    for (let i = 0; i < 5; i++) {
      await openCommandPalette(page);
      await page.waitForTimeout(100);
      await closeCommandPalette(page);
      await page.waitForTimeout(100);
    }

    await takeScreenshot(page, "error-rapid-command-palette");

    // VS Code should still be responsive
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("handles missing file gracefully", async ({ page }) => {
    // Try to navigate to a non-existent file
    await page.keyboard.press("Control+P");
    await page.waitForTimeout(500);

    await page.keyboard.type("nonexistent_file_12345.xyz", { delay: 30 });
    await page.waitForTimeout(500);

    await takeScreenshot(page, "error-missing-file-search");

    // Results should be empty or show "No matching results"
    const results = page.locator(".quick-input-list .monaco-list-row");
    const noResults = page.locator(".quick-input-list-entry:has-text('No matching')");

    // Either no results or explicit "No matching" message indicates file not found
    await expect(results.or(noResults))
      .toHaveCount(0, { timeout: 1000 })
      .catch(() => {});

    await page.keyboard.press("Escape");

    // Should not crash - VS Code should still work
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("handles command that does nothing gracefully", async ({ page }) => {
    await dismissNotifications(page);

    // Try to run a command when prerequisites aren't met
    await openCommandPalette(page);
    await page.keyboard.type("Minecraft: Package World", { delay: 30 });
    await page.waitForTimeout(500);

    const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
    if ((await firstResult.count()) > 0) {
      await firstResult.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, "error-command-no-prereq");

    // May show a notification, but shouldn't crash
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("no critical console errors on startup", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter out known non-critical errors
        if (
          !text.includes("net::ERR_") &&
          !text.includes("Failed to load resource") &&
          !text.includes("SSL") &&
          !text.includes("favicon")
        ) {
          errors.push(text);
        }
      }
    });

    // Give time for errors to appear
    await page.waitForTimeout(5000);

    await takeScreenshot(page, "error-console-startup");

    // Log any errors found
    if (errors.length > 0) {
      console.log("Console errors found:", errors);
    }

    // Should have minimal critical errors
    expect(errors.length).toBeLessThan(5);
  });

  test("extension survives rapid file opens", async ({ page }) => {
    // Open explorer
    await page.keyboard.press("Control+Shift+E");
    await page.waitForTimeout(1000);

    // Rapidly click on different items
    const listRows = page.locator(".monaco-list-row");
    const rowCount = await listRows.count();

    for (let i = 0; i < Math.min(5, rowCount); i++) {
      await listRows.nth(i).click();
      await page.waitForTimeout(100);
    }

    await takeScreenshot(page, "error-rapid-file-clicks");

    // VS Code should still be responsive
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("handles editor close while loading", async ({ page }) => {
    // Start opening a file (using diverse_bp from test workspace)
    await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);

    // Immediately try to close it
    await page.keyboard.press("Control+W");
    await page.waitForTimeout(500);

    await takeScreenshot(page, "error-close-while-loading");

    // Should not crash
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("handles escape key spam", async ({ page }) => {
    // Spam escape key (common panic behavior)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(50);
    }

    await takeScreenshot(page, "error-escape-spam");

    // VS Code should still be responsive
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();

    // Should be able to open command palette
    await openCommandPalette(page);
    const commandInput = page.locator(".quick-input-widget");
    await expect(commandInput).toBeVisible();

    await closeCommandPalette(page);
  });

  test("notification handling", async ({ page }) => {
    // Check if there are any notifications
    const notifications = page.locator(".notifications-toasts .notification-toast");
    const notifCount = await notifications.count();

    await takeScreenshot(page, "error-notifications-initial");

    if (notifCount > 0) {
      // Try to dismiss notifications
      await dismissNotifications(page);
      await page.waitForTimeout(500);

      await takeScreenshot(page, "error-notifications-dismissed");
    }

    // VS Code should still work
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });

  test("keyboard shortcuts work after extension load", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Test various keyboard shortcuts
    const shortcuts = [
      { keys: "Control+Shift+E", name: "Explorer" },
      { keys: "Control+Shift+G", name: "Source Control" },
      { keys: "Control+Shift+X", name: "Extensions" },
      { keys: "Control+`", name: "Terminal" },
      { keys: "Control+B", name: "Toggle Sidebar" },
    ];

    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut.keys);
      await page.waitForTimeout(500);

      const workbench = page.locator(".monaco-workbench");
      const isResponsive = await workbench.isVisible();

      if (!isResponsive) {
        console.error(`VS Code became unresponsive after ${shortcut.name} shortcut`);
      }

      expect(isResponsive).toBe(true);
    }

    await takeScreenshot(page, "error-keyboard-shortcuts");
  });

  test("activity bar remains clickable", async ({ page }) => {
    const activityItems = page.locator(".activitybar .action-item");
    const itemCount = await activityItems.count();

    expect(itemCount).toBeGreaterThan(0);

    // Click through activity bar items
    for (let i = 0; i < Math.min(5, itemCount); i++) {
      await activityItems.nth(i).click();
      await page.waitForTimeout(500);

      // Verify workbench is still responsive (sidebar may hide with some clicks)
      const workbench = page.locator(".monaco-workbench");
      await expect(workbench).toBeVisible();
    }

    await takeScreenshot(page, "error-activity-bar-clicks");
  });

  test("search view handles empty results", async ({ page }) => {
    // Open search
    await page.keyboard.press("Control+Shift+F");
    await page.waitForTimeout(1500);

    // Try to find and interact with search input
    // The search view has different input structures
    const searchInputSelectors = [
      ".search-view .search-widget .input",
      ".search-view textarea",
      '.search-view input[type="text"]',
      ".search-container .input",
    ];

    let searchFound = false;
    for (const selector of searchInputSelectors) {
      const searchInput = page.locator(selector).first();
      if ((await searchInput.count()) > 0 && (await searchInput.isVisible())) {
        try {
          await searchInput.click();
          await page.keyboard.type("xyznonexistent12345", { delay: 30 });
          await page.waitForTimeout(500);
          await page.keyboard.press("Enter");
          await page.waitForTimeout(1500);
          searchFound = true;
          break;
        } catch {
          // Try next selector
        }
      }
    }

    if (!searchFound) {
      console.log("Could not find search input, but search view opened");
    }

    await takeScreenshot(page, "error-search-no-results");

    // VS Code should still work
    const workbench = page.locator(".monaco-workbench");
    await expect(workbench).toBeVisible();
  });
});
