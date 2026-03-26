/**
 * JsonEditorEnhancements.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This is the main orchestrator for all Monaco editor enhancements for
 * Minecraft JSON files. It manages the lifecycle of all providers and
 * coordinates context updates across them.
 *
 * PROVIDER REGISTRATION:
 * Providers are registered with Monaco in registerProviders() and disposed
 * in dispose(). Each provider receives context updates via updateFileContext().
 *
 * CURRENT PROVIDERS:
 * - MinecraftHoverProvider - Rich hover documentation (Phase 1.1)
 * - MinecraftCompletionProvider - Smart autocompletion (Phase 1.2)
 * - ValueDecoratorProvider - Visual value decorations (Phase 1.3)
 * - MinecraftCodeActionProvider - Quick fixes and refactoring (Phase 2.1)
 * - MinecraftCodeLensProvider - Related content links (Phase 2.3)
 * - MinecraftInlayHintsProvider - Inline hints for defaults/units (Phase 2.4)
 * - FoldingSummaryProvider - Semantic folding with summaries (Phase 3.2)
 * - CrossFileReferenceProvider - Cross-file navigation (Phase 4.4)
 *
 * USAGE:
 * ```typescript
 * const enhancements = new JsonEditorEnhancements();
 * enhancements.registerProviders(monacoEditor);
 * enhancements.updateFileContext(projectItem, project);
 * // On unmount:
 * enhancements.dispose();
 * ```
 */

import * as monaco from "monaco-editor";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { JsonPathResolver } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import { MinecraftHoverProvider } from "./MinecraftHoverProvider";
import { MinecraftCompletionProvider } from "./MinecraftCompletionProvider";
import { ValueDecoratorProvider, VALUE_DECORATOR_STYLES } from "./ValueDecoratorProvider";
import { ContentWidgetProvider, CONTENT_WIDGET_STYLES } from "./ContentWidgetProvider";
import { MinecraftCodeActionProvider } from "./MinecraftCodeActionProvider";
import { MinecraftCodeLensProvider } from "./MinecraftCodeLensProvider";
import { MinecraftInlayHintsProvider } from "./MinecraftInlayHintsProvider";
import { FoldingSummaryProvider } from "./FoldingSummaryProvider";
import { CrossFileReferenceProvider } from "./CrossFileReferenceProvider";
import { ComponentSummaryProvider } from "./ComponentSummaryProvider";
import Log from "../../core/Log";

/**
 * Configuration options for enhancements
 */
export interface IJsonEditorEnhancementsConfig {
  enableHover?: boolean;
  enableCompletion?: boolean;
  enableCodeActions?: boolean;
  enableCodeLens?: boolean;
  enableInlayHints?: boolean;
  enableFolding?: boolean;
  enableReferences?: boolean;
  enableDecorators?: boolean;
  enableComponentSummaries?: boolean;
  enableContentWidgets?: boolean;
}

const DEFAULT_CONFIG: IJsonEditorEnhancementsConfig = {
  enableHover: true,
  enableCompletion: true,
  enableCodeActions: true,
  enableCodeLens: true,
  enableInlayHints: true,
  enableFolding: true,
  enableReferences: true,
  enableDecorators: true,
  enableComponentSummaries: true,
  enableContentWidgets: true,
};

/**
 * Orchestrates all JSON editor enhancements for Minecraft files
 */
export class JsonEditorEnhancements {
  private config: IJsonEditorEnhancementsConfig;
  private disposables: monaco.IDisposable[] = [];
  private editor?: monaco.editor.IStandaloneCodeEditor;
  private static stylesInjected = false;

  // Core utilities
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;

  // Providers
  private hoverProvider?: MinecraftHoverProvider;
  private completionProvider?: MinecraftCompletionProvider;
  private valueDecorator?: ValueDecoratorProvider;
  private codeActionProvider?: MinecraftCodeActionProvider;
  private codeLensProvider?: MinecraftCodeLensProvider;
  private inlayHintsProvider?: MinecraftInlayHintsProvider;
  private foldingProvider?: FoldingSummaryProvider;
  private referenceProvider?: CrossFileReferenceProvider;
  private componentSummaryProvider?: ComponentSummaryProvider;
  private contentWidgetProvider?: ContentWidgetProvider;

  constructor(config: IJsonEditorEnhancementsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize core utilities
    this.pathResolver = new JsonPathResolver();
    this.formCache = new FormDefinitionCache();

    // Initialize providers based on config
    if (this.config.enableHover) {
      this.hoverProvider = new MinecraftHoverProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableCompletion) {
      this.completionProvider = new MinecraftCompletionProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableDecorators) {
      this.valueDecorator = new ValueDecoratorProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableCodeActions) {
      this.codeActionProvider = new MinecraftCodeActionProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableCodeLens) {
      this.codeLensProvider = new MinecraftCodeLensProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableInlayHints) {
      this.inlayHintsProvider = new MinecraftInlayHintsProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableFolding) {
      this.foldingProvider = new FoldingSummaryProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableReferences) {
      this.referenceProvider = new CrossFileReferenceProvider(this.pathResolver, this.formCache);
    }

    if (this.config.enableComponentSummaries) {
      this.componentSummaryProvider = new ComponentSummaryProvider();
    }

    if (this.config.enableContentWidgets) {
      this.contentWidgetProvider = new ContentWidgetProvider(this.pathResolver);
    }
  }

  /**
   * Set callback for widget actions (e.g., clicking on a texture to open it)
   * @param callback Function that receives action type and optional target path
   */
  public setWidgetActionCallback(callback: (action: string, target?: string) => void): void {
    if (this.contentWidgetProvider) {
      this.contentWidgetProvider.setActionCallback(callback);
    }
  }

  /**
   * Inject CSS styles for value decorations (only once)
   */
  private injectStyles(): void {
    if (JsonEditorEnhancements.stylesInjected) return;

    const styleElement = document.createElement("style");
    styleElement.id = "mct-json-editor-styles";
    styleElement.textContent = VALUE_DECORATOR_STYLES + CONTENT_WIDGET_STYLES;
    document.head.appendChild(styleElement);

    JsonEditorEnhancements.stylesInjected = true;
  }

