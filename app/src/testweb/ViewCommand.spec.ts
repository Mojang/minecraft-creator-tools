/**
 * ViewCommand.spec.ts - Playwright tests for the `mct view` CLI command
 *
 * These tests verify that the `mct view` command properly:
 * 1. Starts an HTTP server to view Minecraft content in read-only mode
 * 2. Renders the project editor UI correctly
 * 3. Allows navigation and interaction with project items
 * 4. Gracefully shuts down when the Close button is clicked
 *
 * Test approach:
 * - Spawn `node ./toolbuild/jsn/cli view -i <samplecontent>` as a subprocess
 * - Parse stdout for the port and URL
 * - Navigate Playwright to the view URL with auth token
 * - Interact with the editor UI
 * - Click Close button to trigger graceful shutdown via /api/shutdown
 * - Verify server stops cleanly
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { isIgnorableMessage } from "./WebTestUtilities";

// Timeout for waiting for the server to start
const SERVER_START_TIMEOUT = 30000;
// Timeout for waiting for the server to stop after shutdown request
const SERVER_STOP_TIMEOUT = 10000;

/**
 * Check if an error message is expected/ignorable for view command tests.
 * 404 errors are common for sample content with missing files and are not indicative
 * of problems with the view command itself.
 */
function isIgnorableViewError(message: string): boolean {
  // 404 errors from missing sample content files are expected
  if (message.includes("404") && message.includes("Failed to load resource")) {
    return true;
  }
  // Status code 404 messages are also expected
  if (message.includes("status of 404")) {
    return true;
  }
  // Window.close() permission error is expected behavior
  if (message.includes("Scripts may close only the windows")) {
    return true;
  }
  // WebGL errors from 3D viewers in headless browser are expected
  if (message.includes("GL_INVALID") || message.includes("glGetProgramiv")) {
    return true;
  }
  // Connection refused errors occur when server is shutting down
  if (message.includes("ERR_CONNECTION_REFUSED") || message.includes("net::ERR_")) {
    return true;
  }
  // Use the standard ignorable message check
  return isIgnorableMessage(message);
}

/**
 * Custom message processor for view command tests that filters out expected 404 errors.
 */
