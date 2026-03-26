/**
 * MinecraftCodeActionProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider offers inline code actions (quick fixes and refactorings)
 * for Minecraft JSON files. Code actions appear as lightbulb suggestions
 * and in the Quick Fix menu (Ctrl+.).
 *
 * CODE ACTION CATEGORIES:
 *
 * 1. QUICK FIXES (diagnostic-triggered):
 *    - Fix deprecated properties
 *    - Fix invalid values
 *    - Fix missing required properties
 *
 * 2. REFACTORINGS (user-triggered):
 *    - Extract component group
 *    - Convert to/from shorthand syntax
 *    - Add missing components
 *
 * 3. SOURCE ACTIONS:
 *    - Sort properties alphabetically
 *    - Format document
 *    - Remove unused properties
 *
 * MONACO INTEGRATION:
 * - Implements monaco.languages.CodeActionProvider
 * - Uses CodeActionKind for filtering
 * - Provides WorkspaceEdit for changes
 *
 * USAGE:
 * ```typescript
 * const provider = new MinecraftCodeActionProvider(pathResolver, formCache);
 * monaco.languages.registerCodeActionProvider('json', provider);
 * provider.updateContext(projectItem, project);
 * ```
 */

import * as monaco from "monaco-editor";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { JsonPathResolver, IJsonPathResult } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import IField, { FieldDataType } from "../../dataform/IField";
import IFormDefinition from "../../dataform/IFormDefinition";

/**
 * Provides code actions for Minecraft JSON files
 */
