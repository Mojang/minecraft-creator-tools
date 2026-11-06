// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangDiagnostics - Diagnostics for Molang expressions
 */

import { DiagnosticSeverity, IDiagnostic } from "../json/JsonDiagnostics";
import { molangParser, IMolangToken } from "./MolangParser";
import {
  DEFAULT_MOLANG_QUERY_SET,
  findMolangMath,
  findMolangQuery,
  isMolangQueryAvailable,
} from "../../knowledge/BedrockKnowledge";

export interface IMolangDiagnosticOptions {
  /** The owning pack's header.min_engine_version; enables query availability checks. */
  minEngineVersion?: string;
  /**
   * Query set the expression is evaluated in: "default" (entities, animations, render
   * controllers), "world_gen", or "tags". Defaults to "default".
   */
  querySet?: string;
}
import { getRangeQuerySets, IKnowledgeMolangFunction } from "../../knowledge/IBedrockKnowledge";

/**
 * Generate Molang diagnostics
 */
export class MolangDiagnosticGenerator {
  /**
   * Analyze a Molang expression and generate diagnostics
   */
  public analyze(
    expression: string,
    lineNumber: number = 1,
    columnOffset: number = 0,
    options: IMolangDiagnosticOptions = {}
  ): IDiagnostic[] {
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
    const querySet = options.querySet ?? DEFAULT_MOLANG_QUERY_SET;
    // Driven by the tokens, so each use of a repeated query is diagnosed at its own range.
    for (const token of parsed.tokens) {
      if (token.type !== "query" || !token.fullIdentifier) {
        continue;
      }
      const query = token.fullIdentifier;
      const lower = query.toLowerCase();
      const knownQuery = findMolangQuery(query);
      const isKnown = knownQuery !== undefined;

      let unavailableMessage: string | undefined;
      if (knownQuery && !isMolangQueryAvailable(knownQuery, undefined, querySet)) {
        const sets = [...new Set(knownQuery.availability.flatMap(getRangeQuerySets))].join(", ");
        unavailableMessage = `"${knownQuery.name}" is only available in ${sets} expressions, not ${querySet} ones.`;
      } else if (
        knownQuery &&
        options.minEngineVersion &&
        !isMolangQueryAvailable(knownQuery, options.minEngineVersion, querySet)
      ) {
        const ranges = knownQuery.availability
          .map((r) => (r.lastVersion ? `${r.firstVersion}-${r.lastVersion}` : `${r.firstVersion} and later`))
          .join(", ");
        unavailableMessage = `"${knownQuery.name}" is not available for packs with min_engine_version ${options.minEngineVersion} (available: ${ranges}).`;
      }
      if (unavailableMessage) {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: columnOffset + token.start + 1,
          endLine: lineNumber,
          endColumn: columnOffset + token.end + 1,
          message: unavailableMessage,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools-Molang",
          code: "MOLANG_QUERY_UNAVAILABLE",
        });
      }

