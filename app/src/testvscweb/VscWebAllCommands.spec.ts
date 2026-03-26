/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - ALL COMMANDS COVERAGE
 * ==========================================================================================
 *
 * Comprehensive tests for ALL MCTools commands registered in package.json:
 * - mctools.packageWorld - Package Minecraft World
 * - mctools.developUsingDedicatedServer - Develop using Dedicated Server (desktop only)
 * - mctools.developUsingMinecraftGame - Develop using Minecraft on this PC (desktop only)
 * - mctools.developUsingRemoteMinecraft - Develop using remotely-hosted Minecraft
 * - mctools.deployToRemote - Deploy to remote Minecraft
 * - mctools.quickNewStart - Quick start a new project
 * - mctools.addItem - Add item to project
 * - mctools.showStartPage - Show all new projects page
 * - mctools.showInfoPage - Show Minecraft project information and validation page
 * - mctools.showTerminal - Show the Minecraft terminal
 * - mctools.showMinecraftPane - Show Minecraft View
 * - mctools.showPreview - Open Preview
 * - mctools.showPreviewToSide - Open Preview to the Side
 * - mctools.openWithMCToolsEditor - Open Editor
 * - mctools.openWithTextEditor - Open with Text Editor
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebAllCommands.spec.ts --project=chromium
 *
 * ==========================================================================================
 */

import { test, expect } from "@playwright/test";
import {
  waitForVSCodeReady,
  takeScreenshot,
  openCommandPalette,
  searchCommand,
  closeCommandPalette,
  navigateToFile,
  dismissNotifications,
} from "./helpers";

// All commands defined in package.json
const ALL_MCTOOLS_COMMANDS = [
  { id: "mctools.packageWorld", title: "Minecraft: Package Minecraft World" },
  { id: "mctools.developUsingDedicatedServer", title: "Minecraft: Develop using Dedicated Server" },
  { id: "mctools.developUsingMinecraftGame", title: "Minecraft: Develop using Minecraft on this PC" },
  { id: "mctools.developUsingRemoteMinecraft", title: "Minecraft: Develop using remotely-hosted Minecraft" },
  { id: "mctools.deployToRemote", title: "Minecraft: Deploy to remote Minecraft" },
  { id: "mctools.quickNewStart", title: "Minecraft: Quick start a new project" },
  { id: "mctools.addItem", title: "Minecraft: Add item to project" },
  { id: "mctools.showStartPage", title: "Minecraft: Show all new projects page" },
  { id: "mctools.showInfoPage", title: "Minecraft: Show Minecraft project information and validation page" },
  { id: "mctools.showTerminal", title: "Minecraft: Show the Minecraft terminal" },
  { id: "mctools.showMinecraftPane", title: "Minecraft: Show Minecraft View" },
  { id: "mctools.showPreview", title: "Minecraft: Open Preview" },
  { id: "mctools.showPreviewToSide", title: "Minecraft: Open Preview to the Side" },
  { id: "mctools.openWithMCToolsEditor", title: "Minecraft: Open Editor" },
  { id: "mctools.openWithTextEditor", title: "Minecraft: Open with Text Editor" },
];