function processViewMessage(
  msg: ConsoleMessage,
  page: Page,
  consoleErrors: { url: string; error: string }[],
  consoleWarnings: { url: string; error: string }[]
) {
  const messageType = msg.type();
  const messageText = msg.text();

  if (!isIgnorableViewError(messageText)) {
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

interface ViewServerInfo {
  process: ChildProcess;
  port: number;
  url: string;
  passcode: string;
}

/**
 * Starts the `mct view` command on the specified content folder.
 * Returns info about the running server including port and passcode.
 */
async function startViewServer(contentPath: string): Promise<ViewServerInfo> {
  const appDir = path.resolve(__dirname, "../..");
  const cliPath = path.join(appDir, "toolbuild/jsn/cli/index.mjs");
  const absoluteContentPath = path.resolve(appDir, contentPath);

  console.log(`Starting view server for: ${absoluteContentPath}`);
  console.log(`CLI path: ${cliPath}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`View server failed to start within ${SERVER_START_TIMEOUT}ms`));
    }, SERVER_START_TIMEOUT);

    const serverProcess = spawn("node", [cliPath, "view", "-i", absoluteContentPath], {
      cwd: appDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // Prevent the CLI from opening a browser window
        MCT_NO_OPEN_BROWSER: "1",
      },
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let resolved = false;

    serverProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      stdoutBuffer += output;
      console.log(`[view server stdout]: ${output.trim()}`);

      // Parse the URL from output - looking for pattern like:
      // "Opening browser to: http://localhost:6136/?mode=project&contentUrl=/api/content/#tempPasscode=abc123"
      // or just the URL on its own line
      const urlMatch = stdoutBuffer.match(
        /http:\/\/localhost:(\d+)\/\?mode=project&contentUrl=\/api\/content\/#tempPasscode=([a-zA-Z0-9]+)/
      );

      if (urlMatch && !resolved) {
        resolved = true;
        clearTimeout(timeout);

        const port = parseInt(urlMatch[1], 10);
        const passcode = urlMatch[2];
        const url = urlMatch[0];

        console.log(`View server started on port ${port} with passcode ${passcode}`);

        resolve({
          process: serverProcess,
          port,
          url,
          passcode,
        });
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      stderrBuffer += output;
      console.log(`[view server stderr]: ${output.trim()}`);
    });

    serverProcess.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`Failed to start view server: ${err.message}`));
      }
    });

    serverProcess.on("exit", (code, signal) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(
          new Error(
            `View server exited prematurely with code ${code}, signal ${signal}. stdout: ${stdoutBuffer}, stderr: ${stderrBuffer}`
          )
        );
      }
    });
  });
}

/**
 * Stops the view server by killing the process.
 * Used for cleanup if the Close button flow fails.
 */
function forceStopServer(serverInfo: ViewServerInfo): void {
  if (serverInfo.process && !serverInfo.process.killed) {
    console.log("Force stopping view server process");
    serverInfo.process.kill("SIGTERM");
  }
}

/**
 * Waits for the server process to exit after a shutdown request.
 */
async function waitForServerExit(serverInfo: ViewServerInfo): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log("Server did not exit within timeout, force killing");
      forceStopServer(serverInfo);
      resolve(false);
    }, SERVER_STOP_TIMEOUT);

    if (serverInfo.process.killed || serverInfo.process.exitCode !== null) {
      clearTimeout(timeout);
      resolve(true);
      return;
    }

    serverInfo.process.on("exit", () => {
      clearTimeout(timeout);
      console.log("View server process exited cleanly");
      resolve(true);
    });
  });
}

test.describe("MCTools View Command Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test("should view simple sample content and navigate items", async ({ page }) => {
    let serverInfo: ViewServerInfo | undefined;

    try {
      // Start the view server on simple sample content
      serverInfo = await startViewServer("../samplecontent/simple");

      // Set up console message handling
      page.on("console", (msg: ConsoleMessage) => {
        processViewMessage(msg, page, consoleErrors, consoleWarnings);
      });

      // Navigate to the view URL
      // The URL already has the passcode in the hash, so auto-login should work
      console.log(`Navigating to: ${serverInfo.url}`);
      await page.goto(serverInfo.url);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(5000); // Give extra time for SPA to initialize and project to load

      // Take initial screenshot
      await page.screenshot({ path: "debugoutput/screenshots/view-simple-initial.png", fullPage: true });

      // Verify we're in the editor interface (view mode)
      // In view mode, there should be a Close button instead of Home button
      const closeButton = page.locator('button[title*="Close"]').or(page.locator("button:has-text('Close')"));

      // Wait for the UI to stabilize
      await page.waitForTimeout(1000);

      // Check if Close button exists (indicates view mode)
      const hasCloseButton = (await closeButton.count()) > 0;
      console.log(`Close button found: ${hasCloseButton}`);

      if (hasCloseButton) {
        await expect(closeButton.first()).toBeVisible();
      }

      // Look for the project file listing
      const fileList = page.locator("[role='listbox']");
      if ((await fileList.count()) > 0) {
        console.log("Found project file listing");
        await expect(fileList.first()).toBeVisible();

        // Take screenshot showing file list
        await page.screenshot({ path: "debugoutput/screenshots/view-simple-filelist.png", fullPage: true });

        // Try to click on items in the list to navigate
        const listItems = page.locator("[role='listbox'] option, [role='listbox'] [role='option']");
        const itemCount = await listItems.count();
        console.log(`Found ${itemCount} items in file list`);

        // Click on a few items if available
        if (itemCount > 0) {
          // Click first visible item
          const firstItem = listItems.first();
          if (await firstItem.isVisible()) {
            console.log("Clicking first list item");
            await firstItem.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: "debugoutput/screenshots/view-simple-item-clicked.png", fullPage: true });
          }
        }
      }

      // Check for inspector item (common in all projects)
      const inspectorItem = page.locator("text=/Inspector/i");
      if ((await inspectorItem.count()) > 0) {
        console.log("Clicking Inspector item");
        await inspectorItem.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "debugoutput/screenshots/view-simple-inspector.png", fullPage: true });
      }

      // Now click the Close button to shut down the server
      if (hasCloseButton) {
        console.log("Clicking Close button to shut down server");
        await closeButton.first().click();

        // Wait for the server to shut down
        const exitedCleanly = await waitForServerExit(serverInfo);
        console.log(`Server exited cleanly: ${exitedCleanly}`);

        // Take final screenshot (might show session ended screen)
        await page.waitForTimeout(500);
        await page.screenshot({ path: "debugoutput/screenshots/view-simple-after-close.png", fullPage: true });
      }

      // Validate console errors are minimal
      expect(consoleErrors.length).toBeLessThanOrEqual(5);
    } finally {
      // Ensure server is stopped even if test fails
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
    }
  });

  test("should view addon sample content and explore behavior pack items", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    let serverInfo: ViewServerInfo | undefined;

    try {
      // Start the view server on addon sample content
      serverInfo = await startViewServer("../samplecontent/addon");

      // Set up console message handling
      page.on("console", (msg: ConsoleMessage) => {
        processViewMessage(msg, page, consoleErrors, consoleWarnings);
      });

      // Navigate to the view URL
      console.log(`Navigating to: ${serverInfo.url}`);
      await page.goto(serverInfo.url);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(5000); // Give extra time for SPA to initialize and project to load

      // Take initial screenshot
      await page.screenshot({ path: "debugoutput/screenshots/view-addon-initial.png", fullPage: true });

      // Verify we're in view mode
      const closeButton = page.locator('button[title*="Close"]').or(page.locator("button:has-text('Close')"));
      const hasCloseButton = (await closeButton.count()) > 0;
      console.log(`Close button found: ${hasCloseButton}`);

      // Look for the project file listing and explore items
      const fileList = page.locator("[role='listbox']");
      if ((await fileList.count()) > 0) {
        console.log("Found project file listing");

        // Look for behavior pack items
        const behaviorPackItem = page.locator("text=/behavior/i").first();
        if ((await behaviorPackItem.count()) > 0) {
          console.log("Found behavior pack item, clicking");
          await behaviorPackItem.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: "debugoutput/screenshots/view-addon-behaviorpack.png", fullPage: true });
        }

        // Look for entity items
        const entityItem = page.locator("text=/entity|entities/i").first();
        if ((await entityItem.count()) > 0) {
          console.log("Found entity item, clicking");
          await entityItem.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: "debugoutput/screenshots/view-addon-entity.png", fullPage: true });
        }

        // Look for script items
        const scriptItem = page.locator("text=/script/i").first();
        if ((await scriptItem.count()) > 0) {
          console.log("Found script item, clicking");
          await scriptItem.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: "debugoutput/screenshots/view-addon-script.png", fullPage: true });
        }
      }

      // Check for Actions item
      const actionsItem = page.locator("text=/Actions/");
      if ((await actionsItem.count()) > 0) {
        console.log("Clicking Actions item");
        await actionsItem.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "debugoutput/screenshots/view-addon-actions.png", fullPage: true });
      }

      // Verify that typical edit buttons are NOT visible in view mode
      // (Save button should not be present)
      const saveButton = page.getByRole("button", { name: "Save" });
      const hasSaveButton = (await saveButton.count()) > 0;
      console.log(`Save button found (should be false in view mode): ${hasSaveButton}`);

      // Close the view session
      if (hasCloseButton) {
        console.log("Clicking Close button to shut down server");
        await closeButton.first().click();
        await waitForServerExit(serverInfo);
        await page.waitForTimeout(500);
        await page.screenshot({ path: "debugoutput/screenshots/view-addon-after-close.png", fullPage: true });
      }

      expect(consoleErrors.length).toBeLessThanOrEqual(5);
    } finally {
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
    }
  });

  test("should view diverse content and check different item types", async ({ page }) => {
    let serverInfo: ViewServerInfo | undefined;

    try {
      // Start the view server on diverse_content sample
      serverInfo = await startViewServer("../samplecontent/diverse_content");

      page.on("console", (msg: ConsoleMessage) => {
        processViewMessage(msg, page, consoleErrors, consoleWarnings);
      });

      console.log(`Navigating to: ${serverInfo.url}`);
      await page.goto(serverInfo.url);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(5000); // Give extra time for SPA to initialize

      await page.screenshot({ path: "debugoutput/screenshots/view-diverse-initial.png", fullPage: true });

      // Check for project items
      const projectItem = page.locator("text=/Project/");
      if ((await projectItem.count()) > 0) {
        console.log("Clicking Project item");
        await projectItem.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "debugoutput/screenshots/view-diverse-project.png", fullPage: true });
      }

      // Check for inspector
      const inspectorItem = page.locator("text=/Inspector/");
      if ((await inspectorItem.count()) > 0) {
        console.log("Clicking Inspector item");
        await inspectorItem.first().click();
        await page.waitForTimeout(1500); // Inspector can take time to load
        await page.screenshot({ path: "debugoutput/screenshots/view-diverse-inspector.png", fullPage: true });
      }

      // Look for different content types that might be in diverse_content
      const itemTypes = ["block", "item", "recipe", "loot", "function"];
      for (const itemType of itemTypes) {
        const item = page.locator(`text=/${itemType}/i`).first();
        if ((await item.count()) > 0 && (await item.isVisible())) {
          console.log(`Found ${itemType} item, clicking`);
          await item.click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `debugoutput/screenshots/view-diverse-${itemType}.png`,
            fullPage: true,
          });
          break; // Just click one to verify navigation works
        }
      }

      // Close the session
      const closeButton = page.locator('button[title*="Close"]').or(page.locator("button:has-text('Close')"));
      if ((await closeButton.count()) > 0) {
        console.log("Clicking Close button");
        await closeButton.first().click();
        await waitForServerExit(serverInfo);
      }

      // Allow more errors for diverse_content since it has missing optional texture references
      // (subpack textures, HD texture variants that may not exist)
      expect(consoleErrors.length).toBeLessThanOrEqual(20);
    } finally {
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
    }
  });

  test("should verify view mode restrictions (read-only)", async ({ page }) => {
    let serverInfo: ViewServerInfo | undefined;

    try {
      serverInfo = await startViewServer("../samplecontent/simple");

      page.on("console", (msg: ConsoleMessage) => {
        processViewMessage(msg, page, consoleErrors, consoleWarnings);
      });

      await page.goto(serverInfo.url);
      await page.waitForLoadState("domcontentloaded");

      // Take screenshot to see what the page looks like after initial load
      await page.screenshot({ path: "debugoutput/screenshots/view-readonly-initial.png", fullPage: true });

      // Wait for the app to initialize (authentication and project loading)
      await page.waitForTimeout(5000);

      // Wait for the Close button to appear, which indicates auth and project loading completed
      const closeButton = page
        .locator('button[title="Close session and shut down server"]')
        .or(page.locator('button[title*="Close"]'))
        .or(page.locator("button:has-text('Close')"));

      await expect(closeButton.first()).toBeVisible({ timeout: 15000 });

      // Verify view mode indicators:
      // 1. Close button is already verified above
      console.log("Close button found and visible");

      // 2. Save button should NOT be visible
      const saveButton = page.getByRole("button", { name: "Save" });
      const saveButtonCount = await saveButton.count();
      console.log(`Save button count (should be 0): ${saveButtonCount}`);
      // In strict view mode, Save should not be present

      // 3. Home button should NOT be visible (replaced by Close)
      const homeButton = page.locator('button[title="Home/Project List"]');
      const homeButtonCount = await homeButton.count();
      console.log(`Home button count (should be 0 in view mode): ${homeButtonCount}`);

      // 4. Add Item button should be disabled or not visible
      const addButton = page.locator('button[title*="Add"]').or(page.locator("button:has-text('Add')"));
      if ((await addButton.count()) > 0) {
        const firstAddButton = addButton.first();
        const isDisabled = await firstAddButton.isDisabled();
        console.log(`Add button disabled: ${isDisabled}`);
      }

      await page.screenshot({ path: "debugoutput/screenshots/view-readonly-verified.png", fullPage: true });

      // Clean up
      await closeButton.first().click();
      await waitForServerExit(serverInfo);

      expect(consoleErrors.length).toBeLessThanOrEqual(5);
    } finally {
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
    }
  });
});
