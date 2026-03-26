/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - TASKS & TERMINAL
 * ==========================================================================================
 *
 * Tests for MCTools task definitions and terminal integration:
 * - Minecraft task type registration
 * - Task definitions (deploy, deployToLocal, deployToRemote, deployToClient)
 * - Terminal profile (Minecraft terminal)
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebTasks.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  openCommandPalette,
  closeCommandPalette,
  dismissNotifications,
} from "./helpers";

test.describe("VS Code Tasks & Terminal Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test.describe("Task Management", () => {
    test("should open Tasks: Run Task command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Tasks: Run Task", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "tasks-run-task-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(1500);

        await takeScreenshot(page, "tasks-run-task-list");

        // Check for Minecraft task type in the list
        const minecraftTask = page.locator('.quick-input-list .monaco-list-row:has-text("minecraft")');
        const hasMinecraftTask = (await minecraftTask.count()) > 0;
        console.log("Minecraft task type found:", hasMinecraftTask);

        await page.keyboard.press("Escape");
      }

      await closeCommandPalette(page);
    });

    test("should open Tasks: Configure Task command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Tasks: Configure Task", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "tasks-configure-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(1500);

        await takeScreenshot(page, "tasks-configure-list");

        // Look for option to create tasks.json
        const createTasksOption = page.locator('.quick-input-list .monaco-list-row:has-text("Create")');
        const hasCreateOption = (await createTasksOption.count()) > 0;
        console.log("Create tasks.json option found:", hasCreateOption);

        await page.keyboard.press("Escape");
      }

      await closeCommandPalette(page);
    });

    test("should search for Minecraft tasks", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("task minecraft", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "tasks-minecraft-search");

      const results = page.locator(".quick-input-list .monaco-list-row");
      const count = await results.count();
      console.log("Minecraft task search results:", count);

      await closeCommandPalette(page);
    });
  });

  test.describe("Terminal Features", () => {
    test("should open Terminal via keyboard shortcut", async ({ page }) => {
      // Open terminal with Ctrl+`
      await page.keyboard.press("Control+`");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "terminal-opened-keyboard");

      // Check if terminal panel is visible
      const terminalPanel = page.locator(".terminal, .integrated-terminal");
      const hasTerminal = (await terminalPanel.count()) > 0;
      console.log("Terminal panel visible:", hasTerminal);
    });

    test("should list terminal profiles", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Terminal: Select Default Profile", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "terminal-select-profile-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(1500);

        await takeScreenshot(page, "terminal-profile-list");

        // Check for Minecraft terminal profile
        const minecraftProfile = page.locator('.quick-input-list .monaco-list-row:has-text("Minecraft")');
        const hasMinecraftProfile = (await minecraftProfile.count()) > 0;
        console.log("Minecraft terminal profile found:", hasMinecraftProfile);

        await page.keyboard.press("Escape");
      }

      await closeCommandPalette(page);
    });

    test("should open Show Minecraft terminal command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Show the Minecraft terminal", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "terminal-minecraft-command-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "terminal-minecraft-opened");
      }

      await closeCommandPalette(page);
    });

    test("should create new terminal via command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Terminal: Create New Terminal", { delay: 30 });
      await page.waitForTimeout(500);

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "terminal-new-created");

        // Terminal should be visible
        const terminal = page.locator(".integrated-terminal, .terminal-wrapper");
        const hasTerminal = (await terminal.count()) > 0;
        console.log("New terminal created:", hasTerminal);
      }

      await closeCommandPalette(page);
    });
  });

  test.describe("Debug & Run Features", () => {
    test("should open Run and Debug view", async ({ page }) => {
      // Open Run and Debug
      await page.keyboard.press("Control+Shift+D");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "debug-view-opened");

      // Check if debug sidebar is visible
      const debugSidebar = page.locator(".debug-viewlet, .debug-action");
      const hasDebugView = (await debugSidebar.count()) > 0;
      console.log("Debug view visible:", hasDebugView);
    });

    test("should check for run configurations", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Debug: Open launch.json", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debug-launch-json-search");

      // Check if the command is available
      const results = page.locator(".quick-input-list .monaco-list-row");
      const count = await results.count();
      console.log("Debug launch.json results:", count);

      await closeCommandPalette(page);
    });
  });
});
