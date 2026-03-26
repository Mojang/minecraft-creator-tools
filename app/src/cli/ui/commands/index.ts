/**
 * Command Provider System - Index
 *
 * Exports all command providers and the registry for the Ink CLI.
 */

export * from "./ICommandProvider";
export * from "./MctCommandProvider";
export * from "./BdsCommandProvider";
export * from "./ToolCommandProvider";

import { commandProviderRegistry } from "./ICommandProvider";
import { mctCommandProvider } from "./MctCommandProvider";
import { bdsCommandProvider } from "./BdsCommandProvider";
import { toolCommandProvider } from "./ToolCommandProvider";

/**
 * Initialize all command providers and register them with the registry
 */
export async function initializeCommandProviders(): Promise<void> {
  // Register providers (order matters for priority)
  // MctCommandProvider (100) - basic console commands
  // ToolCommandProvider (90) - unified ToolCommands (create, add, etc.)
  // BdsCommandProvider (50) - Bedrock server commands
  commandProviderRegistry.register(mctCommandProvider);
  commandProviderRegistry.register(toolCommandProvider);
  commandProviderRegistry.register(bdsCommandProvider);

  // Initialize all providers
  await commandProviderRegistry.initialize();
}

export { commandProviderRegistry, mctCommandProvider, bdsCommandProvider, toolCommandProvider };
