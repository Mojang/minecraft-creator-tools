// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * PlaywrightPageRenderer - Utility for rendering 3D content to PNG using Playwright.
 *
 * Browser resolution strategy (in order):
 * 1. Use system Chrome (channel: "chrome") - works on dev machines with Chrome installed
 * 2. Use system Edge (channel: "msedge") - works on Windows machines with Edge
 * 3. Use Playwright's bundled Chromium - requires `npx playwright install chromium`
 * 4. Use executable at CHROMIUM_PATH environment variable - for container scenarios
 *
 * See app/docs/PlaywrightBrowserManagement.md for a discussion of Playwright session
 * management techniques.
 */

import Log from "../core/Log";

export interface RenderOptions {
  /** Width of the rendered image in pixels */
  width?: number;
  /** Height of the rendered image in pixels */
  height?: number;
  /** Time to wait for scene to render (ms) */
  renderWaitTime?: number;
  /** Time to wait for canvas element to appear and stabilize (ms). Default: 30000 for CI reliability with SwiftShader */
  canvasTimeout?: number;
  /** Use fast mode - reduces wait times and reuses page (default: false) */
  fastMode?: boolean;
  /** Camera distance from subject */
  cameraDistance?: number;
  /** Camera angle (radians) */
  cameraAlpha?: number;
  cameraBeta?: number;
  /** Clip region for screenshot - crops out borders from the page */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Image format: 'png' or 'jpeg' (default: 'png') */
  imageFormat?: "png" | "jpeg";
  /** JPEG quality 0-100 (default: 80). Only applies when imageFormat is 'jpeg' */
  jpegQuality?: number;
  /** Force a fresh context even if viewport hasn't changed. Use when content at the same URL has changed. */
  forceNewContext?: boolean;
  /** Force a page reload even when reusing context. Use for multi-angle renders where only URL params change. */
  forceReload?: boolean;
}

export interface RenderResult {
  /** Image data as Uint8Array (PNG or JPEG depending on options) */
  imageData: Uint8Array | undefined;
  /** Error message if rendering failed */
  error?: string;
  /** Browser used for rendering */
  browserUsed?: string;
  /** Image format of the returned data */
  imageFormat?: "png" | "jpeg";
}

interface BrowserLaunchConfig {
  name: string;
  launchOptions: {
    channel?: string;
    executablePath?: string;
    headless?: boolean;
    args?: string[];
  };
}

export default class PlaywrightPageRenderer {
  private _baseUrl: string;
  private _browser: any = null;
  private _browserName: string = "";
  private _playwright: any = null;

  // Persistent context/page for fast batch rendering
  private _persistentContext: any = null;
  private _persistentPage: any = null;
  private _persistentViewport: { width: number; height: number } | null = null;
  private _lastModelPath: string | null = null; // Track last model key (without camera params) to detect changes
  private _lastFullUrl: string | null = null; // Track full URL to detect camera param changes

  constructor(baseUrl: string = "http://localhost:6126") {
    this._baseUrl = baseUrl;
  }

  /**
   * Reset the persistent page/context. Call this when switching between
   * different model types to ensure clean state.
   */
  async resetPersistentPage(): Promise<void> {
    if (this._persistentContext) {
      try {
        await this._persistentContext.close();
      } catch {
        // Ignore close errors
      }
    }
    this._persistentContext = null;
    this._persistentPage = null;
    this._persistentViewport = null;
    this._lastModelPath = null;
    this._lastFullUrl = null;
  }

  /**
   * Get the list of browser configurations to try, in order of preference.
   */
  private _getBrowserConfigs(): BrowserLaunchConfig[] {
    const configs: BrowserLaunchConfig[] = [];

    // Common args for all browsers - includes flags for:
    // - Security sandbox (needed for CI runners)
    // - Cross-origin resource loading (needed for mctools.dev textures)
    // - WebGL in headless mode (critical for 3D rendering on CI)
    const commonArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security", // Allow cross-origin requests (needed for mctools.dev textures)
      "--allow-running-insecure-content",
      // WebGL flags for headless rendering - without these, canvas may render black
      "--enable-webgl",
      "--use-gl=angle", // Use ANGLE for WebGL (works on most systems)
      "--use-angle=swiftshader", // Use SwiftShader software renderer as fallback
      "--enable-unsafe-swiftshader", // Enable SwiftShader for software WebGL on CI
      "--enable-gpu",
      "--ignore-gpu-blocklist", // Allow WebGL even on blocklisted GPUs
      "--disable-gpu-sandbox", // Needed for some CI environments
    ];

