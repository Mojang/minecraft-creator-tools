// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangCompletions - Completions for Molang expressions
 */

import { CompletionItemKind, ICompletionItem } from "../json/JsonCompletionItems";
import { MOLANG_QUERIES, MOLANG_MATH } from "./MolangParser";

/**
 * Context for Molang completions
 */
export interface IMolangCompletionContext {
  /** Expression text */
  expression: string;
  /** Cursor offset */
  cursorOffset: number;
  /** Current token being typed */
  prefix: string;
  /** Whether we're inside a function call */
  inFunction: boolean;
  /** Name of the function we're in */
  functionName: string | null;
  /** Existing variables in this file/context */
  existingVariables?: string[];
  /** Existing temp variables */
  existingTemps?: string[];
}

/**
 * Generate Molang completions
 */
export class MolangCompletionGenerator {
  /**
   * Generate completions for current context
   */
  public generateCompletions(context: IMolangCompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // Determine what to complete based on prefix
    const prefixLower = context.prefix.toLowerCase();

    // Query completions
    if (prefixLower.startsWith("q") || prefixLower.startsWith("query")) {
      items.push(...this.generateQueryCompletions(prefixLower));
    }

    // Math completions
    if (prefixLower.startsWith("m") || prefixLower.startsWith("math")) {
      items.push(...this.generateMathCompletions(prefixLower));
    }

    // Variable completions
    if (prefixLower.startsWith("v") || prefixLower.startsWith("variable")) {
      items.push(...this.generateVariableCompletions(context.existingVariables || []));
    }

    // Temp completions
    if (prefixLower.startsWith("t") || prefixLower.startsWith("temp")) {
      items.push(...this.generateTempCompletions(context.existingTemps || []));
    }

    // Context completions
    if (prefixLower.startsWith("c") || prefixLower.startsWith("context")) {
      items.push(...this.generateContextCompletions());
    }

    // If no specific prefix, show all categories
    if (prefixLower.length === 0 || !items.length) {
      items.push(...this.generateAllCompletions());
    }

    return items;
  }

  /**
   * Generate query completions
   */
  private generateQueryCompletions(prefix: string): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    for (const query of MOLANG_QUERIES) {
      const shortName = query.name.replace("query.", "q.");

      items.push({
        label: query.name,
        kind: CompletionItemKind.Property,
        detail: query.returns,
        documentation: query.description,
        insertText: query.name,
        filterText: `${query.name} ${shortName}`,
      });

      // Also add short form
      items.push({
        label: shortName,
        kind: CompletionItemKind.Property,
        detail: query.returns,
        documentation: query.description,
        insertText: shortName,
        sortText: "z" + shortName, // Sort after full names
      });
    }

    return items;
  }

  /**
   * Generate math completions
   */
  private generateMathCompletions(prefix: string): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    for (const func of MOLANG_MATH) {
      items.push({
        label: func.name,
        kind: CompletionItemKind.Value,
        detail: func.syntax,
        documentation: func.description,
        insertText: func.name + "(${1})",
        isSnippet: true,
      });
    }

    return items;
  }

  /**
   * Generate variable completions
   */
  private generateVariableCompletions(existingVariables: string[]): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // Add starters
    items.push({
      label: "variable.",
      kind: CompletionItemKind.Keyword,
      detail: "Entity variable (persistent)",
      insertText: "variable.",
    });

    items.push({
      label: "v.",
      kind: CompletionItemKind.Keyword,
      detail: "Entity variable (short form)",
      insertText: "v.",
    });

    // Add existing variables from context
    for (const variable of existingVariables) {
      if (!variable.startsWith("variable.") && !variable.startsWith("v.")) continue;

      items.push({
        label: variable,
        kind: CompletionItemKind.Property,
        detail: "Existing variable",
        insertText: variable,
      });
    }

    return items;
  }

  /**
   * Generate temp completions
   */
  private generateTempCompletions(existingTemps: string[]): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    items.push({
      label: "temp.",
      kind: CompletionItemKind.Keyword,
      detail: "Temporary variable (expression-scoped)",
      insertText: "temp.",
    });

    items.push({
      label: "t.",
      kind: CompletionItemKind.Keyword,
      detail: "Temporary variable (short form)",
      insertText: "t.",
    });

    // Add existing temps
    for (const temp of existingTemps) {
      if (!temp.startsWith("temp.") && !temp.startsWith("t.")) continue;

      items.push({
        label: temp,
        kind: CompletionItemKind.Property,
        detail: "Existing temp variable",
        insertText: temp,
      });
    }

    return items;
  }

  /**
   * Generate context completions
   */
  private generateContextCompletions(): ICompletionItem[] {
    const contextVars = [
      { name: "context.other", desc: "The other entity in an interaction" },
      { name: "context.item_slot", desc: "Current item slot" },
      { name: "context.block_face", desc: "Block face being interacted with" },
    ];

    return contextVars.map((cv) => ({
      label: cv.name,
      kind: CompletionItemKind.Property,
      detail: cv.desc,
      insertText: cv.name,
    }));
  }

  /**
   * Generate all completion categories
   */
  private generateAllCompletions(): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // Category starters
    items.push({
      label: "query.",
      kind: CompletionItemKind.Keyword,
      detail: "Query entity state",
      insertText: "query.",
    });

    items.push({
      label: "q.",
      kind: CompletionItemKind.Keyword,
      detail: "Query (short form)",
      insertText: "q.",
    });

    items.push({
      label: "math.",
      kind: CompletionItemKind.Keyword,
      detail: "Math functions",
      insertText: "math.",
    });

    items.push({
      label: "variable.",
      kind: CompletionItemKind.Keyword,
      detail: "Entity variable",
      insertText: "variable.",
    });

    items.push({
      label: "v.",
      kind: CompletionItemKind.Keyword,
      detail: "Variable (short)",
      insertText: "v.",
    });

    items.push({
      label: "temp.",
      kind: CompletionItemKind.Keyword,
      detail: "Temp variable",
      insertText: "temp.",
    });

    items.push({
      label: "t.",
      kind: CompletionItemKind.Keyword,
      detail: "Temp (short)",
      insertText: "t.",
    });

    items.push({
      label: "context.",
      kind: CompletionItemKind.Keyword,
      detail: "Interaction context",
      insertText: "context.",
    });

    items.push({
      label: "c.",
      kind: CompletionItemKind.Keyword,
      detail: "Context (short)",
      insertText: "c.",
    });

    // Common snippets
    items.push({
      label: "ternary",
      kind: CompletionItemKind.Value,
      detail: "Conditional expression",
      insertText: "${1:condition} ? ${2:true_value} : ${3:false_value}",
      isSnippet: true,
    });

    items.push({
      label: "lerp",
      kind: CompletionItemKind.Value,
      detail: "Linear interpolation",
      insertText: "math.lerp(${1:start}, ${2:end}, ${3:t})",
      isSnippet: true,
    });

    items.push({
      label: "clamp",
      kind: CompletionItemKind.Value,
      detail: "Clamp value to range",
      insertText: "math.clamp(${1:value}, ${2:min}, ${3:max})",
      isSnippet: true,
    });

    items.push({
      label: "sin-wave",
      kind: CompletionItemKind.Value,
      detail: "Sine wave animation",
      insertText: "math.sin(query.anim_time * ${1:360})",
      isSnippet: true,
    });

    return items;
  }
}

// Singleton instance
export const molangCompletionGenerator = new MolangCompletionGenerator();
