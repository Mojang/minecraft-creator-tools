// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangDiagnostics - Diagnostics for Molang expressions
 */

import { DiagnosticSeverity, IDiagnostic } from "../json/JsonDiagnostics";
import { molangParser, MOLANG_QUERIES, MOLANG_MATH } from "./MolangParser";

/**
 * Generate Molang diagnostics
 */
export class MolangDiagnosticGenerator {
  /**
   * Analyze a Molang expression and generate diagnostics
   */
  public analyze(expression: string, lineNumber: number = 1, columnOffset: number = 0): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];
    const parsed = molangParser.parse(expression);

    // Add parse errors
    for (const error of parsed.errors) {
      diagnostics.push({
        startLine: lineNumber,
        startColumn: columnOffset + error.start + 1,
        endLine: lineNumber,
        endColumn: columnOffset + error.end + 1,
        message: error.message,
        severity: DiagnosticSeverity.Error,
        source: "MCTools-Molang",
        code: "MOLANG_PARSE_ERROR",
      });
    }

    // Check for unknown queries
    for (const query of parsed.queries) {
      const normalized = query.startsWith("q.") ? query.replace("q.", "query.") : query;

      const isKnown = MOLANG_QUERIES.some((q) => normalized.startsWith(q.name));

      if (!isKnown && normalized !== "query." && normalized !== "q.") {
        // Find token position
        const token = parsed.tokens.find((t) => t.fullIdentifier === query);

        diagnostics.push({
          startLine: lineNumber,
          startColumn: columnOffset + (token?.start || 0) + 1,
          endLine: lineNumber,
          endColumn: columnOffset + (token?.end || query.length) + 1,
          message: `Unknown query: "${query}". Check spelling or this may be a custom query.`,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools-Molang",
          code: "MOLANG_UNKNOWN_QUERY",
        });
      }
    }

    // Check for unknown math functions
    for (const func of parsed.mathFunctions) {
      const isKnown = MOLANG_MATH.some((m) => func.startsWith(m.name));

      if (!isKnown && func !== "math.") {
        const token = parsed.tokens.find((t) => t.fullIdentifier === func);

        diagnostics.push({
          startLine: lineNumber,
          startColumn: columnOffset + (token?.start || 0) + 1,
          endLine: lineNumber,
          endColumn: columnOffset + (token?.end || func.length) + 1,
          message: `Unknown math function: "${func}"`,
          severity: DiagnosticSeverity.Error,
          source: "MCTools-Molang",
          code: "MOLANG_UNKNOWN_MATH",
        });
      }
    }

    // Check for common mistakes
    diagnostics.push(...this.checkCommonMistakes(expression, parsed, lineNumber, columnOffset));

    return diagnostics;
  }

  /**
   * Check for common Molang mistakes
   */
  private checkCommonMistakes(
    expression: string,
    parsed: ReturnType<typeof molangParser.parse>,
    lineNumber: number,
    columnOffset: number
  ): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];

    // Check for = instead of == in comparisons
    // Look for pattern: value = value where context suggests comparison
    const singleEqualsPattern = /([^=!<>])=([^=])/g;
    let match;
    while ((match = singleEqualsPattern.exec(expression)) !== null) {
      // Check if this might be an assignment in a conditional context
      const before = expression.slice(0, match.index + 1);
      const after = expression.slice(match.index + match[0].length);

      // If there's a ? after, it's likely a comparison mistake
      if (after.includes("?") && !before.includes("=")) {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: columnOffset + match.index + 2,
          endLine: lineNumber,
          endColumn: columnOffset + match.index + 3,
          message: "Did you mean '==' for comparison? Single '=' is assignment.",
          severity: DiagnosticSeverity.Warning,
          source: "MCTools-Molang",
          code: "MOLANG_POSSIBLE_COMPARISON",
        });
      }
    }

    // Check for division by zero potential
    if (expression.includes("/ 0") || expression.includes("/0")) {
      diagnostics.push({
        startLine: lineNumber,
        startColumn: columnOffset + 1,
        endLine: lineNumber,
        endColumn: columnOffset + expression.length + 1,
        message: "Possible division by zero",
        severity: DiagnosticSeverity.Warning,
        source: "MCTools-Molang",
        code: "MOLANG_DIVISION_BY_ZERO",
      });
    }

    // Check for missing semicolon in multi-statement expression
    const hasMultipleStatements = expression.includes(";");
    const hasReturn = expression.toLowerCase().includes("return");

    if (hasMultipleStatements && !expression.trim().endsWith(";") && !hasReturn) {
      diagnostics.push({
        startLine: lineNumber,
        startColumn: columnOffset + expression.length,
        endLine: lineNumber,
        endColumn: columnOffset + expression.length + 1,
        message: "Multi-statement expression should end with semicolon",
        severity: DiagnosticSeverity.Information,
        source: "MCTools-Molang",
        code: "MOLANG_MISSING_SEMICOLON",
      });
    }

    // Check for deprecated shorthand that might cause issues
    // (Most shorthands are fine, but sometimes people mix them inconsistently)
    const hasShortQuery = parsed.queries.some((q) => q.startsWith("q."));
    const hasLongQuery = parsed.queries.some((q) => q.startsWith("query."));

    if (hasShortQuery && hasLongQuery) {
      diagnostics.push({
        startLine: lineNumber,
        startColumn: columnOffset + 1,
        endLine: lineNumber,
        endColumn: columnOffset + expression.length + 1,
        message: "Mixing short (q.) and long (query.) forms. Consider using consistent style.",
        severity: DiagnosticSeverity.Hint,
        source: "MCTools-Molang",
        code: "MOLANG_INCONSISTENT_STYLE",
      });
    }

    return diagnostics;
  }

  /**
   * Validate a Molang expression (quick check)
   */
  public isValid(expression: string): boolean {
    const parsed = molangParser.parse(expression);
    return parsed.isValid;
  }

  /**
   * Get a quick summary of expression contents
   */
  public getSummary(expression: string): {
    queryCount: number;
    variableCount: number;
    tempCount: number;
    mathCount: number;
    isComplex: boolean;
  } {
    const parsed = molangParser.parse(expression);

    return {
      queryCount: parsed.queries.length,
      variableCount: parsed.variables.length,
      tempCount: parsed.temps.length,
      mathCount: parsed.mathFunctions.length,
      isComplex: parsed.tokens.length > 20 || expression.includes(";"),
    };
  }
}

// Singleton instance
export const molangDiagnosticGenerator = new MolangDiagnosticGenerator();
