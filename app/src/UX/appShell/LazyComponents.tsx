/**
 * ==========================================================================================
 * LAZY COMPONENTS - React.lazy() Wrappers for Code-Splitting
 * ==========================================================================================
 *
 * This module provides lazy-loaded versions of heavy components to enable code-splitting.
 * These components are only loaded when they're actually rendered, not at app startup.
 *
 * USAGE:
 * ------
 * Instead of:
 *   import BlockViewer from "../../worldux/BlockViewer";
 *   <BlockViewer ... />
 *
 * Use:
 *   import { LazyBlockViewer } from "./LazyComponents";
 *   <LazyBlockViewer ... />
 *
 * The Suspense boundary and loading fallback are handled automatically.
 *
 * BUNDLE IMPACT:
 * --------------
 * - Babylon.js (~8MB) - Only loads when 3D viewers are used
 * - Monaco Editor (~4MB) - Only loads when code editors are used
 * - Blockly (~1MB) - Only loads when ActionSetEditor is used
 *
 * ==========================================================================================
 */

import React, { Suspense } from "react";
import "./LazyComponents.css";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

// =============================================================================
// LOADING FALLBACK COMPONENT
// =============================================================================

interface LoadingFallbackProps {
  message?: string;
  height?: number | string;
}

/**
 * Loading spinner shown while lazy components are loading.
 * Uses CSS animation for smooth visual feedback.
 */
export function LoadingFallback({ message = "Loading...", height = "100%" }: LoadingFallbackProps): JSX.Element {
  return (
    <div className={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "lazy-loading-dark" : ""}>
      <div className="lazy-loading-container" style={{ height }}>
        <div className="lazy-loading-spinner" />
        <div className="lazy-loading-message">{message}</div>
      </div>
    </div>
  );
}

// =============================================================================
// LAZY COMPONENT DEFINITIONS
// Using explicit module transformation to ensure proper default export handling
// These type assertions are necessary because class components with getDerivedStateFromProps
// have stricter type requirements that conflict with React.lazy's expectations
// =============================================================================

// Helper type to force compatibility with React.lazy
type LazyComponentType = React.ComponentType<Record<string, unknown>>;

// Babylon.js Components (3D Rendering - ~8MB)
const BlockViewerLazy = React.lazy(() =>
  import("../world/BlockViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const MobViewerLazy = React.lazy(() =>
  import("../world/MobViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const ItemViewerLazy = React.lazy(() =>
  import("../world/ItemViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const ModelViewerLazy = React.lazy(() =>
  import("../world/ModelViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const StructureViewerLazy = React.lazy(() =>
  import("../world/StructureViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const StructureEditorLazy = React.lazy(() =>
  import("../world/StructureEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const MCWorldEditorLazy = React.lazy(() =>
  import("../world/MCWorldEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const WorldDisplayLazy = React.lazy(() =>
  import("../world/WorldDisplay").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const WorldViewerLazy = React.lazy(() =>
  import("../world/WorldViewer").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);

// Monaco Editor Components (~4MB)
const JavaScriptEditorLazy = React.lazy(() =>
  import("../codeEditors/JavaScriptEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const JsonEditorLazy = React.lazy(() =>
  import("../codeEditors/JsonEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const FunctionEditorLazy = React.lazy(() =>
  import("../codeEditors/FunctionEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const MolangEditorLazy = React.lazy(() =>
  import("../codeEditors/MolangEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const TextEditorLazy = React.lazy(() =>
  import("../codeEditors/TextEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);

// Blockly Components (~1MB)
const ActionSetEditorLazy = React.lazy(() =>
  import("../editors/action/ActionSetEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);

// Other Heavy Components
const HomeLazy = React.lazy(() =>
  import("../home/Home").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);
const ProjectEditorLazy = React.lazy(() =>
  import("../project/ProjectEditor").then((m) => ({ default: m.default as unknown as LazyComponentType }))
);

// =============================================================================
// BABYLON.JS WRAPPERS (3D Rendering - ~8MB)
// Using React.ComponentProps to infer prop types from the original components
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyBlockViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D viewer..." />}>
    <BlockViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyMobViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D viewer..." />}>
    <MobViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyItemViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D viewer..." />}>
    <ItemViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyModelViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D viewer..." />}>
    <ModelViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyStructureViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D viewer..." />}>
    <StructureViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyStructureEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading structure editor..." />}>
    <StructureEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyMCWorldEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading world editor..." />}>
    <MCWorldEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyWorldViewer: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading 3D world..." />}>
    <WorldViewerLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyWorldDisplay: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading world display..." />}>
    <WorldDisplayLazy {...props} />
  </Suspense>
);

// =============================================================================
// MONACO EDITOR WRAPPERS (~4MB)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyJavaScriptEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading code editor..." />}>
    <JavaScriptEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyJsonEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading JSON editor..." />}>
    <JsonEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyFunctionEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading function editor..." />}>
    <FunctionEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyMolangEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading MoLang editor..." />}>
    <MolangEditorLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyTextEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading text editor..." />}>
    <TextEditorLazy {...props} />
  </Suspense>
);

// =============================================================================
// BLOCKLY WRAPPER (~1MB)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyActionSetEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading action editor..." />}>
    <ActionSetEditorLazy {...props} />
  </Suspense>
);

// =============================================================================
// OTHER HEAVY COMPONENTS
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyHome: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading home..." />}>
    <HomeLazy {...props} />
  </Suspense>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LazyProjectEditor: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading project..." />}>
    <ProjectEditorLazy {...props} />
  </Suspense>
);

// =============================================================================
// RE-EXPORT TYPES FOR CONVENIENCE
// =============================================================================

// Export ScriptEditorRole from shared location (not from JavaScriptEditor to avoid static import)
export { ScriptEditorRole } from "../utils/ScriptEditorRole";
