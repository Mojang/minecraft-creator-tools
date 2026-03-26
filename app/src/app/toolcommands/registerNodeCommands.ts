// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * registerNodeCommands.ts
 *
 * Registers ToolCommands that depend on Node.js-only modules (net, child_process, etc.).
 * This file is intentionally NOT exported from the toolcommands barrel (index.ts)
 * to prevent webpack from pulling Node.js dependencies into the web bundle.
 *
 * Usage (in Node.js entry points only):
 *   import { registerNodeOnlyCommands } from "../app/toolcommands/registerNodeCommands";
 *   await registerNodeOnlyCommands();
 */

import { ToolCommandRegistry } from "./ToolCommandRegistry";

let _registered = false;

/**
 * Dynamically import and register commands that require Node.js runtime
 * (e.g., ServerCommand which uses child_process, net, os via DedicatedServer).
 * Safe to call multiple times. Must NOT be called from web bundles.
 */
export async function registerNodeOnlyCommands(): Promise<void> {
  if (_registered) return;
  _registered = true;

  const { serverCommand } = await import("./commands/ServerCommand");
  ToolCommandRegistry.instance.register(serverCommand);
}
