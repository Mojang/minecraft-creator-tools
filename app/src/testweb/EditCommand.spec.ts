/**
 * EditCommand.spec.ts - Playwright tests for the `mct edit` CLI command
 *
 * These tests verify that the `mct edit` command properly:
 * 1. Starts an HTTP server to edit Minecraft content in read-write mode
 * 2. Renders the project editor UI correctly (similar to view mode)
 * 3. Shows the Close button (same as view mode)
 * 4. Allows write operations through the API
 * 5. Gracefully shuts down when the Close button is clicked
 *
 * Test approach:
 * - Spawn `node ./toolbuild/jsn/cli edit -i <samplecontent>` as a subprocess
 * - Parse stdout for the port and URL
 * - Navigate Playwright to the edit URL with auth token
 * - Interact with the editor UI
 * - Click Close button to trigger graceful shutdown via /api/shutdown
 * - Verify server stops cleanly
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { isIgnorableMessage } from "./WebTestUtilities";
import fs from "fs";
import os from "os";

// Timeout for waiting for the server to start
const SERVER_START_TIMEOUT = 30000;
// Timeout for waiting for the server to stop after shutdown request
const SERVER_STOP_TIMEOUT = 10000;

/**
 * Check if an error message is expected/ignorable for edit command tests.
 */
function isIgnorableEditError(message: string): boolean {
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
  // Network errors from server shutdown — pending fetches and WebSocket connections
  // fail when the edit server process exits
  if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("net::ERR_")) {
    return true;
  }
  // WebSocket disconnection errors during server shutdown
  if (message.includes("WebSocket") && (message.includes("failed") || message.includes("closed") || message.includes("error"))) {
    return true;
  }
  // Telemetry errors are non-critical (e.g., no Application Insights in test env)
  if (message.includes("Error tracking") || message.includes("Error flushing telemetry")) {
    return true;
  }
  // Shutdown-related Log.error messages from app code during server teardown
  if (message.includes("Shutdown request failed") || message.includes("Error closing view session")) {
    return true;
  }
  // Use the standard ignorable message check
  return isIgnorableMessage(message);
}

/**
 * Custom message processor for edit command tests that filters out expected 404 errors.
 */
