// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonPathResolver - Platform-agnostic JSON path resolution
 *
 * This module provides utilities for determining the JSON path at a cursor
 * position, which is fundamental for providing context-aware editor features.
 *
 * Extracted from Monaco's JsonEditorEnhanced/JsonPathResolver.ts to be
 * usable by both VS Code and Monaco editors.
 */

/**
 * Represents the result of resolving a JSON path at a position
 */
export interface IJsonPathResult {
  /** Full path from root to current position */
  path: string[];
  /** The current key being edited (if in key position) */
  currentKey: string | null;
  /** The current value at this position (if resolved) */
  currentValue: unknown;
  /** Whether the cursor is in a key (property name) position */
  inKeyPosition: boolean;
  /** Whether the cursor is in a value position */
  inValuePosition: boolean;
  /** Whether we're inside an array */
  inArray: boolean;
  /** Current array index if in an array */
  arrayIndex: number;
  /** The parent object/array type */
  parentType: "object" | "array" | "root";
  /** Start offset of the current token */
  tokenStart: number;
  /** End offset of the current token */
  tokenEnd: number;
}

/**
 * Token types encountered during parsing
 */
type TokenType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "openBrace"
  | "closeBrace"
  | "openBracket"
  | "closeBracket"
  | "colon"
  | "comma"
  | "whitespace"
  | "unknown";

/**
 * Represents a token in the JSON stream
 */
interface IJsonToken {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

/**
 * Context stack entry for tracking nesting
 */
interface IContextEntry {
  type: "object" | "array";
  key: string | null;
  index: number;
  startOffset: number;
}

/**
 * Platform-agnostic JSON path resolver
 */
export class JsonPathResolver {
  private cachedText: string = "";
  private cachedTokens: IJsonToken[] = [];
  private cachedParsed: unknown = null;

  /**
   * Update the cached JSON text
   */
  public updateText(text: string): void {
    if (text !== this.cachedText) {
      this.cachedText = text;
      this.cachedTokens = this.tokenize(text);
      try {
        this.cachedParsed = JSON.parse(text);
      } catch {
        this.cachedParsed = null;
      }
    }
  }

  /**
   * Get the JSON path at a given offset in the document
   */
  public getPathAtOffset(text: string, offset: number): IJsonPathResult {
    this.updateText(text);

    const result: IJsonPathResult = {
      path: [],
      currentKey: null,
      currentValue: undefined,
      inKeyPosition: false,
      inValuePosition: false,
      inArray: false,
      arrayIndex: -1,
      parentType: "root",
      tokenStart: 0,
      tokenEnd: text.length,
    };

    // Track context as we parse
    const contextStack: IContextEntry[] = [];
    let currentKey: string | null = null;
    let lastStringToken: IJsonToken | null = null;
    let sawColon = false;

    for (const token of this.cachedTokens) {
      // Stop when we reach the target offset
      if (token.start > offset) {
        break;
      }

      // Track if we're currently inside this token
      const isInToken = offset >= token.start && offset <= token.end;

      switch (token.type) {
        case "openBrace":
          if (currentKey !== null) {
            contextStack.push({
              type: "object",
              key: currentKey,
              index: -1,
              startOffset: token.start,
            });
            currentKey = null;
          } else if (contextStack.length > 0) {
            const parent = contextStack[contextStack.length - 1];
            if (parent.type === "array") {
              contextStack.push({
                type: "object",
                key: null,
                index: parent.index,
                startOffset: token.start,
              });
            }
          } else {
            contextStack.push({
              type: "object",
              key: null,
              index: -1,
              startOffset: token.start,
            });
          }
          sawColon = false;
          break;

        case "closeBrace":
          if (contextStack.length > 0) {
            contextStack.pop();
          }
          sawColon = false;
          break;

        case "openBracket":
          if (currentKey !== null) {
            contextStack.push({
              type: "array",
              key: currentKey,
              index: 0,
              startOffset: token.start,
            });
            currentKey = null;
          } else {
            contextStack.push({
              type: "array",
              key: null,
              index: 0,
              startOffset: token.start,
            });
          }
          sawColon = false;
          break;

        case "closeBracket":
          if (contextStack.length > 0) {
            contextStack.pop();
          }
          sawColon = false;
          break;

        case "string":
          lastStringToken = token;
          if (!sawColon && contextStack.length > 0) {
            const parent = contextStack[contextStack.length - 1];
            if (parent.type === "object") {
              // This is likely a key
              currentKey = token.value.slice(1, -1); // Remove quotes

              if (isInToken) {
                result.inKeyPosition = true;
                result.currentKey = currentKey;
                result.tokenStart = token.start;
                result.tokenEnd = token.end;
              }
            } else if (parent.type === "array" && isInToken) {
              result.inValuePosition = true;
              result.inArray = true;
              result.arrayIndex = parent.index;
              result.tokenStart = token.start;
              result.tokenEnd = token.end;
            }
          } else if (sawColon && isInToken) {
            result.inValuePosition = true;
            result.tokenStart = token.start;
            result.tokenEnd = token.end;
          }
          break;

        case "colon":
          sawColon = true;
          if (currentKey !== null) {
            // We have a key, push it to the path for this value
          }
          break;

        case "comma":
          if (contextStack.length > 0) {
            const parent = contextStack[contextStack.length - 1];
            if (parent.type === "array") {
              parent.index++;
            }
          }
          currentKey = null;
          sawColon = false;
          break;

        case "number":
        case "boolean":
        case "null":
          if (isInToken) {
            if (sawColon) {
              result.inValuePosition = true;
            } else if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "array") {
              result.inValuePosition = true;
              result.inArray = true;
            }
            result.tokenStart = token.start;
            result.tokenEnd = token.end;
          }
          break;
      }
    }