  /**
   * Register all providers with Monaco editor
   */
  public registerProviders(editor: monaco.editor.IStandaloneCodeEditor): void {
    Log.verbose("[JsonEditorEnhancements] registerProviders called");
    this.editor = editor;
    const model = editor.getModel();
    if (!model) {
      Log.verbose("[JsonEditorEnhancements] No model, skipping registration");
      return;
    }

    // Inject CSS styles for value decorations
    this.injectStyles();

    // Register providers for both "json" and "jsonc" since the editor may use either language mode.
    // The JsonEditor component uses "jsonc" (JSON with Comments) as its default language.
    const languageIds = ["json", "jsonc"];

    // Register hover provider
    if (this.hoverProvider) {
      Log.verbose("[JsonEditorEnhancements] Registering hover provider");
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerHoverProvider(langId, this.hoverProvider));
      }
      Log.verbose("[JsonEditorEnhancements] Hover provider registered successfully");
    } else {
      Log.verbose(`[JsonEditorEnhancements] No hover provider to register (enableHover: ${this.config.enableHover})`);
    }

    // Register completion provider
    if (this.completionProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerCompletionItemProvider(langId, this.completionProvider));
      }
    }

    // Register code action provider
    if (this.codeActionProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerCodeActionProvider(langId, this.codeActionProvider));
      }
    }

    // Register code lens provider
    if (this.codeLensProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerCodeLensProvider(langId, this.codeLensProvider));
      }
    }

    // Register inlay hints provider
    if (this.inlayHintsProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerInlayHintsProvider(langId, this.inlayHintsProvider));
      }
    }

    // Register folding range provider
    if (this.foldingProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerFoldingRangeProvider(langId, this.foldingProvider));
      }
    }

    // Register definition, references, and type definition providers
    if (this.referenceProvider) {
      for (const langId of languageIds) {
        this.disposables.push(monaco.languages.registerDefinitionProvider(langId, this.referenceProvider));
        this.disposables.push(monaco.languages.registerReferenceProvider(langId, this.referenceProvider));
        this.disposables.push(monaco.languages.registerTypeDefinitionProvider(langId, this.referenceProvider));
      }
    }

    // Set up value decorators (these work differently - they're editor-specific)
    if (this.valueDecorator) {
      // Apply decorations on content change
      const contentChangeDisposable = editor.onDidChangeModelContent(() => {
        this.valueDecorator?.applyDecorations(editor);
      });
      this.disposables.push(contentChangeDisposable);

      // Initial decoration
      this.valueDecorator.applyDecorations(editor);
    }

    // Set up component summary decorations
    if (this.componentSummaryProvider) {
      Log.verbose("[JsonEditorEnhancements] Setting up component summary provider");

      // Apply summaries on content change (debounced)
      const componentChangeDisposable = editor.onDidChangeModelContent(() => {
        this.componentSummaryProvider?.scheduleUpdate(editor);
      });
      this.disposables.push(componentChangeDisposable);

      // Also listen for model changes (when a new file is opened)
      const modelChangeDisposable = editor.onDidChangeModel(() => {
        // Delay slightly to ensure content is loaded
        setTimeout(() => {
          this.componentSummaryProvider?.update(editor);
        }, 100);
      });
      this.disposables.push(modelChangeDisposable);

      // Initial update - delay to ensure content is loaded
      setTimeout(() => {
        this.componentSummaryProvider?.update(editor);
      }, 100);
    } else {
      Log.verbose(
        `[JsonEditorEnhancements] No component summary provider (enableComponentSummaries: ${this.config.enableComponentSummaries})`
      );
    }

    // Set up content widget provider for color swatches and texture thumbnails
    if (this.contentWidgetProvider) {
      Log.verbose("[JsonEditorEnhancements] Setting up content widget provider");

      // Apply widgets on content change (debounced)
      const widgetChangeDisposable = editor.onDidChangeModelContent(() => {
        this.contentWidgetProvider?.scheduleUpdate(editor);
      });
      this.disposables.push(widgetChangeDisposable);

      // Also listen for model changes
      const widgetModelDisposable = editor.onDidChangeModel(() => {
        setTimeout(() => {
          this.contentWidgetProvider?.update(editor);
        }, 150);
      });
      this.disposables.push(widgetModelDisposable);

      // Initial update
      setTimeout(() => {
        this.contentWidgetProvider?.update(editor);
      }, 150);
    }
  }

  /**
   * Update file context for all providers
   */
  public updateFileContext(projectItem?: ProjectItem, project?: Project): void {
    // Update hover provider
    if (this.hoverProvider) {
      this.hoverProvider.updateContext(projectItem, project);
    }

    // Update completion provider
    if (this.completionProvider) {
      this.completionProvider.updateContext(projectItem, project);
    }

    // Update value decorator
    if (this.valueDecorator) {
      this.valueDecorator.updateContext(projectItem, project);
      // Re-apply decorations after context change
      if (this.editor) {
        this.valueDecorator.applyDecorations(this.editor);
      }
    }

    // Update code action provider
    if (this.codeActionProvider) {
      this.codeActionProvider.updateContext(projectItem, project);
    }

    // Update code lens provider
    if (this.codeLensProvider) {
      this.codeLensProvider.updateContext(projectItem, project);
    }

    // Update inlay hints provider
    if (this.inlayHintsProvider) {
      this.inlayHintsProvider.updateContext(projectItem, project);
    }

    // Update folding provider
    if (this.foldingProvider) {
      this.foldingProvider.updateContext(projectItem, project);
    }

    // Update reference provider
    if (this.referenceProvider) {
      this.referenceProvider.updateContext(projectItem, project);
    }

    // Re-apply component summaries after context change
    if (this.componentSummaryProvider && this.editor) {
      this.componentSummaryProvider.update(this.editor);
    }

    // Update content widget provider with project context for texture resolution
    if (this.contentWidgetProvider) {
      if (projectItem && project) {
        this.contentWidgetProvider.setProjectContext(project, projectItem);
      } else {
        this.contentWidgetProvider.clearProjectContext();
      }
      // Re-apply widgets after context change
      if (this.editor) {
        this.contentWidgetProvider.update(this.editor);
      }
    }
  }

  /**
   * Dispose of all registered providers
   */
  public dispose(): void {
    // Dispose value decorator
    if (this.valueDecorator) {
      this.valueDecorator.dispose();
    }

    // Dispose component summary provider
    if (this.componentSummaryProvider) {
      this.componentSummaryProvider.dispose();
    }

    // Dispose content widget provider
    if (this.contentWidgetProvider) {
      this.contentWidgetProvider.dispose();
    }

    // Dispose Monaco language registrations
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.editor = undefined;
  }
}
