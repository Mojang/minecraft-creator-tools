/**
 * MinecraftCompletionProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Provides smart autocompletion for Minecraft JSON files in Monaco editor.
 * Offers contextual suggestions based on the current position in the document.
 *
 * Uses langcore for platform-agnostic completion generation and
 * CrossReferenceCompletionSource for cross-file reference completions.
 *
 * FEATURES:
 * 1. Property name suggestions - Based on form definitions
 * 2. Value suggestions - Enum values, lookups, references
 * 3. Component suggestions - minecraft: components with documentation
 * 4. Cross-file suggestions - Entity IDs, texture paths, geometry names,
 *    animations, animation controllers, render controllers, sounds,
 *    particles, fog, loot tables, recipes, biomes, spawn rules,
 *    structures, dialogues, functions, and features.
 *    Uses ContentIndex (populated by CrossReferenceIndexGenerator)
 *    plus vanilla metadata from Database for entity/block/item/biome lists.
 *
 * HOW IT WORKS:
 * 1. User triggers autocomplete (Ctrl+Space or typing)
 * 2. JsonPathResolver determines context (key vs value position)
 * 3. FormDefinitionCache provides valid options for that context
 * 4. For cross-file references, langcore detects reference type from
 *    JSON path/property, then queries ContentIndex for matching entries
 * 5. Provider returns formatted completion items
 *
 * RELATED FILES:
 * - JsonPathResolver.ts - Determines context at cursor
 * - FormDefinitionCache.ts - Provides field metadata
 * - langcore/json/JsonCompletionItems.ts - Platform-agnostic completion generation
 * - langcore/json/CrossReferenceCompletionSource.ts - Shared cross-file completion logic
 * - WebCompletionBridge.ts - Bridges langcore interfaces with web platform
 * - core/ContentIndex.ts - Trie data structure queried for completions
 * - info/CrossReferenceIndexGenerator.ts - Populates content index
 *
 * Last updated: February 2026
 */

import * as monaco from "monaco-editor";
import IFormDefinition from "../../dataform/IFormDefinition";
import IField, { FieldDataType } from "../../dataform/IField";
import { JsonPathResolver, IJsonPathResult } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItem from "../../app/ProjectItem";
import Project from "../../app/Project";
import {
  ReferenceType,
  getReferenceTypeFromPath,
  getReferenceTypeFromProperty,
} from "../../langcore/shared/MinecraftReferenceTypes";
import Log from "../../core/Log";
import { ICrossReferenceCompletionSource } from "../../langcore/json/CrossReferenceCompletionSource";
import { createWebCompletionSource } from "./WebCompletionBridge";
import { toMonacoCompletionItems } from "./LangcoreAdapters";

/**
 * File context for completion resolution
 */
interface ICompletionContext {
  projectItem?: ProjectItem;
  project?: Project;
  form?: IFormDefinition;
  itemType?: ProjectItemType;
}

/**
 * Monaco completion provider for Minecraft JSON files
 */
export class MinecraftCompletionProvider implements monaco.languages.CompletionItemProvider {
  public readonly triggerCharacters = ['"', ":", "{", "[", ",", " "];

  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private context: ICompletionContext = {};
  private crossRefSource: ICrossReferenceCompletionSource | undefined;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context for completion resolution
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.context.projectItem = projectItem;
    this.context.project = project;

    // Create or update the cross-reference completion source
    if (project) {
      if (!this.crossRefSource) {
        this.crossRefSource = createWebCompletionSource(project);
      }
    }

