// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Language Core (langcore) Module
 *
 * This module provides platform-agnostic language intelligence for Minecraft content.
 * It is designed to be used by both VS Code extension providers and Monaco editor
 * enhancements, avoiding code duplication while providing rich editing experiences.
 *
 * ARCHITECTURE:
 * ============
 *
 * langcore/
 * ├── shared/          - Utilities shared across all language types
 * │   ├── MinecraftPathUtils     - Path detection and classification
 * │   ├── MinecraftReferenceTypes - Reference type detection
 * │   └── FormMetadataProvider   - Form definition access
 * │
 * ├── json/            - JSON file intelligence
 * │   ├── JsonPathResolver       - JSON path at cursor position
 * │   ├── JsonHoverProvider      - Hover content generation
 * │   ├── JsonCompletionProvider - Completion item generation
 * │   └── JsonReferenceResolver  - Cross-file reference resolution
 * │
 * ├── javascript/      - JavaScript/TypeScript intelligence
 * │   ├── ScriptModuleInfo       - @minecraft module versions/docs
 * │   └── ScriptApiProvider      - API completions and docs
 * │
 * ├── mcfunction/      - Command file (.mcfunction) intelligence
 * │   ├── CommandParser          - Command parsing
 * │   ├── CommandCompletion      - Command completions
 * │   └── CommandValidation      - Command validation
 * │
 * └── molang/          - Molang expression intelligence
 *     ├── MolangParser           - Expression parsing
 *     ├── MolangCompletion       - Query/variable completions
 *     └── MolangHover            - Molang documentation
 *
 * PLATFORM ADAPTERS:
 * ==================
 *
 * The langcore provides platform-agnostic types and logic. Platform-specific
 * adapters in VS Code providers and Monaco enhancements convert these to their
 * respective APIs:
 *
 * - langcore types → vscode.Hover, vscode.CompletionItem, etc.
 * - langcore types → monaco.languages.Hover, monaco.languages.CompletionItem, etc.
 *
 * USAGE:
 * ======
 *
 * ```typescript
 * import { JsonPathResolver, MinecraftPathUtils } from '../langcore';
 *
 * // Check if a path is Minecraft content
 * if (MinecraftPathUtils.isMinecraftContentPath(filePath)) {
 *   // Get JSON path at cursor
 *   const pathResult = JsonPathResolver.getPathAtOffset(content, offset);
 * }
 * ```
 */

// Shared utilities
export * from "./shared";

// JSON language core
export * from "./json";

// JavaScript/TypeScript language core
export * from "./javascript";

// mcfunction command language core
export * from "./mcfunction";

// Molang expression language core
export * from "./molang";
