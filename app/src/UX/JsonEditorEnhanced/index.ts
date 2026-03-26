/**
 * JSON Editor Enhancements Module
 *
 * This module provides comprehensive Monaco editor enhancements for
 * Minecraft JSON files, including:
 *
 * - Rich hover documentation with visual summaries (Phase 1.1)
 * - Smart autocompletion for components, assets, and references (Phase 1.2)
 * - Visual value decorations with ISummarizer support (Phase 1.3)
 * - Inline code actions for quick fixes and refactoring (Phase 2.1)
 * - Code lens for related content and documentation links (Phase 2.3)
 * - Inlay hints for units, defaults, and context (Phase 2.4)
 * - Semantic folding with smart summaries (Phase 3.2)
 * - Cross-file reference navigation (Phase 4.4)
 *
 * Usage:
 * ```typescript
 * import { JsonEditorEnhancements } from '../JsonEditorEnhanced';
 *
 * const enhancements = new JsonEditorEnhancements();
 * enhancements.registerProviders(monacoEditor);
 * enhancements.updateFileContext(projectItem, project);
 *
 * // On unmount:
 * enhancements.dispose();
 * ```
 */

// Main orchestrator
export { JsonEditorEnhancements } from "./JsonEditorEnhancements";
export type { IJsonEditorEnhancementsConfig } from "./JsonEditorEnhancements";

// Core utilities
export { JsonPathResolver, jsonPathResolver } from "./JsonPathResolver";
export type { IJsonPathResult } from "./JsonPathResolver";
export { FormDefinitionCache, formDefinitionCache } from "./FormDefinitionCache";
export { FormSchemaGenerator } from "./FormSchemaGenerator";

// Providers - Phase 1
export { MinecraftHoverProvider } from "./MinecraftHoverProvider";
export { MinecraftCompletionProvider } from "./MinecraftCompletionProvider";
export { ValueDecoratorProvider, VALUE_DECORATOR_STYLES } from "./ValueDecoratorProvider";

// Providers - Phase 2
export { MinecraftCodeActionProvider } from "./MinecraftCodeActionProvider";
export { MinecraftCodeLensProvider } from "./MinecraftCodeLensProvider";
export { MinecraftInlayHintsProvider } from "./MinecraftInlayHintsProvider";

// Providers - Phase 3
export { FoldingSummaryProvider, FoldingSummaryDecorator } from "./FoldingSummaryProvider";
export { ComponentSummaryProvider } from "./ComponentSummaryProvider";
export type { IComponentSummary } from "./ComponentSummaryProvider";

// Providers - Phase 4
export { CrossFileReferenceProvider, ReferenceType } from "./CrossFileReferenceProvider";
export type { IReferenceLocation } from "./CrossFileReferenceProvider";

// Langcore adapters
export * from "./LangcoreAdapters";

// React components
export { JsonPathBreadcrumb } from "./JsonPathBreadcrumbSimple";
export type { IJsonPathBreadcrumbProps } from "./JsonPathBreadcrumbSimple";
