// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToolCommands - Unified command system for Minecraft Creator Tools
 *
 * This module provides a unified way to register and invoke commands across:
 * - CLI (via thin adapter)
 * - MCP tools
 * - In-game edit bar (SearchCommandEditor)
 * - Serve mode interactive terminal
 * - Server management UI
 * - Home page command bar
 *
 * USAGE:
 * ```typescript
 * import { ToolCommandRegistry, initializeToolCommands } from "./toolcommands";
 *
 * // Initialize (registers all built-in commands)
 * initializeToolCommands();
 *
 * // Execute a command
 * const result = await ToolCommandRegistry.instance.execute("/help", context);
 *
 * // Get autocomplete suggestions
 * const completions = await ToolCommandRegistry.instance.getCompletions("/cr", 3, context);
 * ```
 */

// Core interfaces
export type { IToolCommand, IToolCommandMetadata, IToolCommandResult } from "./IToolCommand";
export { ToolCommandBase, ToolCommandScope } from "./IToolCommand";
export type { IToolCommandArgument, IToolCommandFlag, AutocompleteProvider } from "./IToolCommandArgument";
export type { IToolCommandContext, IToolCommandOutput, IToolCommandSession } from "./IToolCommandContext";
export { ToolCommandContextFactory } from "./IToolCommandContext";

// Registry and parser
export { ToolCommandRegistry } from "./ToolCommandRegistry";
export { ToolCommandParser } from "./ToolCommandParser";
export type { ParsedToolCommand } from "./ToolCommandParser";



// Autocomplete providers
export * from "./AutocompleteProviders";

// Commands
export * from "./commands";

import { registerAllToolCommands } from "./commands";

let _initialized = false;

/**
 * Initialize the ToolCommand system by registering all built-in commands.
 * Safe to call multiple times (only initializes once).
 *
 * NOTE: This registers only platform-safe commands. For Node.js-only commands
 * (e.g., ServerCommand), call registerNodeOnlyCommands() from
 * "./registerNodeCommands" in your Node.js entry point.
 */
export function initializeToolCommands(): void {
  if (_initialized) return;
  _initialized = true;
  registerAllToolCommands();
}

/**
 * Check if ToolCommands have been initialized.
 */
export function isToolCommandsInitialized(): boolean {
  return _initialized;
}
