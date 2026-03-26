// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VS Code Language Providers for MCTools
 *
 * This module exports all language-related providers that enhance
 * the VS Code editing experience for Minecraft content:
 *
 * - McDiagnosticProvider: Problems panel integration with validators
 * - McCodeActionProvider: Quick fixes from ProjectUpdater infrastructure
 * - McCompletionProvider: Cross-file IntelliSense
 * - McHoverProvider: Rich documentation hovers
 * - McDefinitionProvider: Go-to-definition navigation
 * - McDecorationProvider: Inline component summaries
 * - McToolsChatParticipant: @minecraft chat participant for Copilot
 * - McToolsLmTools: Language model tools for Copilot
 *
 * Uses langcore module for platform-agnostic language intelligence.
 *
 * @module providers
 */

export { default as McDiagnosticProvider } from "./McDiagnosticProvider";
export { default as McCodeActionProvider } from "./McCodeActionProvider";
export { default as McCompletionProvider } from "./McCompletionProvider";
export { default as McHoverProvider } from "./McHoverProvider";
export { default as McDefinitionProvider } from "./McDefinitionProvider";
export { default as McDecorationProvider } from "./McDecorationProvider";
export { default as McToolsChatParticipant } from "./McToolsChatParticipant";
export { default as McToolsLmTools } from "./McToolsLmTools";

// Langcore adapters
export * from "./LangcoreAdapters";