      if (!isKnown && lower !== "query" && lower !== "q") {
        diagnostics.push({
          startLine: lineNumber,
          startColumn: columnOffset + token.start + 1,
          endLine: lineNumber,
          endColumn: columnOffset + token.end + 1,
          message: `Unknown query: "${query}". Check spelling or this may be a custom query.`,
          severity: DiagnosticSeverity.Warning,
          source: "MCTools-Molang",
          code: "MOLANG_UNKNOWN_QUERY",
        });
      }
    }

    // Check for unknown math functions
    for (const func of parsed.mathFunctions) {
      const isKnown = findMolangMath(func) !== undefined;

      if (!isKnown && func.toLowerCase() !== "math") {
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

    // Check argument counts against engine signatures
    diagnostics.push(...this.checkArgumentCounts(parsed.tokens, lineNumber, columnOffset));

    // Check for common mistakes
    diagnostics.push(...this.checkCommonMistakes(expression, parsed, lineNumber, columnOffset));

    return diagnostics;
  }

  /**
   * Validate the number of arguments passed to known queries and math functions.
   */
  private checkArgumentCounts(tokens: IMolangToken[], lineNumber: number, columnOffset: number): IDiagnostic[] {
    const diagnostics: IDiagnostic[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if ((token.type !== "query" && token.type !== "math") || !token.fullIdentifier) {
        continue;
      }

      const signature: IKnowledgeMolangFunction | undefined =
        token.type === "query" ? findMolangQuery(token.fullIdentifier) : findMolangMath(token.fullIdentifier);
      if (!signature) {
        continue;
      }

      const argCount = countCallArguments(tokens, i + 1);
      const tooFew = argCount < signature.minArgs;
      // Query metadata undercounts optional arguments (vanilla calls "query.anger_level(this)",
      // listed as taking none), so only math functions are checked for too many.
      const tooMany = token.type === "math" && signature.maxArgs !== undefined && argCount > signature.maxArgs;
      if (!tooFew && !tooMany) {
        continue;
      }

      const expected =
        signature.maxArgs === undefined
          ? `at least ${signature.minArgs}`
          : signature.minArgs === signature.maxArgs
            ? `${signature.minArgs}`
            : `${signature.minArgs}-${signature.maxArgs}`;

      diagnostics.push({
        startLine: lineNumber,
        startColumn: columnOffset + token.start + 1,
        endLine: lineNumber,
        endColumn: columnOffset + token.end + 1,
        message: `"${token.fullIdentifier}" expects ${expected} argument(s) but got ${argCount}.`,
        severity: token.type === "math" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
        source: "MCTools-Molang",
        code: "MOLANG_ARGUMENT_COUNT",
      });
    }

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

    // Check for = instead of == in a ternary condition, e.g. "q.health = 0 ? 1 : 2".
    // Each statement is checked on its own, and a statement's leading "v.x = ..."
    // is an assignment to a variable, so "v.x = q.a > 1 ? 1 : 0;" isn't flagged.
    const statementPattern = /[^;{}]+/g;
    let statement;
    while ((statement = statementPattern.exec(expression)) !== null) {
      const text = statement[0];
      const singleEqualsPattern = /([^=!<>])=([^=])/g;
      let match;
      while ((match = singleEqualsPattern.exec(text)) !== null) {
        const equalsIndex = match.index + 1;
        const before = text.slice(0, equalsIndex);
        const after = text.slice(equalsIndex + 1);

        const isLeadingAssignment = /^\s*(?:v|variable|t|temp)\.[\w.]+\s*$/i.test(before);
        const hasTernary = after.replace(/\?\?/g, "").includes("?");

        if (!isLeadingAssignment && hasTernary) {
          const column = columnOffset + statement.index + equalsIndex + 1;
          diagnostics.push({
            startLine: lineNumber,
            startColumn: column,
            endLine: lineNumber,
            endColumn: column + 1,
            message: "Did you mean '==' for comparison? Single '=' is assignment.",
            severity: DiagnosticSeverity.Warning,
            source: "MCTools-Molang",
            code: "MOLANG_POSSIBLE_COMPARISON",
          });
        }
      }
    }

    // Check for division by a literal zero ("x / 0", "x/0.0"), but not "1 / 0.6".
    if (/\/\s*0+(?:\.0*)?(?![\w.])/.test(expression)) {
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

/**
 * Count the top-level arguments of a call whose "(" is expected at tokens[openIndex].
 * Returns 0 when the identifier is not followed by a call.
 */
function countCallArguments(tokens: IMolangToken[], openIndex: number): number {
  const open = tokens[openIndex];
  if (!open || open.type !== "parenthesis" || open.value !== "(") {
    return 0;
  }

  let depth = 0;
  let commas = 0;
  let sawContent = false;
  for (let j = openIndex; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.value === "(" || t.value === "[" || t.value === "{") {
      depth++;
      if (depth === 1) continue;
    } else if (t.value === ")" || t.value === "]" || t.value === "}") {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && t.type === "comma") {
      commas++;
      continue;
    }
    if (depth >= 1) sawContent = true;
  }

  return sawContent ? commas + 1 : 0;
}
