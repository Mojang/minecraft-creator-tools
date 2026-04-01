// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SVG LOADER - Centralized SVG Icon Loading Utility
 *
 * Provides a unified way to load SVG icons that works across all contexts:
 * - Web browser (http/https)
 * - Electron app (file:// protocol)
 * - VS Code extension
 *
 * Key Features:
 * - Automatic protocol detection to choose the right loading strategy
 * - SVG content caching to prevent duplicate loads
 * - Fallback handling when icons can't be loaded
 * - Memory-safe: caches failed loads to prevent retry loops
 *
 * Usage:
 *   import SvgLoader from "../core/SvgLoader";
 *   const svgContent = await SvgLoader.load("/res/icons/myicon.svg");
 * ═══════════════════════════════════════════════════════════════════════════
 */

import CreatorToolsHost from "../app/CreatorToolsHost";
import Log from "./Log";

// Cache for loaded SVG content (keyed by original path for simplicity)
const svgCache: Map<string, string> = new Map();

// Pending requests to prevent duplicate fetches
const pendingRequests: Map<string, Promise<string>> = new Map();

// Fallback SVG for failed loads - a simple placeholder rectangle
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="currentColor" fill-opacity="0.3"/></svg>`;

/**
 * Check if fetch() will work for loading local resources.
 * In Electron (file:// protocol), fetch() cannot load local files.
 */
function canUseFetch(): boolean {
  // Use globalThis to safely check for window in any environment (browser, Node, VS Code extension)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof globalThis !== "undefined" ? (globalThis as any).window : undefined;
  if (!win || !win.location) return false;
  // file:// protocol doesn't support fetch for local resources
  return !win.location.protocol.startsWith("file:");
}

/**
 * Get the content root URL for loading resources.
 * Falls back to inferring from window.location if CreatorToolsHost hasn't initialized yet.
 */
function getContentRoot(): string {
  // If contentWebRoot is set, use it
  if (CreatorToolsHost.contentWebRoot) {
    return CreatorToolsHost.contentWebRoot;
  }
  // Fallback: infer from current page URL
  // Use globalThis to safely check for window in any environment (browser, Node, VS Code extension)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof globalThis !== "undefined" ? (globalThis as any).window : undefined;
  if (win && win.location) {
    const href = win.location.href;
    const lastSlash = href.lastIndexOf("/");
    if (lastSlash >= 0) {
      return href.substring(0, lastSlash + 1);
    }
  }
  return "";
}

/**
 * Centralized SVG loading utility.
 */
class SvgLoader {
  /**
   * Load an SVG file and return its content as a string.
   * Results are cached to prevent duplicate loads.
   * Failed loads return a fallback SVG and are also cached to prevent retry loops.
   *
   * @param path - The SVG file path (e.g., "/res/icons/myicon.svg")
   * @returns Promise resolving to the SVG content string
   */
  static async load(path: string): Promise<string> {
    // Check cache first (using original path as key)
    if (svgCache.has(path)) {
      return svgCache.get(path)!;
    }

    // In Electron/file:// context, fetch() won't work for local files
    // Return fallback immediately to avoid errors
    if (!canUseFetch()) {
      svgCache.set(path, FALLBACK_SVG);
      return FALLBACK_SVG;
    }

    // Check if there's a pending request for this path
    if (pendingRequests.has(path)) {
      return pendingRequests.get(path)!;
    }

    // Build the full URL
    const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
    const contentRoot = getContentRoot();
    const fullUrl = contentRoot + normalizedPath;

    // Create new request
    const request = fetch(fullUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.text();
      })
      .then((content) => {
        svgCache.set(path, content);
        pendingRequests.delete(path);
        return content;
      })
      .catch((error) => {
        pendingRequests.delete(path);
        Log.debug(`SvgLoader: Failed to load ${path} - ${error.message || error}`);
        // Cache the fallback to prevent retry loops
        svgCache.set(path, FALLBACK_SVG);
        return FALLBACK_SVG;
      });

    pendingRequests.set(path, request);
    return request;
  }

  /**
   * Check if an SVG is already cached.
   */
  static isCached(path: string): boolean {
    return svgCache.has(path);
  }

  /**
   * Get cached SVG content synchronously, or null if not cached.
   */
  static getCached(path: string): string | null {
    return svgCache.get(path) ?? null;
  }

  /**
   * Clear the SVG cache. Useful for testing or memory cleanup.
   */
  static clearCache(): void {
    svgCache.clear();
    pendingRequests.clear();
  }

  /**
   * Get the fallback SVG content.
   */
  static get fallbackSvg(): string {
    return FALLBACK_SVG;
  }

  /**
   * Check if fetch-based loading is available in this context.
   */
  static get canFetch(): boolean {
    return canUseFetch();
  }
}

export default SvgLoader;
