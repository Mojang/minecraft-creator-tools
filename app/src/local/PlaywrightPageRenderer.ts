// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/// <reference lib="dom" />

/**
 * PlaywrightPageRenderer - Utility for rendering 3D content to PNG using Playwright.
 *
 * Browser resolution strategy (in order):
 * 1. Use system Chrome (channel: "chrome") - works on dev machines with Chrome installed
 * 2. Use system Edge (channel: "msedge") - works on Windows machines with Edge
 * 3. Use the executable at CHROMIUM_PATH - for container scenarios
 * 4. Try common Linux Chromium executable paths
 * 5. Use Playwright's bundled Chromium - requires `npx playwright install chromium`
 *
 * A browser that isn't installed is skipped rather than launched: Playwright creates two temporary
 * folders before it looks for the browser, and leaves them behind when it can't find one
 * (BrowserInstallation.ts).
 *
 * CLI callers opt into "auto": verify a working hardware WebGL context before
 * publishing the browser. Each search closes rejected candidates and continues
 * within its shared deadline; software follows the hardware search. Other callers
 * keep the software default; explicit booleans retain their launch preference.
 * Initialization is single-flight. close() cancels a pending probe and waits for
 * owned browser cleanup, including a launch that completes after cancellation.
 *
 * Closing waits for the browser process, not for processes it started. Browsers
 * launch without their updater, and once a browser process exits, its pipes are
 * released even if a child process still holds them (BrowserProcessPipes.ts).
 *
 * See docs/PlaywrightBrowserManagement.md for the policy and lifecycle.
 */

import Log from "../core/Log";
import type { Browser, LaunchOptions, Page } from "playwright";
import { RenderPresentationOptions, renderPresentationUrl } from "../app/RenderPresentation";
import RenderPageDiagnostics from "./RenderPageDiagnostics";
import { PNG } from "pngjs";
import { releaseBrowserPipesAfterExit } from "./BrowserProcessPipes";
import { isBrowserInstalled } from "./BrowserInstallation";

