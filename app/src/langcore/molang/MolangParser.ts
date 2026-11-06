// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangParser - Parse Molang expressions
 *
 * Provides tokenization and parsing of Molang expressions for editor intelligence.
 */

import { IBedrockKnowledge, IKnowledgeVersionRange } from "../../knowledge/IBedrockKnowledge";
import {
  formatMolangSignature,
  getBedrockKnowledge,
  onDidChangeBedrockKnowledge,
} from "../../knowledge/BedrockKnowledge";
import { getMolangMathDoc } from "./MolangMathDocs";

/**
 * Molang token types
 */
export type MolangTokenType =
  | "query" // query.is_baby, q.is_baby
  | "variable" // variable.my_var, v.my_var
  | "temp" // temp.x, t.x
  | "context" // context.other, c.other
  | "math" // math.sin, math.cos
  | "geometry" // geometry.bone
  | "material" // material.x
  | "texture" // texture.x
  | "array" // array.x
  | "number" // 1.5, 42
  | "string" // 'text'
  | "operator" // +, -, *, /, ==, etc.
  | "parenthesis" // (, )
  | "bracket" // [, ]
  | "brace" // {, }
  | "comma" // ,
  | "semicolon" // ;
  | "colon" // :
  | "questionmark" // ?
  | "dot" // .
  | "arrow" // ->
  | "keyword" // return, loop, for_each, break, continue, this
  | "identifier" // other identifiers
  | "whitespace"
  | "unknown";

/**
 * A Molang token
 */
export interface IMolangToken {
  type: MolangTokenType;
  value: string;
  start: number;
  end: number;
  /** For query/variable/math, the full function call including method */
  fullIdentifier?: string;
}

/**
 * Parsed Molang expression structure
 */
export interface IParsedMolang {
  /** Original expression text */
  text: string;
  /** Tokens */
  tokens: IMolangToken[];
  /** All queries used */
  queries: string[];
  /** All variables used */
  variables: string[];
  /** All temp variables used */
  temps: string[];
  /** All math functions used */
  mathFunctions: string[];
  /** Whether expression appears valid */
  isValid: boolean;
  /** Parse errors if any */
  errors: IMolangError[];
}

/**
 * A Molang parse error
 */
export interface IMolangError {
  message: string;
  start: number;
  end: number;
}

export interface IMolangQueryInfo {
  name: string;
  description: string;
  /** Return type as reported by the engine (e.g. "float"), or "Float" when unknown */
  returns: string;
  minArgs: number;
  maxArgs?: number;
  /** Engine version ranges in which the query is available */
  availability: IKnowledgeVersionRange[];
}

export interface IMolangMathInfo {
  name: string;
  description: string;
  syntax: string;
  minArgs: number;
  maxArgs?: number;
}

export function buildMolangQueryInfos(knowledge: IBedrockKnowledge = getBedrockKnowledge()): IMolangQueryInfo[] {
  return knowledge.molang.queries.map((q) => ({
    name: q.name,
    description: q.description,
    returns: q.returnType ?? "Float",
    minArgs: q.minArgs,
    maxArgs: q.maxArgs,
    availability: q.availability,
  }));
}

export function buildMolangMathInfos(knowledge: IBedrockKnowledge = getBedrockKnowledge()): IMolangMathInfo[] {
  return knowledge.molang.math.map((m) => {
    const doc = getMolangMathDoc(m.name, m.minArgs, m.maxArgs);
    return {
      name: m.name,
      description: doc?.description ?? m.description,
      syntax: doc ? (doc.params.length ? `${m.name}(${doc.params.join(", ")})` : m.name) : formatMolangSignature(m),
      minArgs: m.minArgs,
      maxArgs: m.maxArgs,
    };
  });
}

/**
 * Molang queries known to the engine for the active Bedrock channel.
 * The array instance is stable; its contents are refreshed in place when the knowledge changes.
 */
export const MOLANG_QUERIES: IMolangQueryInfo[] = buildMolangQueryInfos();

/**
 * Molang math functions known to the engine for the active Bedrock channel.
 */
export const MOLANG_MATH: IMolangMathInfo[] = buildMolangMathInfos();