    if (projectItem) {
      this.context.itemType = projectItem.itemType;
      Log.debug(
        `[CompletionProvider] updateContext called for itemType=${projectItem.itemType} (${ProjectItemType[projectItem.itemType]})`
      );

      // Pre-load form for this item type
      this.formCache.getFormForItemType(projectItem.itemType).then((form) => {
        if (form) {
          this.context.form = form;
          Log.debug(`[CompletionProvider] Form loaded: ${form.id}, fields=${form.fields?.length ?? 0}`);
        } else {
          Log.debug(`[CompletionProvider] No form found for itemType=${projectItem.itemType}`);
        }
      });
    }
  }

  /**
   * Provide completion items for a position
   */
  public async provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: monaco.languages.CompletionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.CompletionList | null> {
    try {
      // Get JSON path context
      const pathResult = this.pathResolver.getPathAtPosition(model, position);

      Log.debug(
        `[CompletionProvider] path=${JSON.stringify(pathResult.path)} inKey=${pathResult.inKeyPosition} inValue=${pathResult.inValuePosition} hasForm=${!!this.context.form} itemType=${this.context.itemType}`
      );

      // Build completion items based on context
      const suggestions = await this.buildCompletionItems(pathResult, model, position);

      Log.debug(`[CompletionProvider] returning ${suggestions.length} suggestions`);
      if (suggestions.length > 0) {
        Log.debug(
          `[CompletionProvider] first few: ${suggestions
            .slice(0, 3)
            .map((s) => (s as any).label)
            .join(", ")}`
        );
      }

      return {
        suggestions,
        incomplete: false,
      };
    } catch (e: unknown) {
      Log.debug(`[CompletionProvider] ERROR in provideCompletionItems: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /**
   * Build completion items based on context
   */
  private async buildCompletionItems(
    pathResult: IJsonPathResult,
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.CompletionItem[]> {
    const items: monaco.languages.CompletionItem[] = [];

    // Compute the replacement range.
    // For key positions inside quoted strings, Monaco's getWordUntilPosition
    // doesn't handle JSON keys well (e.g., "minecraft:" has : as word break).
    // Instead, find the enclosing quote boundaries and use those.
    let range: monaco.Range;
    let insideQuotes = false;

    if (pathResult.inKeyPosition || pathResult.inValuePosition) {
      const lineContent = model.getLineContent(position.lineNumber);
      const col = position.column - 1; // 0-based

      // Find the opening quote before cursor
      let openQuoteCol = -1;
      for (let i = col - 1; i >= 0; i--) {
        if (lineContent[i] === '"') {
          openQuoteCol = i;
          break;
        }
      }

      // Find the closing quote after cursor (if any)
      let closeQuoteCol = -1;
      for (let i = col; i < lineContent.length; i++) {
        if (lineContent[i] === '"') {
          closeQuoteCol = i;
          break;
        }
      }

      if (openQuoteCol >= 0) {
        insideQuotes = true;
        // Range from after the opening quote to just before the closing quote (or cursor if no closing quote)
        // This replaces the text BETWEEN the quotes without eating the quotes themselves
        const rangeEnd = closeQuoteCol >= 0 ? closeQuoteCol + 1 : col + 1; // 1-based, at (not past) closing quote
        range = new monaco.Range(
          position.lineNumber,
          openQuoteCol + 1 + 1, // 1-based, after the opening quote
          position.lineNumber,
          rangeEnd
        );
      } else {
        const wordInfo = model.getWordUntilPosition(position);
        range = new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
      }
    } else {
      const wordInfo = model.getWordUntilPosition(position);
      range = new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
    }

    // If form isn't loaded yet, try to load it now (fixes race condition
    // where user triggers autocomplete before async pre-load completes)
    if (!this.context.form && this.context.itemType !== undefined) {
      const form = await this.formCache.getFormForItemType(this.context.itemType);
      if (form) {
        this.context.form = form;
        Log.debug(`[CompletionProvider] Form loaded on-demand: ${form.id}, fields=${form.fields?.length ?? 0}`);
      }
    }

    if (!this.context.form) {
      Log.debug(`[CompletionProvider] No form available, returning empty`);
      return items;
    }

    // Determine what kind of completions to provide
    if (pathResult.inKeyPosition) {
      // Suggest property names
      items.push(...(await this.getPropertyCompletions(pathResult, range, insideQuotes)));
    } else if (pathResult.inValuePosition) {
      // Suggest values for this property
      items.push(...(await this.getValueCompletions(pathResult, range)));
    } else {
      // Suggest based on context (might be after : or in empty object)
      items.push(...(await this.getContextualCompletions(pathResult, range)));
    }

    return items;
  }

  /**
   * Get property name completions
   */
  private async getPropertyCompletions(
    pathResult: IJsonPathResult,
    range: monaco.Range,
    insideQuotes: boolean = false
  ): Promise<monaco.languages.CompletionItem[]> {
    const items: monaco.languages.CompletionItem[] = [];

    if (!this.context.form) {
      return items;
    }

    // Get the parent field to find available sub-properties
    const parentPath = pathResult.path.slice(0, -1);
    let availableFields: IField[] = [];

    if (parentPath.length === 0) {
      // Root level - use form fields
      availableFields = this.context.form.fields || [];
    } else {
      // Nested level - get parent field's subFields
      const parentField = this.formCache.getFieldAtPath(this.context.form, parentPath);
      if (parentField?.subFields) {
        availableFields = Object.values(parentField.subFields);
      }
    }

    // Create completion items for each field
    for (const field of availableFields) {
      if (!field.id) continue;

      const item: monaco.languages.CompletionItem = {
        label: field.id,
        kind: this.getCompletionKind(field),
        detail: field.title || undefined,
        documentation: field.description ? { value: field.description } : undefined,
        insertText: insideQuotes ? field.id : `"${field.id}"`,
        filterText: insideQuotes ? field.id : `"${field.id}"`,
        range,
        sortText: this.getSortText(field),
      };

      items.push(item);
    }

    // Add component suggestions for component containers.
    // NOTE: getComponentSuggestions is async because it calls FormDefinitionCache.getComponentsAsync(),
    // which may need to load sub-forms (via subFormId references) on first access.
    const lastSegment = pathResult.path[pathResult.path.length - 1];
    if (lastSegment === "components" || lastSegment === "component_groups") {
      items.push(...(await this.getComponentSuggestions(range, insideQuotes)));
    } else if (this.isInsideComponentGroup(pathResult.path)) {
      // Inside a specific component group (e.g., component_groups > minecraft:baby_wild),
      // offer the same component suggestions as for "components"
      items.push(...(await this.getComponentSuggestions(range, insideQuotes)));
    }

    return items;
  }

  /**
   * Get value completions
   */
  private async getValueCompletions(
    pathResult: IJsonPathResult,
    range: monaco.Range
  ): Promise<monaco.languages.CompletionItem[]> {
    const items: monaco.languages.CompletionItem[] = [];

    if (!this.context.form) {
      return items;
    }

    // Get the field for the current property
    const field = this.formCache.getFieldAtPath(this.context.form, pathResult.path);
    if (!field) {
      // Try to get cross-file reference completions using langcore
      const refType = this.determineReferenceType(pathResult);
      if (refType !== "unknown") {
        items.push(...(await this.getCrossFileCompletionsAsync(refType, range)));
      }
      return items;
    }

    // Get valid values from field
    const validValues = this.formCache.getValidValues(field);
    for (const value of validValues) {
      items.push({
        label: value,
        kind: monaco.languages.CompletionItemKind.EnumMember,
        insertText: `"${value}"`,
        range,
      });
    }

    // Add boolean suggestions
    if (field.dataType === FieldDataType.boolean || field.dataType === FieldDataType.intBoolean) {
      items.push(
        {
          label: "true",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "true",
          range,
        },
        {
          label: "false",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "false",
          range,
        }
      );
    }

    // Also check for cross-file reference completions based on langcore
    const refType = this.determineReferenceType(pathResult);
    if (refType !== "unknown") {
      items.push(...(await this.getCrossFileCompletionsAsync(refType, range)));
    }

    return items;
  }

  /**
   * Determine reference type using langcore
   */
  private determineReferenceType(pathResult: IJsonPathResult): ReferenceType | "unknown" {
    const lastSegment = pathResult.path[pathResult.path.length - 1] || "";

    // Try langcore reference detection (expects array, not string)
    let refType = getReferenceTypeFromPath(pathResult.path);
    if (refType !== "unknown") {
      return refType;
    }

    // Also check by property name
    refType = getReferenceTypeFromProperty(lastSegment);
    return refType;
  }

  /**
   * Get cross-file reference completions asynchronously based on reference type.
   * Dispatches to specific async helpers or handles same-file references inline.
   * Uses the shared CrossReferenceCompletionSource from langcore.
   */
  private async getCrossFileCompletionsAsync(
    refType: ReferenceType,
    range: monaco.Range
  ): Promise<monaco.languages.CompletionItem[]> {
    if (!this.context.project || !this.crossRefSource) {
      return [];
    }

    // Handle same-file references (event, component_group) from current file JSON
    if (refType === "event" || refType === "component_group") {
      const projectItem = this.context.projectItem;
      if (projectItem && projectItem.primaryFile) {
        try {
          const content = projectItem.primaryFile.content;
          if (content && typeof content === "string") {
            const json = JSON.parse(content);
            const langcoreItems = this.crossRefSource.getSameFileCompletions(refType, json);
            return toMonacoCompletionItems(langcoreItems, range);
          }
        } catch {
          // File may not be valid JSON
        }
      }
      return [];
    }

    // Dispatch cross-file reference types to the shared source
    switch (refType) {
      case "texture":
        return this.getTextureCompletionsAsync(range);
      case "geometry":
        return this.getGeometryCompletionsAsync(range);
      case "animation":
        return this.getAnimationCompletionsAsync(range);
      case "animation_controller":
        return this.getAnimationControllerCompletionsAsync(range);
      case "render_controller":
        return this.getRenderControllerCompletionsAsync(range);
      case "entity_id":
        return this.getEntityCompletionsAsync(range);
      case "block_id":
        return this.getBlockCompletionsAsync(range);
      case "item_id":
        return this.getItemCompletionsAsync(range);
      case "loot_table":
        return this.getLootTableCompletionsAsync(range);
      case "sound":
        return this.getSoundCompletionsAsync(range);
      case "particle":
      case "fog":
      case "recipe":
      case "feature":
      case "biome":
      case "spawn_rule":
      case "structure":
      case "dialogue":
      case "function": {
        const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType(refType);
        return toMonacoCompletionItems(langcoreItems, range);
      }
      default:
        return [];
    }
  }

  /**
   * Get texture completions from project and vanilla via shared source
   */
  private async getTextureCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("texture");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get geometry completions from project via shared source
   */
  private async getGeometryCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("geometry");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get animation completions from project via shared source
   */
  private async getAnimationCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("animation");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get animation controller completions from project via shared source
   */
  private async getAnimationControllerCompletionsAsync(
    range: monaco.Range
  ): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("animation_controller");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get render controller completions from project via shared source
   */
  private async getRenderControllerCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("render_controller");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get entity completions from project and vanilla via shared source
   */
  private async getEntityCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("entity_id");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get block completions from project and vanilla via shared source
   */
  private async getBlockCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("block_id");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get item completions from project and vanilla via shared source
   */
  private async getItemCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("item_id");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get loot table completions from project via shared source
   */
  private async getLootTableCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("loot_table");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Get sound completions from project via shared source
   */
  private async getSoundCompletionsAsync(range: monaco.Range): Promise<monaco.languages.CompletionItem[]> {
    if (!this.crossRefSource) return [];
    const langcoreItems = await this.crossRefSource.getCompletionsForReferenceType("sound");
    return toMonacoCompletionItems(langcoreItems, range);
  }

  /**
   * Check if the path is inside a specific component group
   * (i.e., path contains "component_groups" followed by a group name,
   * and we're at the level where components should be added)
   */
  private isInsideComponentGroup(path: string[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i] === "component_groups") {
        // The next segment is a group name, and if lastSegment is *that* group name
        // (meaning we're directly inside it), offer components
        return true;
      }
    }
    return false;
  }

  /**
   * Get contextual completions (when not clearly in key or value)
   */
  private async getContextualCompletions(
    pathResult: IJsonPathResult,
    range: monaco.Range
  ): Promise<monaco.languages.CompletionItem[]> {
    // Default to property completions
    return this.getPropertyCompletions(pathResult, range);
  }

  /**
   * Get component suggestions for entity/block/item files
   */
  private async getComponentSuggestions(
    range: monaco.Range,
    insideQuotes: boolean = false
  ): Promise<monaco.languages.CompletionItem[]> {
    const items: monaco.languages.CompletionItem[] = [];

    if (!this.context.form) {
      return items;
    }

    // Get all components from the form, following subFormId references
    const components = await this.formCache.getComponentsAsync(this.context.form);
    Log.debug(
      `[CompletionProvider] getComponentSuggestions: found ${components.length} components from form '${this.context.form.id}'`
    );
    for (const component of components) {
      if (!component.id) continue;

      // Skip document-level wrappers like "minecraft:entity" - these are not components
      if (
        component.id === "minecraft:entity" ||
        component.id === "minecraft:block" ||
        component.id === "minecraft:item"
      ) {
        continue;
      }

      items.push({
        label: component.id,
        kind: monaco.languages.CompletionItemKind.Module,
        detail: component.title || "Component",
        documentation: component.description ? { value: component.description } : undefined,
        insertText: insideQuotes ? component.id : this.getComponentSnippet(component),
        insertTextRules: insideQuotes ? undefined : monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        filterText: insideQuotes ? component.id : `"${component.id}"`,
        range,
        sortText: "0" + component.id, // Sort components first
      });
    }

    return items;
  }

  /**
   * Generate a snippet for a component
   */
  private getComponentSnippet(component: IField): string {
    // Start with component key
    let snippet = `"${component.id}": {\n`;

    // Add required subfields with placeholders
    if (component.subFields) {
      let placeholderIndex = 1;
      const subFieldKeys = Object.keys(component.subFields);

      for (const key of subFieldKeys.slice(0, 3)) {
        // Limit to first 3 fields
        const subField = component.subFields[key];
        if (subField.isRequired) {
          const defaultValue = this.getDefaultSnippetValue(subField, placeholderIndex);
          snippet += `  "${key}": ${defaultValue},\n`;
          placeholderIndex++;
        }
      }

      // Add final cursor position
      snippet += `  $${placeholderIndex}\n`;
    } else {
      snippet += "  $1\n";
    }

    snippet += "}";
    return snippet;
  }

  /**
   * Get default snippet value for a field
   */
  private getDefaultSnippetValue(field: IField, index: number): string {
    switch (field.dataType) {
      case FieldDataType.boolean:
      case FieldDataType.intBoolean:
        return `\${${index}:true}`;
      case FieldDataType.int:
      case FieldDataType.float:
      case FieldDataType.number:
        return `\${${index}:${field.defaultValue ?? 0}}`;
      case FieldDataType.string:
      case FieldDataType.stringEnum:
        return `"\${${index}:${field.defaultValue ?? ""}}"`;
      case FieldDataType.object:
        return `{\n    $${index}\n  }`;
      case FieldDataType.objectArray:
      case FieldDataType.stringArray:
        return `[\n    $${index}\n  ]`;
      case FieldDataType.point3:
      case FieldDataType.intPoint3:
        return `[\${${index}:0}, \${${index + 1}:0}, \${${index + 2}:0}]`;
      default:
        return `$${index}`;
    }
  }

  /**
   * Get completion kind for a field
   */
  private getCompletionKind(field: IField): monaco.languages.CompletionItemKind {
    if (field.id?.startsWith("minecraft:")) {
      return monaco.languages.CompletionItemKind.Module;
    }

    switch (field.dataType) {
      case FieldDataType.boolean:
      case FieldDataType.intBoolean:
        return monaco.languages.CompletionItemKind.Value;
      case FieldDataType.stringEnum:
      case FieldDataType.intEnum:
        return monaco.languages.CompletionItemKind.Enum;
      case FieldDataType.object:
      case FieldDataType.objectArray:
        return monaco.languages.CompletionItemKind.Struct;
      default:
        return monaco.languages.CompletionItemKind.Property;
    }
  }

  /**
   * Get sort text for ordering completions
   */
  private getSortText(field: IField): string {
    // Required fields first, then by name
    if (field.isRequired) {
      return "0" + (field.id || "");
    }
    return "1" + (field.id || "");
  }
}