/** Reject empty, corrupt, or incorrectly sized canvas output before a caller can write it. */
export function decodePresentationPng(data: string, width: number, height: number): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw new Error("Render presentation capture did not produce a PNG image.");
  const bytes = Buffer.from(match[1], "base64");
  let png: PNG;
  try {
    png = PNG.sync.read(bytes);
  } catch (error) {
    throw new Error(
      "Render presentation capture produced invalid PNG data: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
  if (png.width !== width || png.height !== height) {
    throw new Error(
      `Render presentation capture produced ${png.width}x${png.height} pixels; expected ${width}x${height}.`
    );
  }
  return bytes;
}

export interface RenderOptions {
  /** CLI stage and exact pixel capture; omitted by other renderer consumers. */
  presentation?: RenderPresentationOptions;
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
  /**
   * When rendering blocks, skip the gradient skybox and paint a uniform light
   * sky-blue clearColor instead. Used by the block sprite atlas pipeline so
   * composited thumbnails don't carry a gradient background.
   */
  flatBackground?: boolean;
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

export interface PlaywrightPageRendererOptions {
  /** "auto" verifies hardware WebGL with software fallback. Booleans retain the explicit launch preference. */
  useHardwareGpu?: boolean | "auto";
}

interface BrowserLaunchConfig {
  name: string;
  launchOptions: LaunchOptions;
}

export default class PlaywrightPageRenderer {
  private _baseUrl: string;
  private _useHardwareGpu: boolean | "auto";
  private _browser: Browser | null = null;
  private _browserName: string = "";
  private _playwright: typeof import("playwright") | null = null;
  private _initialization: Promise<boolean> | undefined;
  private _initializationAbort: AbortController | undefined;
  private _closing: Promise<void> | undefined;

  // Persistent context/page for fast batch rendering
  private _persistentContext: any = null;
  private _persistentPage: any = null;
  private _persistentViewport: { width: number; height: number } | null = null;
  private _persistentDiagnostics: RenderPageDiagnostics | null = null;
  private _lastModelPath: string | null = null; // Track last model key (without camera params) to detect changes
  private _lastFullUrl: string | null = null; // Track full URL to detect camera param changes

  constructor(baseUrl: string = "http://localhost:6126", options: PlaywrightPageRendererOptions = {}) {
    this._baseUrl = baseUrl;
    this._useHardwareGpu = options.useHardwareGpu ?? false;
  }

  /**
   * Reset the persistent page/context. Call this when switching between
   * different model types to ensure clean state.
   */
  async resetPersistentPage(): Promise<void> {
    if (this._persistentContext) {
      if (this._lastFullUrl?.includes("&presentation=true") && !this._persistentPage?.isClosed()) {
        await this.releasePresentation(this._persistentPage);
      }

      try {
        await this._persistentContext.close();
      } catch {
        // Ignore close errors
      }
    }
    this._persistentContext = null;
    this._persistentPage = null;
    this._persistentDiagnostics = null;
    this._persistentViewport = null;
    this._lastModelPath = null;
    this._lastFullUrl = null;
  }

  /**
   * Asks the page to release its presentation scene before its context closes. Playwright's
   * page.evaluate() has no timeout and never settles while a navigation is stalled, as when the
   * render server never returns a document. So this waits at most `timeoutMs`, a second unless a
   * test passes less; callers then close the context, and a failed render reports its own error
   * instead of hanging.
   */
  private async releasePresentation(page: Page | undefined, timeoutMs = 1000): Promise<void> {
    if (!page || page.isClosed()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const released = await Promise.race([
        page.evaluate(() => window.mctPresentation?.release()).then(() => true),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
      if (!released) {
        Log.debug(
          `The render page didn't release its presentation scene within ${timeoutMs}ms; closing its context anyway.`
        );
      }
    } catch (error) {
      Log.debug("Could not release the presentation scene before closing its context: " + String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get the list of browser configurations to try, in order of preference.
   */
  private _getBrowserConfigs(useHardwareGpu: boolean): BrowserLaunchConfig[] {
    const configs: BrowserLaunchConfig[] = [];

    const baseArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security", // Allow cross-origin requests (needed for mctools.dev textures)
      "--allow-running-insecure-content",
      "--enable-webgl",
      "--use-gl=angle", // Use ANGLE for WebGL (works on most systems)
      // Edge and Chrome start their updater about 19 seconds into a session. It inherits the
      // browser's stdout and stderr and can outlive the browser. Playwright 1.62 adds this switch too.
      "--disable-updater-scheduler",
    ];
    const rendererArgs = useHardwareGpu
      ? [
          // Prefer Chromium's normal hardware ANGLE backend.
          "--enable-gpu",
        ]
      : [
          // Default to SwiftShader for deterministic CI/headless rendering.
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
        ];
    const commonArgs = [...baseArgs, ...rendererArgs];

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
    if (this._closing) {
      await this._closing;
    }
    if (this.isBrowserReady()) {
      return true;
    }

    if (!this._initialization) {
      const abort = new AbortController();
      this._initializationAbort = abort;
      this._initialization = this._initialize(abort.signal).finally(() => {
        this._initialization = undefined;
        this._initializationAbort = undefined;
      });
    }
    return this._initialization;
  }

  private async _initialize(signal: AbortSignal): Promise<boolean> {
    try {
      this._playwright = await import("playwright");
    } catch {
      Log.fail("Playwright not installed. Run: npm install playwright");
      return false;
    }

    const automatic = this._useHardwareGpu === "auto";
    if (await this._tryBrowser(this._useHardwareGpu !== false, automatic, signal)) {
      return true;
    }
    if (automatic && !signal.aborted) {
      Log.verbose("HeadlessRenderer: Hardware WebGL unavailable; using software WebGL.");
      if (await this._tryBrowser(false, true, signal)) {
        return true;
      }
    }
    if (!signal.aborted) {
      Log.fail(
        "HeadlessRenderer: No browser available. Options:\n" +
          "  1. Install Chrome or Edge on your system\n" +
          "  2. Run: npx playwright install chromium\n" +
          "  3. In containers, install chromium and set CHROMIUM_PATH=/usr/bin/chromium"
      );
    }
    return false;
  }

  private async _tryBrowser(useHardwareGpu: boolean, verifyWebGl: boolean, signal: AbortSignal): Promise<boolean> {
    const deadline = verifyWebGl ? Date.now() + (useHardwareGpu ? 10000 : 30000) : Infinity;
    for (const config of this._getBrowserConfigs(useHardwareGpu)) {
      if (!(await isBrowserInstalled(this._playwright!.chromium, config.launchOptions))) {
        Log.verbose(`${config.name} not available: not installed.`);
        continue;
      }
      const remaining = deadline - Date.now();
      if (signal.aborted || remaining <= 0) {
        break;
      }
      let browser: Browser | undefined;
      try {
        Log.verbose(`Trying browser: ${config.name}...`);
        browser = await this._playwright!.chromium.launch({
          ...config.launchOptions,
          timeout: verifyWebGl ? Math.min(5000, remaining) : undefined,
        });
        releaseBrowserPipesAfterExit(browser);
        if (
          !signal.aborted &&
          (!verifyWebGl || (await this._checkWebGl(browser, useHardwareGpu, signal, deadline))) &&
          !signal.aborted
        ) {
          this._browser = browser;
          this._browserName = config.name;
          Log.verbose(`HeadlessRenderer: Using ${config.name}`);
          return true;
        }
      } catch (error) {
        Log.verbose(`${config.name} not available: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (browser && browser !== this._browser) {
          await browser.close();
        }
      }
    }
    return false;
  }

  private async _checkWebGl(
    browser: Browser,
    requireHardware: boolean,
    signal: AbortSignal,
    deadline: number
  ): Promise<boolean> {
    const timeout = Math.min(3000, deadline - Date.now());
    if (timeout <= 0) throw new Error("WebGL search timed out");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("WebGL check timed out")), timeout);
      cancel = () => reject(new Error("Renderer initialization cancelled"));
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    });
    const probe = async () => {
      const context = await browser.newContext({ viewport: { width: 1, height: 1 } });
      try {
        const page = await context.newPage();
        return await page.evaluate((hardware) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const attributes = { failIfMajorPerformanceCaveat: hardware };
          const gl = canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes);
          if (!gl || !("readPixels" in gl)) return null;
          try {
            const info = gl.getExtension("WEBGL_debug_renderer_info");
            gl.clearColor(0.25, 0.5, 0.75, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            const pixel = new Uint8Array(4);
            // Readback waits for completed drawing, not just successful context creation.
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            if (
              gl.isContextLost() ||
              gl.getError() !== gl.NO_ERROR ||
              Math.abs(pixel[0] - 64) > 1 ||
              Math.abs(pixel[1] - 128) > 1 ||
              Math.abs(pixel[2] - 191) > 1 ||
              pixel[3] !== 255
            ) {
              return null;
            }
            return { renderer: info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null };
          } finally {
            gl.getExtension("WEBGL_lose_context")?.loseContext();
          }
        }, requireHardware);
      } finally {
        await context.close();
      }
    };
    try {
      const result = await Promise.race([probe(), interrupted]);
      if (Date.now() >= deadline) throw new Error("WebGL search timed out");
      const renderer = result?.renderer;
      const software =
        /swiftshader|llvmpipe|softpipe|lavapipe|swrast|openswr|software|basic render|gdi generic|warp|virgl|virtio|vmware|parallels|virtualbox/i;
      const hardware = /apple|nvidia|geforce|quadro|amd|radeon|intel|adreno|mali|powervr|qualcomm/i;
      const available = typeof renderer === "string" && !software.test(renderer) && hardware.test(renderer);
      Log.verbose(`HeadlessRenderer: WebGL renderer: ${renderer ?? "unavailable"}; hardware verified: ${available}.`);
      return result !== null && (!requireHardware || available) && !signal.aborted;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
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
    if (options.presentation) modelPath = renderPresentationUrl(modelPath, options.presentation);
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

    const browser = this._browser;
    if (!browser) {
      return { imageData: undefined, error: "Browser was closed before rendering" };
    }
    let presentationPage: Page | undefined;
    let diagnostics: RenderPageDiagnostics | undefined;
    try {
      const context = await browser.newContext({
        viewport: { width, height },
      });

      const page = await context.newPage();
      diagnostics = RenderPageDiagnostics.watch(page, this._baseUrl);
      if (options.presentation) presentationPage = page;

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

      if (options.presentation) {
        await page
          .locator("canvas")
          .first()
          .waitFor({
            state: "visible",
            timeout: options.canvasTimeout ?? 30000,
          });
      }

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

        await this.releasePresentation(presentationPage);
        await context.close();
        return {
          imageData: undefined,
          error: "No canvas element found - scene may not have rendered." + (errorText ? " " + errorText : ""),
        };
      }

      // Use page-level screenshot instead of canvas element screenshot.
      // locator.screenshot() waits for element "stability" (no bounding box changes between
      // animation frames), which can fail unpredictably with WebGL/Babylon.js canvases that
      // resize during initialization. page.screenshot() captures the viewport directly.
      const format = options.presentation ? "png" : options.imageFormat || "png";
      const canvasTimeout = options.canvasTimeout ?? 30000;

      // Wait for canvas to be visible before capturing
      try {
        await page.locator("canvas").first().waitFor({ state: "visible", timeout: canvasTimeout });
      } catch {
        Log.debugAlert("Canvas element not visible within timeout, attempting screenshot anyway.");
      }

      const screenshotBuffer = options.presentation
        ? await this.capturePresentation(page, options)
        : await page.screenshot({
            type: format,
            quality: format === "jpeg" ? options.jpegQuality || 80 : undefined,
            omitBackground: false,
            fullPage: false,
            timeout: canvasTimeout,
          });

      await this.releasePresentation(presentationPage);
      await context.close();

      return {
        imageData: new Uint8Array(screenshotBuffer),
        browserUsed: this._browserName,
        imageFormat: format,
      };
    } catch (e: any) {
      Log.debugAlert(`renderModel error: ${e.message}`);
      const error = await RenderPageDiagnostics.explain(diagnostics, `Rendering failed: ${e.message}`, e);
      await this.releasePresentation(presentationPage);
      // Ensure context is closed even on error to prevent resource leaks
      try {
        const contexts = this._browser?.contexts?.() ?? [];
        for (const ctx of contexts) {
          await ctx.close().catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }
      return {
        imageData: undefined,
        error,
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
    if (options.presentation) modelPath = renderPresentationUrl(modelPath, options.presentation);
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

    const browser = this._browser;
    if (!browser) {
      return { imageData: undefined, error: "Browser was closed before rendering" };
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
          await this.resetPersistentPage();
          // Brief delay to allow browser to fully clean up previous context
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        try {
          this._persistentContext = await browser.newContext({
            viewport: { width, height },
          });
          this._persistentPage = await this._persistentContext.newPage();
          this._persistentDiagnostics = RenderPageDiagnostics.watch(this._persistentPage, this._baseUrl);
          this._persistentPage.on("console", (msg: any) => {
            const text = msg.text();
            if (text.includes("[STRUCTURE DEBUG]") || text.includes("[TEXTURE DEBUG]")) {
              console.log(`[BROWSER] ${text}`);
            }
          });
        } catch (e: any) {
          return { imageData: undefined, error: `Failed to create browser context: ${e.message}` };
        }

        this._persistentViewport = { width, height };
        this._lastModelPath = modelKey;
      }

      const page = this._persistentPage;
      const diagnostics = this._persistentDiagnostics;

      // Defensive check - page should never be null at this point
      if (!page) {
        return { imageData: undefined, error: "Browser page is null - context creation may have failed silently" };
      }

      const fullUrl = `${this._baseUrl}${modelPath}`;

      // If only camera params changed (same modelKey, different full URL), reload the page
      // to force React to reinitialize with new props
      if (needsReload && !needsNewContext) {
        // BUG FIX: When reloading, the old canvas is still visible during navigation.
        // This causes waitFor({ state: "visible" }) to return immediately with stale content.
        // Solution: Navigate and wait for a fresh render cycle.

        diagnostics?.reset();
        try {
          await page.goto(fullUrl, { waitUntil: "load", timeout: 30000 });
        } catch (e: any) {
          return {
            imageData: undefined,
            error: await RenderPageDiagnostics.explain(diagnostics, `Page navigation failed (reload): ${e.message}`, e),
          };
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
          return {
            imageData: undefined,
            error: await RenderPageDiagnostics.explain(diagnostics, `Page navigation failed: ${e.message}`, e),
          };
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
          error: await RenderPageDiagnostics.explain(
            diagnostics,
            `Canvas not found within ${canvasTimeout}ms timeout. Structure may be too large or page failed to load.`,
            e
          ),
        };
      }

      // Brief wait for rendering to complete
      await page.waitForTimeout(renderWaitTime);

      // Capture screenshot of just the canvas element
      const canvas = page.locator("canvas").first();
      const format = options.presentation ? "png" : options.imageFormat || "png";

      let screenshotBuffer: Buffer;
      try {
        screenshotBuffer = options.presentation
          ? await this.capturePresentation(page, options)
          : await canvas.screenshot({
              type: format,
              quality: format === "jpeg" ? options.jpegQuality || 80 : undefined,
              omitBackground: false,
              timeout: canvasTimeout, // Use same timeout for screenshot
            });
      } catch (screenshotError: any) {
        return {
          imageData: undefined,
          error: await RenderPageDiagnostics.explain(
            diagnostics,
            `Screenshot capture failed: ${screenshotError.message}. Canvas may have disappeared or browser context was closed.`,
            screenshotError
          ),
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
    const flat = options.flatBackground ? "&flatbg=true" : "";
    return this.renderModel(`/?mode=blockviewer&block=${encodeURIComponent(blockName)}&headless=true${flat}`, options);
  }

  private async capturePresentation(page: Page, options: RenderOptions): Promise<Buffer> {
    await page.waitForFunction(
      () => window.mctPresentation !== undefined || window.mctPresentationError !== undefined,
      {},
      { timeout: options.canvasTimeout ?? 30000 }
    );
    const data = await page.evaluate(
      async ({ width, height, presentation }) => {
        if (window.mctPresentationError) throw new Error(window.mctPresentationError);
        const renderer = window.mctPresentation;
        if (!renderer || !presentation) throw new Error("The presentation renderer is unavailable.");
        if (!presentation.allViews) return renderer.capture(presentation.view, width, height);
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create the four-view image.");
        const labelHeight = Math.max(
          1,
          Math.min(height - 1, Math.round(Math.min(height / 5, Math.max(36, height * 0.06))))
        );
        ctx.fillStyle = "#363636";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const views = ["three-quarter", "front", "side", "back"] as const;
        for (let i = 0; i < views.length; i++) {
          const x = (i % 2) * width;
          const y = Math.floor(i / 2) * height;
          const image = new Image();
          image.src = renderer.capture(views[i], width, height - labelHeight);
          await image.decode();
          ctx.drawImage(image, x, y + labelHeight, width, height - labelHeight);
          ctx.fillStyle = "#dedede";
          ctx.font = `${Math.max(8, Math.round(labelHeight * 0.4))}px monospace`;
          ctx.textBaseline = "middle";
          ctx.fillText(
            ["THREE-QUARTER", "FRONT", "SIDE (+X)", "BACK"][i],
            x + labelHeight * 0.35,
            y + labelHeight / 2,
            width - labelHeight * 0.7
          );
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 512));
        const alignment = ctx.lineWidth % 2 === 1 ? 0.5 : 0;
        ctx.beginPath();
        ctx.moveTo(width + alignment, 0);
        ctx.lineTo(width + alignment, canvas.height);
        ctx.moveTo(0, height + alignment);
        ctx.lineTo(canvas.width, height + alignment);
        ctx.stroke();
        return canvas.toDataURL("image/png");
      },
      { width: options.width ?? 1024, height: options.height ?? 1024, presentation: options.presentation }
    );
    Log.verbose(
      "Render presentation capture: " + JSON.stringify(await page.evaluate(() => window.mctPresentation?.describe()))
    );
    const factor = options.presentation?.allViews ? 2 : 1;
    return decodePresentationPng(data, (options.width ?? 1024) * factor, (options.height ?? 1024) * factor);
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
      const flat = options.flatBackground ? "&flatbg=true" : "";
      const modelPath = `/?mode=blockviewer&block=${encodeURIComponent(block.name)}&headless=true${flat}`;
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
    await this.resetPersistentPage();

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
    await this.resetPersistentPage();

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
    if (!this._closing) {
      this._initializationAbort?.abort();
      this._closing = (async () => {
        await this._initialization;
        const browser = this._browser;
        try {
          await this.resetPersistentPage();
        } finally {
          this._browser = null;
          // Playwright closes its owned process and force-kills it if graceful close times out.
          // It resolves once the process has exited and its pipes have closed (BrowserProcessPipes.ts).
          await browser?.close();
        }
      })();
    }
    const closing = this._closing;
    try {
      await closing;
    } finally {
      if (this._closing === closing) {
        this._closing = undefined;
      }
    }
  }

  /**
   * Get information about the current browser being used.
   */
  getBrowserInfo(): string {
    return this._browserName || "Not initialized";
  }
}
