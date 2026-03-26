// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonCompletionItems - Platform-agnostic completion item generation
 *
 * This module generates completion items for Minecraft JSON files.
 * The items are returned as structured data that can be converted to
 * vscode.CompletionItem or monaco.languages.CompletionItem by the platform adapter.
 */

import IField, { FieldDataType } from "../../dataform/IField";
import IFormDefinition from "../../dataform/IFormDefinition";
import { FormMetadataProvider } from "../shared/FormMetadataProvider";
import { IJsonPathResult } from "./JsonPathResolver";
import { VANILLA_ENTITIES } from "../shared/MinecraftKnowledge";
import {
  ReferenceType,
  getReferenceTypeFromPath,
} from "../shared/MinecraftReferenceTypes";

/**
 * Completion item kind (platform-agnostic)
 */
export enum CompletionItemKind {
  Property = "property",
  Value = "value",
  Enum = "enum",
  EnumMember = "enumMember",
  Component = "component",
  Entity = "entity",
  Block = "block",
  Item = "item",
  Event = "event",
  Keyword = "keyword",
  File = "file",
  Folder = "folder",
  Reference = "reference",
  Module = "module",
  Class = "class",
  Interface = "interface",
  Function = "function",
  Variable = "variable",
  Constant = "constant",
  Snippet = "snippet",
  Text = "text",
}

/**
 * A completion item (platform-agnostic)
 */
export interface ICompletionItem {
  /** Display label */
  label: string;
  /** Kind of completion */
  kind: CompletionItemKind;
  /** Brief description shown inline */
  detail?: string;
  /** Full documentation */
  documentation?: string;
  /** Text to insert (if different from label) */
  insertText?: string;
  /** Sort order prefix (lower = higher priority) */
  sortText?: string;
  /** Filter text (for fuzzy matching) */
  filterText?: string;
  /** Whether to preselect this item */
  preselect?: boolean;
  /** Whether insert text is a snippet */
  isSnippet?: boolean;
  /** Whether this item is deprecated */
  deprecated?: boolean;
}

/**
 * Completion context from the editor
 */
export interface ICompletionContext {
  /** JSON path at cursor */
  pathResult: IJsonPathResult;
  /** Current trigger character (if any) */
  triggerCharacter?: string;
  /** Form definition for this file type */
  form?: IFormDefinition;
  /** Available event names in this file */
  fileEvents?: string[];
  /** Available component groups in this file */
  fileComponentGroups?: string[];
}

/**
 * Generate completion items for Minecraft JSON
 */
export class JsonCompletionItemGenerator {
  /**
   * Generate completion items based on context
   */
  public generateCompletions(context: ICompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    if (context.pathResult.inKeyPosition) {
      // Property name completions
      items.push(...this.generatePropertyCompletions(context));
    } else if (context.pathResult.inValuePosition) {
      // Value completions
      items.push(...this.generateValueCompletions(context));
    } else {
      // Contextual (could be either)
      items.push(...this.generatePropertyCompletions(context));
    }

    return items;
  }

  /**
   * Generate property name completions
   */
  private generatePropertyCompletions(context: ICompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    if (!context.form) {
      return items;
    }

    // Get parent field to find available sub-properties
    const parentPath = context.pathResult.path.slice(0, -1);
    let availableFields: IField[] = [];

    if (parentPath.length === 0) {
      availableFields = context.form.fields || [];
    } else {
      const parentField = FormMetadataProvider.getFieldAtPath(context.form, parentPath);
      if (parentField?.subFields) {
        availableFields = Object.values(parentField.subFields);
      }
    }

    // Create completion items for fields
    for (const field of availableFields) {
      if (!field.id) continue;

      items.push({
        label: field.id,
        kind: CompletionItemKind.Property,
        detail: field.title || undefined,
        documentation: field.description || undefined,
        insertText: `"${field.id}"`,
        sortText: this.getSortText(field),
      });
    }

    // Add component suggestions if in components section
    const lastSegment = context.pathResult.path[context.pathResult.path.length - 1];
    if (lastSegment === "components" || lastSegment === "component_groups") {
      items.push(...this.generateComponentSuggestions());
    }

    return items;
  }