    // 1. System Chrome (most common on dev machines)
    configs.push({
      name: "System Chrome",
      launchOptions: {
        channel: "chrome",
        headless: true,
        args: commonArgs,
      },
    });

    // 2. System Edge (common on Windows)
    configs.push({
      name: "System Edge",
      launchOptions: {
        channel: "msedge",
        headless: true,
        args: commonArgs,
      },
    });

    // 3. Environment-specified Chromium path (for containers)
    const chromiumPath = process.env.CHROMIUM_PATH;
    if (chromiumPath) {
      configs.push({
        name: "Custom Chromium (CHROMIUM_PATH)",
        launchOptions: {
          executablePath: chromiumPath,
          headless: true,
          args: commonArgs,
        },
      });
    }

    // 4. Common Linux container paths
    const linuxPaths = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"];

    for (const linuxPath of linuxPaths) {
      configs.push({
        name: `Linux Chromium (${linuxPath})`,
        launchOptions: {
          executablePath: linuxPath,
          headless: true,
          args: commonArgs,
        },
      });
    }

    // 5. Playwright's bundled Chromium (requires npx playwright install)
    configs.push({
      name: "Playwright Bundled Chromium",
      launchOptions: {
        headless: true,
        args: commonArgs,
      },
    });

    return configs;
  }

  /**
   * Initialize the browser with fallback strategy.
   * Tries multiple browser configurations until one works.
   */
  async initialize(): Promise<boolean> {
    if (this._browser) {
      return true;
    }

    try {
      // Dynamic import of playwright
      this._playwright = await import("playwright");
    } catch (e) {
      Log.fail("Playwright not installed. Run: npm install playwright");
      return false;
    }

    const configs = this._getBrowserConfigs();

    for (const config of configs) {
      try {
        Log.verbose(`Trying browser: ${config.name}...`);
        this._browser = await this._playwright.chromium.launch(config.launchOptions);
        this._browserName = config.name;
        Log.verbose(`HeadlessRenderer: Using ${config.name}`);
        return true;
      } catch (e: any) {
        Log.verbose(`${config.name} not available: ${e.message}`);
        continue;
      }
    }

    Log.fail(
      "HeadlessRenderer: No browser available. Options:\n" +
        "  1. Install Chrome or Edge on your system\n" +
        "  2. Run: npx playwright install chromium\n" +
        "  3. In containers, install chromium and set CHROMIUM_PATH=/usr/bin/chromium"
    );
    return false;
  }

  /**
   * Warm up the browser by creating and destroying a test context.
   * This ensures the browser is fully ready before the first real render.
   * Call this after initialize() to improve first-render reliability.
   */
  async warmUp(): Promise<boolean> {
    if (!this._browser) {
      return false;
    }

    try {
      Log.verbose("PlaywrightPageRenderer: Warming up browser...");
      const testContext = await this._browser.newContext({
        viewport: { width: 100, height: 100 },
      });
      const testPage = await testContext.newPage();
      // Navigate to a simple about:blank to exercise the browser
      await testPage.goto("about:blank", { waitUntil: "load", timeout: 5000 });
      await testContext.close();
      Log.verbose("PlaywrightPageRenderer: Browser warm-up complete");
      return true;
    } catch (e: any) {
      Log.debugAlert(`PlaywrightPageRenderer: Warm-up failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Check if the browser is connected and responsive.
   */
  isBrowserReady(): boolean {
    return this._browser !== null && this._browser.isConnected();
  }

  /**
   * Render a model to PNG.
   *
   * @param modelPath - URL path to the model viewer page
   * @param options - Rendering options
   */
  async renderModel(modelPath: string, options: RenderOptions = {}): Promise<RenderResult> {
    const width = options.width ?? 512;
    const height = options.height ?? 512;
    const renderWaitTime = options.renderWaitTime ?? 3000;

    if (!this._browser) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          imageData: undefined,
          error: "Failed to initialize browser",
        };
      }
    }

    try {
      const context = await this._browser.newContext({
        viewport: { width, height },
      });

      const page = await context.newPage();

      // Capture console messages for debugging
      page.on("console", (msg: any) => {
        const type = msg.type();
        const text = msg.text();
        if (type === "error" || type === "warning") {
          Log.debugAlert(`Browser console ${type}: ${text}`);
        } else {
          Log.verbose(`Browser console ${type}: ${text}`);
        }
      });

      // Capture page errors
      page.on("pageerror", (error: Error) => {
        Log.debugAlert(`Browser page error: ${error.message}`);
      });

      // Navigate to the model viewer page
      const fullUrl = `${this._baseUrl}${modelPath}`;
      Log.verbose(`Navigating to: ${fullUrl}`);

      // Use domcontentloaded instead of networkidle to prevent hangs when fetching textures
      await page.goto(fullUrl, { waitUntil: "domcontentloaded" });

      // Wait for the scene to render
      await page.waitForTimeout(renderWaitTime);

      // Debug: Log the page content if verbose (use short timeout to avoid blocking on CI)
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 })
        .catch((): null => null);
      if (bodyText) {
        Log.verbose(`Page body text: ${bodyText.substring(0, 500)}`);
      }

      // Debug: Check what elements exist
      const rootElement = await page.locator("#root").count();
      Log.verbose(`#root element count: ${rootElement}`);

      // Ensure canvas exists
      const canvasCount = await page.locator("canvas").count();
      Log.verbose(`Canvas element count: ${canvasCount}`);

      if (canvasCount === 0) {
        // Check for error messages in the page (use short timeout to avoid blocking)
        const errorText = await page
          .locator(".error, .Error, [class*='error']")
          .textContent({ timeout: 5000 })
          .catch((): null => null);
        if (errorText) {
          Log.debugAlert(`Page error text: ${errorText}`);
        }

        await context.close();
        return {
          imageData: undefined,
          error: "No canvas element found - scene may not have rendered." + (errorText ? " " + errorText : ""),
        };
      }

      // Capture screenshot of just the canvas element to avoid UI chrome
      // The canvas has data-testid="block-viewer-canvas" in BlockViewer
      const canvas = page.locator("canvas").first();
      const format = options.imageFormat || "png";
      const canvasTimeout = options.canvasTimeout ?? 30000;

      // Wait for canvas to be visible and stable before taking screenshot
      try {
        await canvas.waitFor({ state: "visible", timeout: canvasTimeout });
      } catch {
        Log.debugAlert("Canvas element not visible within timeout, attempting screenshot anyway.");
      }

      const screenshotBuffer = await canvas.screenshot({
        type: format,
        quality: format === "jpeg" ? options.jpegQuality || 80 : undefined,
        omitBackground: false,
        timeout: canvasTimeout, // Use configurable timeout
      });

      await context.close();

      return {
        imageData: new Uint8Array(screenshotBuffer),
        browserUsed: this._browserName,
        imageFormat: format,
      };
    } catch (e: any) {
      Log.debugAlert(`renderModel error: ${e.message}`);
      return {
        imageData: undefined,
        error: `Rendering failed: ${e.message}`,
      };
    }
  }

  /**
   * Fast render method that reuses page for batch operations.
   * Much faster than renderModel() because it skips context creation overhead.
   *
   * @param modelPath - URL path to navigate to
   * @param options - Rendering options
   */
  async renderModelFast(modelPath: string, options: RenderOptions = {}): Promise<RenderResult> {
    const width = options.width ?? 512;
    const height = options.height ?? 512;
    const renderWaitTime = options.renderWaitTime ?? 1500; // Shorter default for fast mode

    if (!this._browser) {
      const initialized = await this.initialize();
      if (!initialized) {
        return { imageData: undefined, error: "Failed to initialize browser" };
      }
    }

    // Check if browser is still connected
    if (!this.isBrowserReady()) {
      return {
        imageData: undefined,
        error: "Browser is disconnected. Please retry - the browser will be reinitialized.",
      };
    }

    try {
      // Extract a model identifier from the path (geometry file path is the key)
      // For MCP previews, this is /temp/preview-geometry.json which is the same across calls,
      // so we need to detect when the actual content changes by checking if the URL changed
      // For block viewer, path changes with each block
      const modelKey = modelPath.split("&cameraX=")[0]; // Strip camera params to get model key

      // Check if we need to recreate the context due to viewport size change, model change, or force flag
      const needsNewContext =
        options.forceNewContext ||
        !this._persistentContext ||
        !this._persistentViewport ||
        this._persistentViewport.width !== width ||
        this._persistentViewport.height !== height ||
        this._lastModelPath !== modelKey; // Also reset when model changes

      // Track full URL to detect when only camera params change
      // Also force reload when explicitly requested (for multi-angle renders)
      const needsReload =
        options.forceReload ||
        (!needsNewContext && this._persistentPage && this._lastFullUrl && this._lastFullUrl !== modelPath);

      if (needsNewContext) {
        // Close existing context if any
        if (this._persistentContext) {
          try {
            await this._persistentContext.close();
          } catch (e) {
            // Ignore close errors
          }
          this._persistentContext = null;
          this._persistentPage = null;
          // Brief delay to allow browser to fully clean up previous context
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        try {
          this._persistentContext = await this._browser.newContext({
            viewport: { width, height },
          });
          this._persistentPage = await this._persistentContext.newPage();
        } catch (e: any) {
          return { imageData: undefined, error: `Failed to create browser context: ${e.message}` };
        }

        this._persistentViewport = { width, height };
        this._lastModelPath = modelKey;
      }

      const page = this._persistentPage;

      // Defensive check - page should never be null at this point
      if (!page) {
        return { imageData: undefined, error: "Browser page is null - context creation may have failed silently" };
      }

      const fullUrl = `${this._baseUrl}${modelPath}`;

      // DEBUG: Capture console logs from the browser
      page.on("console", (msg: any) => {
        const text = msg.text();
        if (text.includes("[STRUCTURE DEBUG]") || text.includes("[TEXTURE DEBUG]")) {
          console.log(`[BROWSER] ${text}`);
        }
      });

      // If only camera params changed (same modelKey, different full URL), reload the page
      // to force React to reinitialize with new props
      if (needsReload && !needsNewContext) {
        // BUG FIX: When reloading, the old canvas is still visible during navigation.
        // This causes waitFor({ state: "visible" }) to return immediately with stale content.
        // Solution: Navigate and wait for a fresh render cycle.

        try {
          await page.goto(fullUrl, { waitUntil: "load", timeout: 30000 });
        } catch (e: any) {
          return { imageData: undefined, error: `Page navigation failed (reload): ${e.message}` };
        }

        // After navigation, wait for the canvas to appear
        // The canvas waitFor below will handle this, but we add a small delay
        // to ensure React has time to process the new URL params and re-render
        await page.waitForTimeout(200);
      } else if (!needsNewContext) {
        // Reusing context without reload - URL hasn't changed
        // This shouldn't happen in multi-angle mode, but handle it anyway
      } else {
        // New context - navigate for the first time
        try {
          await page.goto(fullUrl, { waitUntil: "load", timeout: 30000 });
        } catch (e: any) {
          return { imageData: undefined, error: `Page navigation failed: ${e.message}` };
        }
      }
      this._lastFullUrl = modelPath;

      // Wait for canvas to appear - use configurable timeout for large structures
      // Default increased to 10s for slower CI environments
      const canvasTimeout = options.canvasTimeout ?? 10000;
      try {
        await page.locator("canvas").first().waitFor({ state: "visible", timeout: canvasTimeout });
      } catch (e) {
        // Canvas not found, provide helpful error
        return {
          imageData: undefined,
          error: `Canvas not found within ${canvasTimeout}ms timeout. Structure may be too large or page failed to load.`,
        };
      }

      // Brief wait for rendering to complete
      await page.waitForTimeout(renderWaitTime);

      // Capture screenshot of just the canvas element
      const canvas = page.locator("canvas").first();
      const format = options.imageFormat || "png";

      let screenshotBuffer: Buffer;
      try {
        screenshotBuffer = await canvas.screenshot({
          type: format,
          quality: format === "jpeg" ? options.jpegQuality || 80 : undefined,
          omitBackground: false,
          timeout: canvasTimeout, // Use same timeout for screenshot
        });
      } catch (screenshotError: any) {
        return {
          imageData: undefined,
          error: `Screenshot capture failed: ${screenshotError.message}. Canvas may have disappeared or browser context was closed.`,
        };
      }

      return {
        imageData: new Uint8Array(screenshotBuffer),
        browserUsed: this._browserName,
        imageFormat: format,
      };
    } catch (e: any) {
      // Provide more context about the error
      const errorStack = e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : "";
      return {
        imageData: undefined,
        error: `Fast render failed: ${e.message}${errorStack ? ` [${errorStack}]` : ""}`,
      };
    }
  }

  /**
   * Render a block to PNG using the BlockViewer.
   * Uses headless mode to hide UI chrome and get full-viewport canvas.
   */
  async renderBlock(blockName: string, options: RenderOptions = {}): Promise<RenderResult> {
    return this.renderModel(`/?mode=blockviewer&block=${encodeURIComponent(blockName)}&headless=true`, options);
  }

  /**
   * Render multiple blocks efficiently, reusing the browser instance and page.
   * Uses fast mode by default for significantly better performance.
   * @param blocks - Array of { name, outputPath } objects
   * @param options - Rendering options (fastMode defaults to true for batch)
   * @param onProgress - Optional callback for progress reporting
   * @returns Array of results with block names
   */
  async renderBlocks(
    blocks: Array<{ name: string; outputPath: string }>,
    options: RenderOptions = {},
    onProgress?: (blockName: string, index: number, total: number) => void
  ): Promise<Array<{ name: string; success: boolean; error?: string }>> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    const fs = await import("fs");
    const useFastMode = options.fastMode !== false; // Default to true for batch

    // Initialize browser once
    if (!this._browser) {
      const initialized = await this.initialize();
      if (!initialized) {
        return blocks.map((b) => ({ name: b.name, success: false, error: "Failed to initialize browser" }));
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (onProgress) {
        onProgress(block.name, i, blocks.length);
      }

      // Use headless=true to hide UI chrome and get full-viewport canvas
      const modelPath = `/?mode=blockviewer&block=${encodeURIComponent(block.name)}&headless=true`;
      const result = useFastMode
        ? await this.renderModelFast(modelPath, options)
        : await this.renderModel(modelPath, options);

      if (result.imageData) {
        try {
          fs.writeFileSync(block.outputPath, Buffer.from(result.imageData));
          results.push({ name: block.name, success: true });
        } catch (e: any) {
          results.push({ name: block.name, success: false, error: `Failed to write file: ${e.message}` });
        }
      } else {
        results.push({ name: block.name, success: false, error: result.error });
      }
    }

    // Clean up persistent context after batch
    if (this._persistentContext) {
      await this._persistentContext.close();
      this._persistentContext = null;
      this._persistentPage = null;
    }

    return results;
  }

  /**
   * Render a mob/entity to PNG using the MobViewer.
   * Uses headless mode to hide UI chrome and get full-viewport canvas.
   */
  async renderMob(mobId: string, options: RenderOptions = {}): Promise<RenderResult> {
    return this.renderModel(`/?mode=mobviewer&mob=${encodeURIComponent(mobId)}&headless=true`, options);
  }

  /**
   * Render an item/attachable to PNG using the ItemViewer.
   * Uses headless mode to hide UI chrome and get full-viewport canvas.
   */
  async renderItem(itemId: string, options: RenderOptions = {}): Promise<RenderResult> {
    return this.renderModel(`/?mode=itemviewer&item=${encodeURIComponent(itemId)}&headless=true`, options);
  }

  /**
   * Render multiple mobs efficiently, reusing the browser instance and page.
   * Uses fast mode by default for significantly better performance.
   * @param mobs - Array of { name, outputPath } objects
   * @param options - Rendering options (fastMode defaults to true for batch)
   * @param onProgress - Optional callback for progress reporting
   * @returns Array of results with mob names
   */
  async renderMobs(
    mobs: Array<{ name: string; outputPath: string }>,
    options: RenderOptions = {},
    onProgress?: (mobName: string, index: number, total: number) => void
  ): Promise<Array<{ name: string; success: boolean; error?: string }>> {
    return this._renderBatch(
      mobs,
      (name) => `/?mode=mobviewer&mob=${encodeURIComponent(name)}&headless=true`,
      options,
      onProgress
    );
  }

  /**
   * Render multiple items/attachables efficiently, reusing the browser instance and page.
   * Uses fast mode by default for significantly better performance.
   * @param items - Array of { name, outputPath } objects
   * @param options - Rendering options (fastMode defaults to true for batch)
   * @param onProgress - Optional callback for progress reporting
   * @returns Array of results with item names
   */
  async renderItems(
    items: Array<{ name: string; outputPath: string }>,
    options: RenderOptions = {},
    onProgress?: (itemName: string, index: number, total: number) => void
  ): Promise<Array<{ name: string; success: boolean; error?: string }>> {
    return this._renderBatch(
      items,
      (name) => `/?mode=itemviewer&item=${encodeURIComponent(name)}&headless=true`,
      options,
      onProgress
    );
  }

  /**
   * Shared batch rendering logic for mobs, items, or any entity type.
   * Reuses the browser instance and page for efficiency.
   */
  private async _renderBatch(
    entries: Array<{ name: string; outputPath: string }>,
    buildPath: (name: string) => string,
    options: RenderOptions = {},
    onProgress?: (name: string, index: number, total: number) => void
  ): Promise<Array<{ name: string; success: boolean; error?: string }>> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    const fs = await import("fs");
    const useFastMode = options.fastMode !== false; // Default to true for batch

    // Initialize browser once
    if (!this._browser) {
      const initialized = await this.initialize();
      if (!initialized) {
        return entries.map((e) => ({ name: e.name, success: false, error: "Failed to initialize browser" }));
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (onProgress) {
        onProgress(entry.name, i, entries.length);
      }

      const modelPath = buildPath(entry.name);
      const result = useFastMode
        ? await this.renderModelFast(modelPath, options)
        : await this.renderModel(modelPath, options);

      if (result.imageData) {
        try {
          fs.writeFileSync(entry.outputPath, Buffer.from(result.imageData));
          results.push({ name: entry.name, success: true });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ name: entry.name, success: false, error: `Failed to write file: ${msg}` });
        }
      } else {
        results.push({ name: entry.name, success: false, error: result.error });
      }
    }

    // Clean up persistent context after batch
    if (this._persistentContext) {
      await this._persistentContext.close();
      this._persistentContext = null;
      this._persistentPage = null;
    }

    return results;
  }

  /**
   * Render a custom model geometry with texture to PNG.
   * Uses a custom route that accepts geometry and texture data.
   *
   * @param geometryId - Identifier for the geometry (used in URL)
   * @param options - Rendering options
   */
  async renderCustomModel(geometryId: string, options: RenderOptions = {}): Promise<RenderResult> {
    return this.renderModel(`/?mode=modelviewer&geometry=${encodeURIComponent(geometryId)}`, options);
  }

  /**
   * Close the browser and clean up resources.
   */
  async close(): Promise<void> {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
    }
  }

  /**
   * Get information about the current browser being used.
   */
  getBrowserInfo(): string {
    return this._browserName || "Not initialized";
  }
}