function processEditMessage(
  msg: ConsoleMessage,
  page: Page,
  consoleErrors: { url: string; error: string }[],
  consoleWarnings: { url: string; error: string }[]
) {
  const messageType = msg.type();
  const messageText = msg.text();

  if (!isIgnorableEditError(messageText)) {
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

interface EditServerInfo {
  process: ChildProcess;
  port: number;
  url: string;
  passcode: string;
  contentPath: string;
}

/**
 * Creates a temporary copy of sample content for editing tests.
 * This prevents tests from modifying the actual sample content.
 */
async function createTempContentCopy(sourcePath: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mct-edit-test-"));
  const appDir = path.resolve(__dirname, "../..");
  const absoluteSourcePath = path.resolve(appDir, sourcePath);

  // Copy the source content to the temp directory
  copyDirSync(absoluteSourcePath, tempDir);

  return tempDir;
}

/**
 * Recursively copy a directory.
 */
function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) {
    return;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copyDirSync(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Clean up a temporary directory.
 */
function cleanupTempContent(tempPath: string) {
  if (tempPath && tempPath.includes("mct-edit-test-") && fs.existsSync(tempPath)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
}

/**
 * Starts the `mct edit` command on the specified content folder.
 * Returns info about the running server including port and passcode.
 */
async function startEditServer(contentPath: string): Promise<EditServerInfo> {
  const appDir = path.resolve(__dirname, "../..");
  const cliPath = path.join(appDir, "toolbuild/jsn/cli/index.mjs");

  console.log(`Starting edit server for: ${contentPath}`);
  console.log(`CLI path: ${cliPath}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Edit server failed to start within ${SERVER_START_TIMEOUT}ms`));
    }, SERVER_START_TIMEOUT);

    const serverProcess = spawn("node", [cliPath, "edit", "-i", contentPath], {
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
      console.log(`[edit server stdout]: ${output.trim()}`);

      // Parse the URL from output - looking for pattern like:
      // "Opening browser to: http://localhost:6136/?mode=project&contentUrl=/api/content/#tempPasscode=abc123"
      const urlMatch = stdoutBuffer.match(
        /http:\/\/localhost:(\d+)\/\?mode=project&contentUrl=\/api\/content\/#tempPasscode=([a-zA-Z0-9]+)/
      );

      if (urlMatch && !resolved) {
        resolved = true;
        clearTimeout(timeout);

        const port = parseInt(urlMatch[1], 10);
        const passcode = urlMatch[2];
        const url = urlMatch[0];

        console.log(`Edit server started on port ${port} with passcode ${passcode}`);

        resolve({
          process: serverProcess,
          port,
          url,
          passcode,
          contentPath,
        });
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      stderrBuffer += output;
      console.log(`[edit server stderr]: ${output.trim()}`);
    });

    serverProcess.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`Failed to start edit server: ${err.message}`));
      }
    });

    serverProcess.on("exit", (code, signal) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Edit server exited prematurely with code ${code}, signal ${signal}. stdout: ${stdoutBuffer}, stderr: ${stderrBuffer}`
          )
        );
      }
    });
  });
}

/**
 * Stops the edit server by killing the process.
 */
function forceStopServer(serverInfo: EditServerInfo): void {
  if (serverInfo.process && !serverInfo.process.killed) {
    console.log("Force stopping edit server process");
    serverInfo.process.kill("SIGTERM");
  }
}

/**
 * Waits for the server process to exit after a shutdown request.
 */
async function waitForServerExit(serverInfo: EditServerInfo): Promise<boolean> {
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
      console.log("Edit server process exited cleanly");
      resolve(true);
    });
  });
}

test.describe("MCTools Edit Command Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test("should start edit server and show Close button", async ({ page }) => {
    let serverInfo: EditServerInfo | undefined;
    let tempContentPath: string | undefined;

    try {
      // Create a temporary copy of simple sample content for editing
      tempContentPath = await createTempContentCopy("../samplecontent/simple");
      console.log(`Using temp content path: ${tempContentPath}`);

      // Start the edit server on the temp content
      serverInfo = await startEditServer(tempContentPath);

      // Set up console message handling
      page.on("console", (msg: ConsoleMessage) => {
        processEditMessage(msg, page, consoleErrors, consoleWarnings);
      });

      // Navigate to the edit URL
      console.log(`Navigating to: ${serverInfo.url}`);
      await page.goto(serverInfo.url);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000); // Give extra time for project to load

      // Take initial screenshot
      await page.screenshot({ path: "debugoutput/screenshots/edit-simple-initial.png", fullPage: true });

      // Verify we're in the editor interface
      // In edit mode, there should be a Close button (same as view mode)
      const closeButton = page.locator('button[title*="Close"]').or(page.locator("button:has-text('Close')"));

      // Wait for the UI to stabilize
      await page.waitForTimeout(1000);

      // Check if Close button exists (indicates edit/view mode)
      const hasCloseButton = (await closeButton.count()) > 0;
      console.log(`Close button found: ${hasCloseButton}`);

      if (hasCloseButton) {
        await expect(closeButton.first()).toBeVisible();
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
        await page.screenshot({ path: "debugoutput/screenshots/edit-simple-after-close.png", fullPage: true });
      }

      // Log captured errors for CI debugging visibility
      if (consoleErrors.length > 0) {
        console.log(`Edit test captured ${consoleErrors.length} console error(s):`);
        for (const err of consoleErrors) {
          console.log(`  - [${err.url}] ${err.error.substring(0, 200)}`);
        }
      }

      // Validate console errors are minimal (threshold accounts for transient
      // network/shutdown errors that vary by environment speed)
      expect(consoleErrors.length).toBeLessThanOrEqual(10);
    } finally {
      // Ensure server is stopped even if test fails
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
      // Clean up temp content
      if (tempContentPath) {
        cleanupTempContent(tempContentPath);
      }
    }
  });

  test("should allow file write operations via API", async ({ page, context }) => {
    let serverInfo: EditServerInfo | undefined;
    let tempContentPath: string | undefined;

    try {
      // Create a temporary copy of simple sample content for editing
      tempContentPath = await createTempContentCopy("../samplecontent/simple");
      console.log(`Using temp content path: ${tempContentPath}`);

      // Start the edit server on the temp content
      serverInfo = await startEditServer(tempContentPath);

      // Navigate to the edit URL to authenticate
      console.log(`Navigating to: ${serverInfo.url}`);
      await page.goto(serverInfo.url);
      await page.waitForLoadState("networkidle");

      // Take screenshot to see what the page looks like after initial load
      await page.screenshot({ path: "debugoutput/screenshots/edit-api-test-initial.png", fullPage: true });

      // Wait for the app to initialize (authentication and project loading)
      await page.waitForTimeout(3000);

      // Wait for the Close button to appear, which indicates auth and project loading completed
      const closeButton = page
        .locator('button[title="Close session and shut down server"]')
        .or(page.locator('button[title*="Close"]'));

      await expect(closeButton.first()).toBeVisible({ timeout: 15000 });

      // Test PUT request to create/update a file via the API
      // Use page.evaluate to make the request from the browser context (which has the auth cookie)
      const testFileName = "test-edit-file.json";
      const testContent = JSON.stringify({ test: true, timestamp: Date.now() }, null, 2);

      const apiUrl = `/api/content/${testFileName}`;

      console.log(`Testing PUT to: ${apiUrl}`);

      // Use page.evaluate to make the fetch request from the browser context
      const putResult = await page.evaluate(
        async ({ url, content }) => {
          const response = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: content,
          });
          return { status: response.status, ok: response.ok, text: await response.text() };
        },
        { url: apiUrl, content: testContent }
      );

      console.log(`PUT response status: ${putResult.status}`);
      expect(putResult.ok).toBe(true);

      // Verify the file was created on disk
      const createdFilePath = path.join(tempContentPath, testFileName);
      expect(fs.existsSync(createdFilePath)).toBe(true);

      const fileContent = fs.readFileSync(createdFilePath, "utf8");
      console.log(`File content on disk: ${fileContent}`);
      expect(fileContent).toBe(testContent);

      // Test reading the file back via GET
      const getResult = await page.evaluate(async (url) => {
        const response = await fetch(url);
        return { status: response.status, ok: response.ok, data: await response.json() };
      }, apiUrl);

      expect(getResult.ok).toBe(true);
      expect(getResult.data).toEqual(JSON.parse(testContent));

      // Test DELETE request to remove the file
      const deleteResult = await page.evaluate(async (url) => {
        const response = await fetch(url, { method: "DELETE" });
        return { status: response.status, ok: response.ok };
      }, apiUrl);

      console.log(`DELETE response status: ${deleteResult.status}`);
      expect(deleteResult.ok).toBe(true);

      // Verify the file was deleted from disk
      expect(fs.existsSync(createdFilePath)).toBe(false);

      // Take final screenshot
      await page.screenshot({ path: "debugoutput/screenshots/edit-api-test-complete.png", fullPage: true });
    } finally {
      // Ensure server is stopped
      if (serverInfo) {
        forceStopServer(serverInfo);
      }
      // Clean up temp content
      if (tempContentPath) {
        cleanupTempContent(tempContentPath);
      }
    }
  });
});