onDidChangeBedrockKnowledge((knowledge) => {
  MOLANG_QUERIES.splice(0, MOLANG_QUERIES.length, ...buildMolangQueryInfos(knowledge));
  MOLANG_MATH.splice(0, MOLANG_MATH.length, ...buildMolangMathInfos(knowledge));
});

/**
 * Molang parser
 */
export class MolangParser {
  /**
   * Parse a Molang expression
   */
  public parse(expression: string): IParsedMolang {
    const tokens = this.tokenize(expression);
    const result: IParsedMolang = {
      text: expression,
      tokens,
      queries: [],
      variables: [],
      temps: [],
      mathFunctions: [],
      isValid: true,
      errors: [],
    };

    // Extract categorized identifiers
    for (const token of tokens) {
      if (token.fullIdentifier) {
        switch (token.type) {
          case "query":
            result.queries.push(token.fullIdentifier);
            break;
          case "variable":
            result.variables.push(token.fullIdentifier);
            break;
          case "temp":
            result.temps.push(token.fullIdentifier);
            break;
          case "math":
            result.mathFunctions.push(token.fullIdentifier);
            break;
        }
      }
    }

    // Basic validation
    result.errors = this.validate(tokens);
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Tokenize a Molang expression
   */
  private tokenize(expression: string): IMolangToken[] {
    const tokens: IMolangToken[] = [];
    let i = 0;

    while (i < expression.length) {
      const char = expression[i];
      const remaining = expression.slice(i);

      // Whitespace
      if (/\s/.test(char)) {
        const match = remaining.match(/^\s+/);
        if (match) {
          i += match[0].length;
          continue;
        }
      }

      // Number
      if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(expression[i + 1] || ""))) {
        const match = remaining.match(/^[0-9]*\.?[0-9]+/);
        if (match) {
          tokens.push({
            type: "number",
            value: match[0],
            start: i,
            end: i + match[0].length,
          });
          i += match[0].length;
          continue;
        }
      }

      // String literal
      if (char === "'") {
        const end = expression.indexOf("'", i + 1);
        if (end !== -1) {
          tokens.push({
            type: "string",
            value: expression.slice(i, end + 1),
            start: i,
            end: end + 1,
          });
          i = end + 1;
          continue;
        }
      }

      // Arrow operator
      if (remaining.startsWith("->")) {
        tokens.push({ type: "arrow", value: "->", start: i, end: i + 2 });
        i += 2;
        continue;
      }

      // Multi-character operators
      const operators = ["==", "!=", ">=", "<=", "&&", "||", "??"];
      let foundOp = false;
      for (const op of operators) {
        if (remaining.startsWith(op)) {
          tokens.push({ type: "operator", value: op, start: i, end: i + op.length });
          i += op.length;
          foundOp = true;
          break;
        }
      }
      if (foundOp) continue;

      // Single character operators
      if ("+-*/%<>=!".includes(char)) {
        tokens.push({ type: "operator", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }

      // Punctuation
      if (char === "(") {
        tokens.push({ type: "parenthesis", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ")") {
        tokens.push({ type: "parenthesis", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "[") {
        tokens.push({ type: "bracket", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "]") {
        tokens.push({ type: "bracket", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "{") {
        tokens.push({ type: "brace", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "}") {
        tokens.push({ type: "brace", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ",") {
        tokens.push({ type: "comma", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ";") {
        tokens.push({ type: "semicolon", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ":") {
        tokens.push({ type: "colon", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "?") {
        tokens.push({ type: "questionmark", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ".") {
        tokens.push({ type: "dot", value: char, start: i, end: i + 1 });
        i++;
        continue;
      }

      // Identifier (query, variable, temp, math, context, etc.)
      if (/[a-zA-Z_]/.test(char)) {
        const match = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (match) {
          const identifier = match[0];
          const start = i;
          i += identifier.length;

          // Check for namespace prefix and full identifier
          let fullIdentifier = identifier;
          if (expression[i] === ".") {
            // Look for the rest: query.is_baby, math.sin, etc.
            const restMatch = expression.slice(i).match(/^\.[a-zA-Z_][a-zA-Z0-9_]*/);
            if (restMatch) {
              fullIdentifier += restMatch[0];
              i += restMatch[0].length;
            }
          }

          // Determine token type
          let type: MolangTokenType = "identifier";
          const prefix = identifier.toLowerCase();
          if (prefix === "query" || prefix === "q") type = "query";
          else if (prefix === "variable" || prefix === "v") type = "variable";
          else if (prefix === "temp" || prefix === "t") type = "temp";
          else if (prefix === "context" || prefix === "c") type = "context";
          else if (prefix === "math") type = "math";
          else if (prefix === "geometry") type = "geometry";
          else if (prefix === "material") type = "material";
          else if (prefix === "texture") type = "texture";
          else if (prefix === "array") type = "array";
          else if (["return", "loop", "for_each", "break", "continue", "this"].includes(identifier.toLowerCase())) {
            type = "keyword";
          }

          tokens.push({
            type,
            value: identifier,
            start,
            end: i,
            fullIdentifier: type !== "identifier" && type !== "keyword" ? fullIdentifier : undefined,
          });
          continue;
        }
      }

      // Unknown character
      tokens.push({ type: "unknown", value: char, start: i, end: i + 1 });
      i++;
    }

    return tokens;
  }

  /**
   * Basic validation of tokens
   */
  private validate(tokens: IMolangToken[]): IMolangError[] {
    const errors: IMolangError[] = [];

    // Check for balanced parentheses
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (const token of tokens) {
      if (token.type === "parenthesis") {
        if (token.value === "(") parenDepth++;
        else parenDepth--;
      }
      if (token.type === "bracket") {
        if (token.value === "[") bracketDepth++;
        else bracketDepth--;
      }
      if (token.type === "brace") {
        if (token.value === "{") braceDepth++;
        else braceDepth--;
      }

      if (parenDepth < 0) {
        errors.push({ message: "Unmatched closing parenthesis", start: token.start, end: token.end });
        parenDepth = 0;
      }
      if (bracketDepth < 0) {
        errors.push({ message: "Unmatched closing bracket", start: token.start, end: token.end });
        bracketDepth = 0;
      }
      if (braceDepth < 0) {
        errors.push({ message: "Unmatched closing brace", start: token.start, end: token.end });
        braceDepth = 0;
      }
    }

    if (parenDepth > 0) {
      errors.push({ message: `Missing ${parenDepth} closing parenthesis`, start: 0, end: 0 });
    }
    if (bracketDepth > 0) {
      errors.push({ message: `Missing ${bracketDepth} closing bracket`, start: 0, end: 0 });
    }
    if (braceDepth > 0) {
      errors.push({ message: `Missing ${braceDepth} closing brace`, start: 0, end: 0 });
    }

    // Check for unknown tokens
    for (const token of tokens) {
      if (token.type === "unknown") {
        errors.push({ message: `Unknown character: ${token.value}`, start: token.start, end: token.end });
      }
    }

    return errors;
  }

  /**
   * Get cursor context in an expression
   */
  public getCursorContext(
    expression: string,
    offset: number
  ): {
    tokenAtCursor: IMolangToken | null;
    prefix: string;
    inFunction: boolean;
    functionName: string | null;
  } {
    const parsed = this.parse(expression);

    let tokenAtCursor: IMolangToken | null = null;
    for (const token of parsed.tokens) {
      if (offset >= token.start && offset <= token.end) {
        tokenAtCursor = token;
        break;
      }
    }

    // Determine prefix being typed
    let prefix = "";
    if (tokenAtCursor) {
      prefix = expression.slice(tokenAtCursor.start, offset);
    }

    // Check if we're inside a function call
    let inFunction = false;
    let functionName: string | null = null;
    let depth = 0;

    for (let i = offset - 1; i >= 0; i--) {
      if (expression[i] === ")") depth++;
      else if (expression[i] === "(") {
        if (depth === 0) {
          inFunction = true;
          // Find function name before the paren
          const beforeParen = expression.slice(0, i);
          const match = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_.]*)\s*$/);
          if (match) {
            functionName = match[1];
          }
          break;
        }
        depth--;
      }
    }

    return { tokenAtCursor, prefix, inFunction, functionName };
  }
}

// Singleton instance
export const molangParser = new MolangParser();
