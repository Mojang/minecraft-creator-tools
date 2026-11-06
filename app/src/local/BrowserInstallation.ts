// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import { createRequire } from "module";
import type { BrowserType, LaunchOptions } from "playwright";

/** Playwright's browser registry. Playwright exports it for its own tools but doesn't document it. */
const REGISTRY_MODULE = "playwright-core/lib/server/registry/index";

export interface BrowserRegistry {
  findExecutable(name: string): { executablePath(sdkLanguage: string): string | undefined } | undefined;
}

/** An API object of in-process Playwright, which can map it to the server object behind it. */
interface InProcessObject {
  _connection?: { toImpl?: (object: unknown) => unknown };
}

/**
 * Whether the browser that `browserType.launch(options)` would start is installed, so the renderer can skip a browser
 * that isn't instead of launching it.
 *
 * Playwright creates a temporary artifacts folder (`playwright-artifacts-*`) and profile folder
 * (`playwright_chromiumdev_profile-*`) before it looks for the browser, and leaves both behind when it can't find one.
 *
 * An executable path must exist. Otherwise, this asks Playwright which browser the launch would start, such as the
 * `chrome` channel or Playwright's own `chromium-headless-shell`, and looks for it in the browser registry that `launch()`
 * uses (loadBrowserRegistry). So it keeps no list of browser names or install locations, and a browser the registry
 * doesn't list counts as not installed, because Playwright can't launch it either. Neither step is public API: the
 * browser type's `getExecutableName()` is reached through the in-process mapping that BrowserProcessPipes.ts also uses,
 * and the registry module isn't documented. When either doesn't work as expected, the browser counts as installed, so
 * its launch is tried as before. See docs/PlaywrightBrowserManagement.md.
 */
export async function isBrowserInstalled(browserType: BrowserType, options: LaunchOptions): Promise<boolean> {
  if (options.executablePath) {
    return fs.existsSync(options.executablePath);
  }
  try {
    const name = getExecutableName(browserType, options);
    const registry = loadBrowserRegistry();
    if (name === undefined || !registry) {
      return true;
    }
    const executablePath = registry.findExecutable(name)?.executablePath("javascript");
    return executablePath !== undefined && fs.existsSync(executablePath);
  } catch {
    return true;
  }
}

/** The registry name of the browser that `browserType.launch(options)` would start, from Playwright's browser type. */
function getExecutableName(browserType: BrowserType, options: LaunchOptions): string | undefined {
  const connection = (browserType as unknown as InProcessObject)._connection;
  const server = connection?.toImpl?.(browserType) as
    | { getExecutableName?: (options: LaunchOptions) => unknown }
    | undefined;
  const name = server?.getExecutableName?.(options);
  return typeof name === "string" ? name : undefined;
}

/**
 * The browser registry of the `playwright-core` that `playwright` itself loads, which `launch()` uses. npm can nest that
 * copy under `playwright` while a different version sits next to it, so the registry is resolved from `playwright`'s
 * entry point rather than from this module. Returns undefined when it doesn't look as expected.
 */
export function loadBrowserRegistry(
  playwrightEntry: string = require.resolve("playwright")
): BrowserRegistry | undefined {
  const registry = createRequire(playwrightEntry)(REGISTRY_MODULE)?.registry;
  return typeof registry?.findExecutable === "function" ? registry : undefined;
}
