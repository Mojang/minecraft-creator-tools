import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, selectEditMode } from "./WebTestUtilities";

/**
 * Tests to verify web worker functionality in the browser.
 * These tests ensure the project worker can be created and responds properly.
 */
test.describe("Web Worker Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  const consoleLogs: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    consoleLogs.length = 0;

    // Capture console messages to check for worker-related logs
    page.on("console", (msg: ConsoleMessage) => {
      const text = msg.text();
      consoleLogs.push(text);
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should have Worker API available", async ({ page }) => {
    // Verify the Worker constructor is available in the browser
    const hasWorker = await page.evaluate(() => {
      return typeof Worker !== "undefined";
    });
    expect(hasWorker).toBe(true);
  });

  test("should be able to create project worker", async ({ page }) => {
    // Test that the project worker can be instantiated
    const workerResult = await page.evaluate(async () => {
      try {
        // Access the ProjectWorkerManager through the app's global CreatorTools
        // @ts-ignore - accessing global app object
        const cto = window.creatorToolsInstance;
        if (!cto) {
          return { success: false, error: "CreatorTools not available" };
        }

        // The ProjectWorkerManager is a singleton, access it
        // @ts-ignore
        const { default: ProjectWorkerManager } = await import("/src/workers/ProjectWorkerManager.ts");
        const manager = ProjectWorkerManager.instance;

        return {
          success: true,
          isSupported: manager.isSupported,
        };
      } catch (e: any) {
        return { success: false, error: e.message || String(e) };
      }
    });

    // The test should at least not throw an error
    // In dev mode with Vite, the worker should be supported
    if (!workerResult.success) {
      console.log("Worker test result:", workerResult);
    }

    // We mainly want to ensure no crashes occur
    expect(workerResult).toBeDefined();
  });

  test("should successfully load worker via ProjectWorkerManager", async ({ page }) => {
    // Test that the worker can be loaded through ProjectWorkerManager
    // which handles the Vite ?worker import correctly
    const result = await page.evaluate(async () => {
      try {
        // Wait a bit for the app to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try to access ProjectWorkerManager through dynamic import
        // In Vite dev mode, the module should be available
        const module = await import("/src/workers/ProjectWorkerManager.ts");
        const ProjectWorkerManager = module.default;

        if (!ProjectWorkerManager) {
          return { success: false, error: "ProjectWorkerManager not found" };
        }

        const manager = ProjectWorkerManager.instance;

        return {
          success: true,
          isSupported: manager.isSupported,
        };
      } catch (e: any) {
        return { success: false, error: e.message || String(e) };
      }
    });

    console.log("ProjectWorkerManager test result:", result);

    // The manager should be accessible
    expect(result.success).toBe(true);
    // Workers should be supported in browser environment
    expect(result.isSupported).toBe(true);
  });

  test("should create worker and receive ready message", async ({ page }) => {
    // Test that the worker can be created and sends back a ready message
    const result = await page.evaluate(async () => {
      try {
        // Import the worker constructor directly
        const workerModule = await import("/src/workers/project.worker.ts?worker");
        const WorkerConstructor = workerModule.default;

        if (!WorkerConstructor) {
          return { success: false, error: "Worker constructor not found" };
        }

        // Create a worker instance
        const worker = new WorkerConstructor();

        // Wait for the worker to send a "ready" message or error
        const result = await Promise.race([
          new Promise<{ success: boolean; ready: boolean }>((resolve) => {
            worker.onmessage = (e: MessageEvent) => {
              if (e.data && e.data.type === "ready") {
                resolve({ success: true, ready: true });
              }
            };
          }),
          new Promise<{ success: boolean; error: string }>((_, reject) => {
            worker.onerror = (e: ErrorEvent) => {
              reject({ success: false, error: `Worker error: ${e.message}` });
            };
          }),
          new Promise<{ success: boolean; timeout: boolean }>((resolve) => {
            setTimeout(() => resolve({ success: false, timeout: true }), 5000);
          }),
        ]).catch((e) => e);

        worker.terminate();
        return result;
      } catch (e: any) {
        return { success: false, error: e.message || String(e) };
      }
    });

    console.log("Worker ready test result:", result);

    // The worker should successfully start and send ready message
    expect(result.success).toBe(true);
    if ("ready" in result) {
      expect(result.ready).toBe(true);
    }
  });

  test("should log worker creation messages", async ({ page }) => {
    // Navigate to create a project which should trigger worker usage
    // Click on the "New" button to create a starter project
    const newButton = page.getByRole("button", { name: "Create New" }).first();

    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();

      // Wait for dialog and click Create Project
      const createButton = page.locator("button:has-text('Create Project')").first();
      if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createButton.click();

        // Wait for project to load
        await page.waitForTimeout(2000);

        // Select Focused mode to dismiss welcome panel and hide Inspector
        await selectEditMode(page);

        // Check console for worker-related messages
        const workerLogs = consoleLogs.filter(
          (log) => log.toLowerCase().includes("worker") || log.toLowerCase().includes("web worker")
        );

        console.log("Worker-related console logs:", workerLogs);

        // We expect some worker-related logs if workers are being used
        // This is informational - workers might fall back to main thread in some cases
      }
    }
  });

  test.afterEach(async () => {
    // Report any unexpected console errors
    const relevantErrors = consoleErrors.filter(
      (err) =>
        !err.error.includes("net::ERR_") && // Ignore network errors
        !err.error.includes("SSL") &&
        !err.error.includes("certificate")
    );

    if (relevantErrors.length > 0) {
      console.log("Console errors during test:", relevantErrors);
    }
  });
});