    // Build the path from context stack
    for (const ctx of contextStack) {
      if (ctx.key !== null) {
        result.path.push(ctx.key);
      }
      if (ctx.type === "array" && ctx.index >= 0) {
        result.path.push(`[${ctx.index}]`);
      }
    }

    // Add current key if we're in a value position
    if (currentKey !== null && sawColon) {
      result.path.push(currentKey);
    }

    // Set parent type
    if (contextStack.length > 0) {
      result.parentType = contextStack[contextStack.length - 1].type;
      if (result.parentType === "array") {
        result.inArray = true;
        result.arrayIndex = contextStack[contextStack.length - 1].index;
      }
    }

    return result;
  }

  /**
   * Tokenize JSON text
   */
  private tokenize(text: string): IJsonToken[] {
    const tokens: IJsonToken[] = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // String
      if (char === '"') {
        const start = i;
        i++; // Skip opening quote

        while (i < text.length) {
          if (text[i] === "\\") {
            i += 2; // Skip escaped char
          } else if (text[i] === '"') {
            i++; // Skip closing quote
            break;
          } else {
            i++;
          }
        }

        tokens.push({
          type: "string",
          value: text.substring(start, i),
          start,
          end: i,
        });
        continue;
      }

      // Number
      if (char === "-" || (char >= "0" && char <= "9")) {
        const start = i;
        i++;

        while (i < text.length && /[0-9.eE+-]/.test(text[i])) {
          i++;
        }

        tokens.push({
          type: "number",
          value: text.substring(start, i),
          start,
          end: i,
        });
        continue;
      }

      // Structural characters
      if (char === "{") {
        tokens.push({ type: "openBrace", value: "{", start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "}") {
        tokens.push({ type: "closeBrace", value: "}", start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "[") {
        tokens.push({ type: "openBracket", value: "[", start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === "]") {
        tokens.push({ type: "closeBracket", value: "]", start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ":") {
        tokens.push({ type: "colon", value: ":", start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ",") {
        tokens.push({ type: "comma", value: ",", start: i, end: i + 1 });
        i++;
        continue;
      }

      // Keywords (true, false, null)
      if (text.substring(i, i + 4) === "true") {
        tokens.push({ type: "boolean", value: "true", start: i, end: i + 4 });
        i += 4;
        continue;
      }
      if (text.substring(i, i + 5) === "false") {
        tokens.push({ type: "boolean", value: "false", start: i, end: i + 5 });
        i += 5;
        continue;
      }
      if (text.substring(i, i + 4) === "null") {
        tokens.push({ type: "null", value: "null", start: i, end: i + 4 });
        i += 4;
        continue;
      }

      // Unknown character - skip
      i++;
    }

    return tokens;
  }

  /**
   * Get the value at a specific path in parsed JSON
   */
  public getValueAtPath(path: string[]): unknown {
    if (!this.cachedParsed) {
      return undefined;
    }

    let current: unknown = this.cachedParsed;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index
      const arrayMatch = segment.match(/^\[(\d+)\]$/);
      if (arrayMatch) {
        if (!Array.isArray(current)) {
          return undefined;
        }
        const index = parseInt(arrayMatch[1], 10);
        current = current[index];
      } else {
        if (typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[segment];
      }
    }

    return current;
  }

  /**
   * Find the line and column for an offset
   */
  public getLineColumnAtOffset(text: string, offset: number): { line: number; column: number } {
    let line = 1;
    let column = 1;

    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    return { line, column };
  }

  /**
   * Find the offset for a line and column
   */
  public getOffsetAtLineColumn(text: string, line: number, column: number): number {
    let currentLine = 1;
    let currentColumn = 1;

    for (let i = 0; i < text.length; i++) {
      if (currentLine === line && currentColumn === column) {
        return i;
      }

      if (text[i] === "\n") {
        currentLine++;
        currentColumn = 1;
      } else {
        currentColumn++;
      }
    }

    return text.length;
  }
}

// Singleton instance for convenience
export const jsonPathResolver = new JsonPathResolver();
