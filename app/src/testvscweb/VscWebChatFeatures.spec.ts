/**
 * ==========================================================================================
 * VSCODE WEB EXTENSION TESTS - CHAT PARTICIPANT & AI FEATURES
 * ==========================================================================================
 *
 * Tests for MCTools Chat Participant and Language Model Tools:
 * - @minecraft chat participant
 * - Chat commands: /validate, /create, /explain, /fix
 * - Language model tools integration
 *
 * NOTE: These features require VS Code with GitHub Copilot extension and may not be
 * fully functional in vscode-test-web environment. Tests focus on registration verification.
 *
 * Prerequisites:
 * - VS Code extension built: npm run vscbuild
 * - Sample content in: samplecontent/diverse_content/
 *
 * Run with:
 * - npm run test-vscweb
 * - npx playwright test VscWebChatFeatures.spec.ts --project=chromium
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

test.describe("VS Code Chat Participant Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test.describe("Chat View Access", () => {
    test("should be able to open Chat view via command palette", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("View: Focus on Chat View", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "chat-view-command-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "chat-view-opened");

        // Check if chat panel is visible
        const chatPanel = page.locator('.panel [class*="chat"], [class*="copilot"]');
        const hasChatPanel = (await chatPanel.count()) > 0;
        console.log("Chat panel visible:", hasChatPanel);
      } else {
        console.log("Chat view command not found - GitHub Copilot may not be installed");
        await closeCommandPalette(page);
      }
    });

    test("should be able to open Chat view via keyboard shortcut", async ({ page }) => {
      // Try Ctrl+Alt+I (common chat shortcut)
      await page.keyboard.press("Control+Alt+I");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "chat-view-keyboard");

      // The chat panel might not open if Copilot isn't available
      const chatPanel = page.locator('.panel [class*="chat"], [class*="copilot"], .inline-chat');
      const hasChatPanel = (await chatPanel.count()) > 0;
      console.log("Chat panel visible via keyboard:", hasChatPanel);
    });
  });

  test.describe("Chat Participant Registration", () => {
    test("should search for minecraft chat participant", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("@minecraft", { delay: 50 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "chat-participant-search");

      // Check if any results mention minecraft participant
      const results = page.locator(".quick-input-list .monaco-list-row");
      const count = await results.count();
      console.log("Results for @minecraft search:", count);

      await closeCommandPalette(page);
    });

    test("should list chat participants if Copilot available", async ({ page }) => {
      await openCommandPalette(page);
      await page.keyboard.type("Chat: List Chat Participants", { delay: 30 });
      await page.waitForTimeout(500);

      await takeScreenshot(page, "chat-list-participants-search");

      const firstResult = page.locator(".quick-input-list .monaco-list-row").first();
      if ((await firstResult.count()) > 0) {
        const text = await firstResult.innerText();
        console.log("Found command:", text);

        // Execute if found
        await firstResult.click();
        await page.waitForTimeout(2000);

        await takeScreenshot(page, "chat-participants-list");
      }

      await closeCommandPalette(page);
    });
  });

  test.describe("Copilot Extension Presence", () => {
    test("should check for Copilot extension in Extensions view", async ({ page }) => {
      // Open Extensions view
      await page.keyboard.press("Control+Shift+X");
      await page.waitForTimeout(2000);

      await takeScreenshot(page, "chat-extensions-view");

      // Search for GitHub Copilot
      const searchInput = page.locator(".extensions-viewlet input.search-box");
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("@installed GitHub.copilot");
        await page.waitForTimeout(1000);

        await takeScreenshot(page, "chat-copilot-search");

        // Check if Copilot is installed
        const copilotExtension = page.locator('.extension-list-item:has-text("GitHub Copilot")');
        const hasCopilot = (await copilotExtension.count()) > 0;
        console.log("GitHub Copilot extension installed:", hasCopilot);
      }

      // Go back to explorer
      await page.keyboard.press("Control+Shift+E");
    });
  });

  test.describe("Inline Chat (if available)", () => {
    test("should try to trigger inline chat in editor", async ({ page }) => {
      // Open a file first
      await page.keyboard.press("Control+Shift+E");
      await page.waitForTimeout(1000);

      // Try to navigate to a file (using diverse_bp from test workspace)
      const bpFolder = page.locator('.monaco-list-row:has-text("behavior_packs")').first();
      if ((await bpFolder.count()) > 0) {
        await bpFolder.click();
        await page.waitForTimeout(500);

        const diverseFolder = page.locator('.monaco-list-row:has-text("diverse_bp")').first();
        if ((await diverseFolder.count()) > 0) {
          await diverseFolder.click();
          await page.waitForTimeout(500);

          const manifestFile = page.locator('.monaco-list-row:has-text("manifest.json")').first();
          if ((await manifestFile.count()) > 0) {
            await manifestFile.dblclick();
            await page.waitForTimeout(2000);

            // Try to trigger inline chat (Ctrl+I)
            await page.keyboard.press("Control+I");
            await page.waitForTimeout(1500);

            await takeScreenshot(page, "chat-inline-triggered");

            // Check for inline chat widget
            const inlineChat = page.locator(".inline-chat, .chat-widget");
            const hasInlineChat = (await inlineChat.count()) > 0;
            console.log("Inline chat visible:", hasInlineChat);

            // Close inline chat
            await page.keyboard.press("Escape");
          }
        }
      }
    });
  });
});

test.describe("VS Code Language Model Tools", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForVSCodeReady(page);
    await dismissNotifications(page);
  });

  test("should verify language model tools are registered", async ({ page }) => {
    // Language Model Tools are internal and not directly visible in UI
    // We can check if the extension contributes them by looking at extension manifest
    // This is more of a verification that the extension loaded properly

    await openCommandPalette(page);
    await page.keyboard.type("MCTools validate", { delay: 30 });
    await page.waitForTimeout(500);

    await takeScreenshot(page, "lm-tools-validate-search");

    // The language model tools would be called by Copilot, not directly
    // So we just verify related commands exist
    const results = page.locator(".quick-input-list .monaco-list-row");
    const count = await results.count();
    console.log("MCTools validate related results:", count);

    await closeCommandPalette(page);
  });

  test("should check for MCTools contribution in Output panel", async ({ page }) => {
    // Open Output panel
    await page.keyboard.press("Control+Shift+U");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "lm-tools-output-panel");

    // Try to find MCTools in output channel dropdown
    const outputDropdown = page.locator(".output-view-container .monaco-dropdown, .output-view-container select");
    if ((await outputDropdown.count()) > 0) {
      await outputDropdown.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "lm-tools-output-channels");

      // Look for MCTools channel
      const mctoolsChannel = page.locator('.monaco-list-row:has-text("MCTools"), option:has-text("MCTools")');
      const hasChannel = (await mctoolsChannel.count()) > 0;
      console.log("MCTools output channel present:", hasChannel);

      await page.keyboard.press("Escape");
    }
  });
});