  /**
   * Generate value completions
   */
  private generateValueCompletions(context: ICompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // Check for reference type based on path
    const refType = getReferenceTypeFromPath(context.pathResult.path);

    if (refType !== "unknown") {
      items.push(...this.generateReferenceCompletions(refType, context));
    }

    // Check form for valid values
    if (context.form) {
      const field = FormMetadataProvider.getFieldAtPath(context.form, context.pathResult.path);

      if (field) {
        // Enum values
        const validValues = FormMetadataProvider.getValidValues(field);
        for (const value of validValues) {
          items.push({
            label: value,
            kind: CompletionItemKind.EnumMember,
            insertText: `"${value}"`,
          });
        }

        // Boolean values
        if (field.dataType === FieldDataType.boolean || field.dataType === FieldDataType.intBoolean) {
          items.push(
            { label: "true", kind: CompletionItemKind.Keyword, insertText: "true" },
            { label: "false", kind: CompletionItemKind.Keyword, insertText: "false" }
          );
        }
      }
    }

    // Event references (from same file)
    if (refType === "event" && context.fileEvents) {
      for (const event of context.fileEvents) {
        items.push({
          label: event,
          kind: CompletionItemKind.Event,
          detail: "Event in this file",
          insertText: `"${event}"`,
        });
      }
    }

    // Component group references (from same file)
    if (refType === "component_group" && context.fileComponentGroups) {
      for (const group of context.fileComponentGroups) {
        items.push({
          label: group,
          kind: CompletionItemKind.Reference,
          detail: "Component group in this file",
          insertText: `"${group}"`,
        });
      }
    }

    return items;
  }

  /**
   * Generate reference-type-specific completions
   */
  private generateReferenceCompletions(refType: ReferenceType, context: ICompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    switch (refType) {
      case "entity_id":
        for (const entity of VANILLA_ENTITIES) {
          items.push({
            label: entity,
            kind: CompletionItemKind.Entity,
            detail: "Vanilla entity",
            insertText: `"${entity}"`,
          });
        }
        break;

      case "texture":
        items.push({
          label: "textures/",
          kind: CompletionItemKind.Folder,
          detail: "Texture path",
          insertText: '"textures/',
          isSnippet: false,
        });
        break;

      case "geometry":
        items.push({
          label: "geometry.",
          kind: CompletionItemKind.Reference,
          detail: "Geometry identifier",
          insertText: '"geometry.',
          isSnippet: false,
        });
        break;

      case "animation":
        items.push({
          label: "animation.",
          kind: CompletionItemKind.Reference,
          detail: "Animation identifier",
          insertText: '"animation.',
          isSnippet: false,
        });
        break;

      case "loot_table":
        items.push({
          label: "loot_tables/",
          kind: CompletionItemKind.Folder,
          detail: "Loot table path",
          insertText: '"loot_tables/',
          isSnippet: false,
        });
        break;
    }

    return items;
  }

  /**
   * Generate minecraft: component suggestions
   */
  private generateComponentSuggestions(): ICompletionItem[] {
    // Common entity components
    const entityComponents = [
      { name: "minecraft:health", description: "Entity health and max health" },
      { name: "minecraft:attack", description: "Melee attack damage" },
      { name: "minecraft:movement", description: "Movement speed" },
      { name: "minecraft:physics", description: "Physics properties" },
      { name: "minecraft:collision_box", description: "Collision box size" },
      { name: "minecraft:type_family", description: "Entity type families" },
      { name: "minecraft:loot", description: "Loot table for drops" },
      { name: "minecraft:pushable", description: "Push behavior" },
      { name: "minecraft:nameable", description: "Naming properties" },
      { name: "minecraft:is_baby", description: "Baby variant flag" },
      { name: "minecraft:is_tamed", description: "Tamed state flag" },
      { name: "minecraft:behavior.tempt", description: "Tempt AI goal" },
      { name: "minecraft:behavior.follow_parent", description: "Follow parent AI" },
      { name: "minecraft:behavior.random_stroll", description: "Random walking AI" },
      { name: "minecraft:behavior.look_at_player", description: "Look at player AI" },
      { name: "minecraft:behavior.panic", description: "Panic when hurt AI" },
      { name: "minecraft:navigation.walk", description: "Walking navigation" },
      { name: "minecraft:movement.basic", description: "Basic movement" },
      { name: "minecraft:jump.static", description: "Static jump" },
    ];

    return entityComponents.map((comp) => ({
      label: comp.name,
      kind: CompletionItemKind.Component,
      detail: comp.description,
      insertText: `"${comp.name}": {\n\t$0\n}`,
      isSnippet: true,
      sortText: "0" + comp.name, // Prioritize components
    }));
  }

  /**
   * Get sort text for a field (determines order in completion list)
   */
  private getSortText(field: IField): string {
    // Required fields first
    if (field.isRequired) {
      return "0" + (field.id || "");
    }

    // Common fields next
    const commonFields = ["format_version", "description", "identifier", "components", "component_groups", "events"];
    if (field.id && commonFields.includes(field.id)) {
      return "1" + field.id;
    }

    // Deprecated fields last
    if (field.isDeprecated) {
      return "9" + (field.id || "");
    }

    // Everything else in alphabetical order
    return "5" + (field.id || "");
  }
}

// Singleton instance
export const jsonCompletionItemGenerator = new JsonCompletionItemGenerator();