export class MinecraftCodeActionProvider implements monaco.languages.CodeActionProvider {
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private projectItem?: ProjectItem;
  private project?: Project;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.projectItem = projectItem;
    this.project = project;
  }

  /**
   * Provide code actions for the given range
   */
  public async provideCodeActions(
    model: monaco.editor.ITextModel,
    range: monaco.Range,
    context: monaco.languages.CodeActionContext,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.CodeActionList | null> {
    const content = model.getValue();
    const actions: monaco.languages.CodeAction[] = [];

    // Get JSON path at cursor position
    const offset = model.getOffsetAt(range.getStartPosition());
    const pathResult = this.pathResolver.getPathAtOffset(content, offset);

    // Get form definition
    const form = this.projectItem ? await this.formCache.getFormForItemType(this.projectItem.itemType) : null;

    // Generate different types of code actions
    if (context.trigger === monaco.languages.CodeActionTriggerType.Invoke) {
      // User explicitly requested code actions (Ctrl+.)
      actions.push(...this.getRefactoringActions(model, pathResult, content, form));
      actions.push(...this.getSourceActions(model, content));
    }

    // Always provide quick fixes for diagnostics
    actions.push(...this.getQuickFixes(model, context, pathResult, form));

    // Add component-related actions if in a components section
    if (pathResult && this.isInComponentsSection(pathResult.path)) {
      actions.push(...this.getComponentActions(model, pathResult, content, form));
    }

    if (actions.length === 0) {
      return null;
    }

    return {
      actions,
      dispose: () => {},
    };
  }

  // =========================================================================
  // Quick Fixes
  // =========================================================================

  /**
   * Get quick fixes for diagnostics
   */
  private getQuickFixes(
    model: monaco.editor.ITextModel,
    context: monaco.languages.CodeActionContext,
    pathResult: IJsonPathResult | null,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction[] {
    const actions: monaco.languages.CodeAction[] = [];

    // Check each marker/diagnostic
    for (const marker of context.markers) {
      // Check for deprecated property
      if (marker.message.includes("deprecated")) {
        const fix = this.createDeprecationFix(model, marker, pathResult, form);
        if (fix) actions.push(fix);
      }

      // Check for invalid value
      if (marker.message.includes("invalid") || marker.message.includes("must be")) {
        const fix = this.createValueFix(model, marker, pathResult, form);
        if (fix) actions.push(fix);
      }

      // Check for missing property
      if (marker.message.includes("required") || marker.message.includes("missing")) {
        const fix = this.createMissingPropertyFix(model, marker, pathResult, form);
        if (fix) actions.push(fix);
      }
    }

    return actions;
  }

  /**
   * Create a fix for deprecated properties
   */
  private createDeprecationFix(
    model: monaco.editor.ITextModel,
    marker: monaco.editor.IMarkerData,
    pathResult: IJsonPathResult | null,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction | null {
    if (!form || !pathResult) return null;

    const field = this.formCache.getFieldAtPath(form, pathResult.path);
    if (!field || !field.isDeprecated) return null;

    // For now, we can't auto-fix deprecated properties without knowing the replacement
    return null;

    /* Future: When deprecatedBy is added to IField
    const range = new monaco.Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn);

    return {
      title: `Replace with 'replacement'`,
      kind: "quickfix",
      diagnostics: [marker],
      edit: {
        edits: [
          {
            resource: model.uri,
            textEdit: {
              range,
              text: field.deprecatedBy,
            },
            versionId: model.getVersionId(),
          },
        ],
      },
      isPreferred: true,
    };
    */
  }

  /**
   * Create a fix for invalid values
   */
  private createValueFix(
    model: monaco.editor.ITextModel,
    marker: monaco.editor.IMarkerData,
    pathResult: IJsonPathResult | null,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction | null {
    if (!form || !pathResult) return null;

    const field = this.formCache.getFieldAtPath(form, pathResult.path);
    if (!field) return null;

    // Get valid values for this field
    const validValues = this.formCache.getValidValues(field);
    if (validValues.length === 0) return null;

    // Use the first valid value as suggestion
    const suggestedValue = validValues[0];
    const range = new monaco.Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn);

    return {
      title: `Change to '${suggestedValue}'`,
      kind: "quickfix",
      diagnostics: [marker],
      edit: {
        edits: [
          {
            resource: model.uri,
            textEdit: {
              range,
              text: typeof suggestedValue === "string" ? `"${suggestedValue}"` : String(suggestedValue),
            },
            versionId: model.getVersionId(),
          },
        ],
      },
    };
  }

  /**
   * Create a fix for missing required properties
   */
  private createMissingPropertyFix(
    model: monaco.editor.ITextModel,
    marker: monaco.editor.IMarkerData,
    pathResult: IJsonPathResult | null,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction | null {
    if (!form) return null;

    // Extract property name from message
    const match = marker.message.match(/['"](\w+)['"]/);
    if (!match) return null;

    const propertyName = match[1];

    // Find the field definition
    const field = this.formCache.searchFields(form, propertyName)[0];
    if (!field) return null;

    // Generate default value
    const defaultValue = this.getDefaultValue(field);

    // Find insertion point
    const lineContent = model.getLineContent(marker.startLineNumber);
    const insertPosition = new monaco.Position(marker.startLineNumber, lineContent.length);

    // Calculate indentation
    const indentMatch = lineContent.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] + "  " : "  ";

    const insertText = `,\n${indent}"${propertyName}": ${JSON.stringify(defaultValue)}`;

    return {
      title: `Add missing property '${propertyName}'`,
      kind: "quickfix",
      diagnostics: [marker],
      edit: {
        edits: [
          {
            resource: model.uri,
            textEdit: {
              range: new monaco.Range(
                insertPosition.lineNumber,
                insertPosition.column,
                insertPosition.lineNumber,
                insertPosition.column
              ),
              text: insertText,
            },
            versionId: model.getVersionId(),
          },
        ],
      },
    };
  }

  // =========================================================================
  // Refactoring Actions
  // =========================================================================

  /**
   * Get refactoring actions
   */
  private getRefactoringActions(
    model: monaco.editor.ITextModel,
    pathResult: IJsonPathResult | null,
    content: string,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction[] {
    const actions: monaco.languages.CodeAction[] = [];

    if (!pathResult) return actions;

    // Extract to component group (if in components section)
    if (this.isInComponentsSection(pathResult.path)) {
      actions.push(this.createExtractComponentGroupAction(model, pathResult, content));
    }

    // Convert array to object shorthand
    if (Array.isArray(pathResult.currentValue) && (pathResult.currentValue as unknown[]).length === 1) {
      actions.push(this.createArrayToValueAction(model, pathResult));
    }

    // Wrap value in array
    if (
      typeof pathResult.currentValue !== "object" ||
      (pathResult.currentValue !== null && !Array.isArray(pathResult.currentValue))
    ) {
      const field = form ? this.formCache.getFieldAtPath(form, pathResult.path) : null;
      if (field && (field.dataType === FieldDataType.stringArray || field.dataType === FieldDataType.objectArray)) {
        actions.push(this.createValueToArrayAction(model, pathResult));
      }
    }

    return actions;
  }

  /**
   * Create action to extract components to a component group
   */
  private createExtractComponentGroupAction(
    model: monaco.editor.ITextModel,
    pathResult: IJsonPathResult,
    content: string
  ): monaco.languages.CodeAction {
    return {
      title: "Extract to component group...",
      kind: "refactor.extract",
      disabled: "Extract to component group is not yet implemented",
    };
  }

  /**
   * Create action to convert single-element array to value
   */
  private createArrayToValueAction(
    model: monaco.editor.ITextModel,
    pathResult: IJsonPathResult
  ): monaco.languages.CodeAction {
    const arr = pathResult.currentValue as unknown[];
    const _value = arr[0];

    return {
      title: "Unwrap single-element array",
      kind: "refactor.rewrite",
      disabled: "Array unwrapping not yet implemented",
    };
  }

  /**
   * Create action to wrap value in array
   */
  private createValueToArrayAction(
    model: monaco.editor.ITextModel,
    pathResult: IJsonPathResult
  ): monaco.languages.CodeAction {
    return {
      title: "Wrap in array",
      kind: "refactor.rewrite",
      disabled: "Value wrapping not yet implemented",
    };
  }

  // =========================================================================
  // Source Actions
  // =========================================================================

  /**
   * Get source actions
   */
  private getSourceActions(model: monaco.editor.ITextModel, content: string): monaco.languages.CodeAction[] {
    const actions: monaco.languages.CodeAction[] = [];

    // Sort properties
    actions.push({
      title: "Sort properties alphabetically",
      kind: "source.organizeImports",
      disabled: "Property sorting not yet implemented",
    });

    // Format document
    actions.push({
      title: "Format JSON",
      kind: "source.format",
      command: {
        id: "editor.action.formatDocument",
        title: "Format Document",
      },
    });

    return actions;
  }

  // =========================================================================
  // Component Actions
  // =========================================================================

  /**
   * Get component-specific actions
   */
  private getComponentActions(
    model: monaco.editor.ITextModel,
    pathResult: IJsonPathResult,
    content: string,
    form: IFormDefinition | null
  ): monaco.languages.CodeAction[] {
    const actions: monaco.languages.CodeAction[] = [];

    // Add common component
    actions.push({
      title: "Add component...",
      kind: "refactor.inline",
      command: {
        id: "mct.addComponent",
        title: "Add Component",
      },
    });

    // If cursor is on a component, offer to remove it
    if (pathResult.path.some((segment) => segment.startsWith("minecraft:"))) {
      const componentId = this.extractComponentId(pathResult.path);
      if (componentId) {
        actions.push({
          title: `Remove component '${componentId}'`,
          kind: "refactor.inline",
          disabled: "Component removal not yet implemented",
        });
      }
    }

    return actions;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Check if a path is within a components section
   */
  private isInComponentsSection(path: string[]): boolean {
    return path.some((p) => p === "components" || p === "component_groups");
  }

  /**
   * Extract component ID from a path
   */
  private extractComponentId(path: string[]): string | null {
    for (const segment of path) {
      if (segment.startsWith("minecraft:")) {
        return segment;
      }
    }
    return null;
  }

  /**
   * Get default value for a field
   */
  private getDefaultValue(field: IField): unknown {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    switch (field.dataType) {
      case FieldDataType.boolean:
      case FieldDataType.intBoolean:
        return false;
      case FieldDataType.int:
      case FieldDataType.long:
        return 0;
      case FieldDataType.float:
      case FieldDataType.number:
        return 0.0;
      case FieldDataType.string:
      case FieldDataType.stringEnum:
      case FieldDataType.stringLookup:
        return "";
      case FieldDataType.stringArray:
      case FieldDataType.objectArray:
      case FieldDataType.numberArray:
        return [];
      case FieldDataType.object:
      case FieldDataType.keyedObjectCollection:
        return {};
      default:
        return null;
    }
  }
}