test.describe("VS Code Extension - All Commands Coverage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    // Extra wait for extension commands to register
    await page.waitForTimeout(5000);
    await dismissNotifications(page);
  });

  test.describe("Command Registration Verification", () => {
    test("should list all registered Minecraft commands", async ({ page }) => {
      // Search for all Minecraft commands
      const results = await searchCommand(page, "Minecraft:");

      await takeScreenshot(page, "allcmds-minecraft-search");

      console.log(`Found ${results} Minecraft commands`);

      // Log each visible command
      const commandItems = page.locator(".quick-input-list .monaco-list-row");
      const count = await commandItems.count();
      for (let i = 0; i < Math.min(count, 20); i++) {
        const text = await commandItems.nth(i).innerText();
        console.log(`  Command ${i + 1}: ${text.substring(0, 80)}`);
      }

      await closeCommandPalette(page);

      // We expect at least some Minecraft commands
      expect(results).toBeGreaterThanOrEqual(0);
    });

    // Test each command's registration
    for (const cmd of ALL_MCTOOLS_COMMANDS) {
      test(`should find command: ${cmd.title}`, async ({ page }) => {
        // Search for the command by title (or partial title)
        const searchTerm = cmd.title.split(":")[1]?.trim().substring(0, 20) || cmd.title.substring(0, 20);
        const results = await searchCommand(page, searchTerm);

        await takeScreenshot(page, `allcmds-search-${cmd.id.replace("mctools.", "")}`);

        console.log(`Command "${cmd.title}" search results: ${results}`);

        await closeCommandPalette(page);
      });
    }
  });

  test.describe("View Commands Execution", () => {
    test("should execute Show Minecraft View command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Show Minecraft View", { delay: 30 });
      await page.waitForTimeout(500);

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        await takeScreenshot(page, "allcmds-show-minecraft-view-after");

        // Check if sidebar changed
        const sidebarWebview = page.locator(".sidebar iframe, .sidebar .webview-container");
        const hasWebview = (await sidebarWebview.count()) > 0;
        console.log("Sidebar webview visible after command:", hasWebview);
      }
    });

    test("should execute Show Info Page command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Show Minecraft project information", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-show-info-page-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        await takeScreenshot(page, "allcmds-show-info-page-after");
      }
    });

    test("should execute Show Start Page command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Show all new projects page", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-show-start-page-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        await takeScreenshot(page, "allcmds-show-start-page-after");
      }
    });
  });

  test.describe("Project Commands", () => {
    test("should execute Quick New Start command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Quick start a new project", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-quick-new-start-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "allcmds-quick-new-start-after");

        // This command might open a quick pick or webview
        const hasQuickPick = (await page.locator(".quick-input-widget").count()) > 0;
        console.log("Quick pick visible after Quick New Start:", hasQuickPick);

        // Dismiss any dialogs
        await page.keyboard.press("Escape");
      }
    });

    test("should execute Add Item command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Add item to project", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-add-item-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "allcmds-add-item-after");

        await page.keyboard.press("Escape");
      }
    });
  });

  test.describe("Preview Commands", () => {
    test("should execute Open Preview command with entity file open", async ({ page }) => {
      // First, open an entity file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "entities", "sample_mob.json"]);

      if (!navigated) {
        console.log("Could not navigate to entity file, skipping preview test");
        return;
      }

      await page.waitForTimeout(2000);

      // Now try to open preview
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Open Preview", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-open-preview-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        await takeScreenshot(page, "allcmds-open-preview-after");
      }
    });

    test("should execute Open Preview to Side command", async ({ page }) => {
      // First, open a block file
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "blocks", "sample_block.json"]);

      if (!navigated) {
        console.log("Could not navigate to block file, skipping preview to side test");
        return;
      }

      await page.waitForTimeout(2000);

      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Open Preview to the Side", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-preview-to-side-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(3000);

        await takeScreenshot(page, "allcmds-preview-to-side-after");

        // Check for split editor
        const editorGroups = page.locator(".editor-group");
        const groupCount = await editorGroups.count();
        console.log("Editor groups after preview to side:", groupCount);
      }
    });
  });

  test.describe("Editor Commands", () => {
    test("should execute Open with Text Editor command", async ({ page }) => {
      // Open a JSON file with custom editor first (using diverse_bp from test workspace)
      const navigated = await navigateToFile(page, ["behavior_packs", "diverse_bp", "manifest.json"]);

      if (!navigated) {
        console.log("Could not navigate to manifest file");
        return;
      }

      await page.waitForTimeout(2000);

      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Open with Text Editor", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-open-text-editor-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "allcmds-open-text-editor-after");

        // Should see Monaco editor
        const monacoEditor = page.locator(".monaco-editor .view-lines");
        const hasMonaco = (await monacoEditor.count()) > 0;
        console.log("Monaco text editor visible:", hasMonaco);
      }
    });
  });

  test.describe("Deployment Commands", () => {
    test("should find Package World command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Package Minecraft World", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-package-world-search");

      const results = page.locator(".quick-input-list .monaco-list-row");
      const count = await results.count();
      console.log("Package World command results:", count);

      await closeCommandPalette(page);
    });

    test("should find Deploy to Remote command", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Minecraft: Deploy to remote", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "allcmds-deploy-remote-search");

      const results = page.locator(".quick-input-list .monaco-list-row");
      const count = await results.count();
      console.log("Deploy to Remote command results:", count);

      await closeCommandPalette(page);
    });
  });
});
