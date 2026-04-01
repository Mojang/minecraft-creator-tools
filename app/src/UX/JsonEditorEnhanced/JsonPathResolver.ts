/**
 * JsonPathResolver.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This utility class provides JSON path resolution capabilities for the Monaco editor.
 * It parses JSON content and provides utilities for:
 *
 * 1. Finding the JSON path at a cursor position (offset)
 * 2. Finding the offset for a given JSON path
 * 3. Extracting key/value information at positions
 * 4. Identifying context (in array, in object, property name vs value)
 *
 * KEY CONCEPTS:
 * - JSON Path: An array of strings representing the path through the JSON tree
 *   e.g., ["minecraft:entity", "components", "minecraft:type_family"]
 * - Offset: A character position in the JSON text (0-indexed)
 * - Context: Whether the cursor is in a key position, value position, or structural position
 *
 * COORDINATE SYSTEM:
 * - Uses Monaco's 1-indexed line/column positions where needed
 * - Internally uses 0-indexed character offsets for parsing
 *
 * RELATED FILES:
 * - FormDefinitionCache.ts - Uses paths to look up field definitions
 * - MinecraftHoverProvider.ts - Uses paths to provide hover content
 * - MinecraftCompletionProvider.ts - Uses paths to provide contextual completions
 */

import * as monaco from "monaco-editor";
import Utilities from "../../core/Utilities";

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
 * Utility class for resolving JSON paths and positions
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
        this.cachedParsed = JSON.parse(Utilities.fixJsonContent(text));
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
          // Entering an object - always push to maintain proper nesting balance.
          // Previously, keyless containers (objects inside arrays) were skipped,
          // causing keys inside them to be misidentified.
          if (contextStack.length > 0 && currentKey !== null) {
            result.path.push(currentKey);
          }
          contextStack.push({
            type: "object",
            key: currentKey,
            index: 0,
            startOffset: token.start,
          });
          currentKey = null;
          sawColon = false;
          break;

        case "closeBrace":
          if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "object") {
            const entry = contextStack.pop()!;
            // Only pop path if this was a keyed entry (anonymous objects in arrays don't add to path)
            if (entry.key !== null && result.path.length > 0) {
              result.path.pop();
            }
          }
          break;

        case "openBracket":
          // Entering an array
          if (contextStack.length > 0 && currentKey !== null) {
            result.path.push(currentKey);
          }
          contextStack.push({
            type: "array",
            key: currentKey,
            index: 0,
            startOffset: token.start,
          });
          currentKey = null;
          sawColon = false;
          break;

        case "closeBracket":
          if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "array") {
            const entry = contextStack.pop()!;
            // Only pop path if this was a keyed entry (anonymous arrays don't add to path)
            if (entry.key !== null && result.path.length > 0) {
              result.path.pop();
            }
          }
          break;

        case "colon":
          sawColon = true;
          break;

        case "comma":
          // Increment array index
          if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "array") {
            contextStack[contextStack.length - 1].index++;
          }
          sawColon = false;
          currentKey = null;
          break;

        case "string":
          lastStringToken = token;
          // Check if this is a key or value
          if (contextStack.length > 0) {
            const context = contextStack[contextStack.length - 1];
            if (context.type === "object" && !sawColon) {
              // This is a property key
              currentKey = token.value.slice(1, -1); // Remove quotes
              if (isInToken) {
                result.inKeyPosition = true;
                result.tokenStart = token.start;
                result.tokenEnd = token.end;
              }
            } else if (sawColon || context.type === "array") {
              // This is a value
              if (isInToken) {
                result.inValuePosition = true;
                result.tokenStart = token.start;
                result.tokenEnd = token.end;
                result.currentValue = token.value.slice(1, -1);
              }
            }
          }
          break;

        case "number":
        case "boolean":
        case "null":
          if (isInToken) {
            result.inValuePosition = true;
            result.tokenStart = token.start;
            result.tokenEnd = token.end;
            result.currentValue = this.parseValue(token);
          }
          break;
      }

      // If we're in this token, capture context
      if (isInToken) {
        if (contextStack.length > 0) {
          const ctx = contextStack[contextStack.length - 1];
          result.parentType = ctx.type;
          if (ctx.type === "array") {
            result.inArray = true;
            result.arrayIndex = ctx.index;
          }
        }
        if (currentKey !== null) {
          result.currentKey = currentKey;
        }
      }
    }

    // Finalize path with current context
    if (currentKey !== null && sawColon) {
      result.path.push(currentKey);
    }

    // Add array index to path if in array
    if (contextStack.length > 0) {
      const lastCtx = contextStack[contextStack.length - 1];
      if (lastCtx.type === "array") {
        result.path.push(String(lastCtx.index));
      }
    }

    return result;
  }

  /**
   * Get path at a Monaco Position
   */
  public getPathAtPosition(model: monaco.editor.ITextModel, position: monaco.Position): IJsonPathResult {
    const text = model.getValue();
    const offset = model.getOffsetAt(position);
    return this.getPathAtOffset(text, offset);
  }

  /**
   * Find the offset range for a given JSON path
   */
  public findPathOffset(text: string, targetPath: string[]): { start: number; end: number } | null {
    this.updateText(text);

    const contextStack: IContextEntry[] = [];
    let currentKey: string | null = null;
    let sawColon = false;
    let pathMatch = false;
    let matchStart = 0;
    let depth = 0;

    for (const token of this.cachedTokens) {
      switch (token.type) {
        case "openBrace":
        case "openBracket":
          // Track nesting depth within matched path for ALL containers
          if (pathMatch) {
            depth++;
          }

          // Always push to context stack to maintain proper nesting balance.
          // Previously, keyless containers (objects/arrays inside arrays) were
          // skipped, causing stack imbalance that corrupted path resolution
          // for all subsequent content in the file.
          contextStack.push({
            type: token.type === "openBrace" ? "object" : "array",
            key: currentKey,
            index: 0,
            startOffset: token.start,
          });

          // Only check for path match when we have a key (or at root level)
          if (currentKey !== null || contextStack.length <= 1) {
            const currentPath = this.buildPath(contextStack);
            if (this.pathsEqual(currentPath, targetPath)) {
              pathMatch = true;
              matchStart = token.start;
              depth = 0;
            }
          }

          currentKey = null;
          sawColon = false;
          break;

        case "closeBrace":
        case "closeBracket":
          if (pathMatch && depth === 0) {
            return { start: matchStart, end: token.end };
          }
          if (pathMatch) {
            depth--;
          }
          if (contextStack.length > 0) {
            contextStack.pop();
          }
          break;

        case "colon":
          sawColon = true;
          break;

        case "comma":
          if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "array") {
            contextStack[contextStack.length - 1].index++;
          }
          sawColon = false;
          currentKey = null;
          break;

        case "string":
          if (contextStack.length > 0 && contextStack[contextStack.length - 1].type === "object" && !sawColon) {
            currentKey = token.value.slice(1, -1);

            // Check if this completes target path
            const testPath = [...this.buildPath(contextStack), currentKey];
            if (this.pathsEqual(testPath, targetPath)) {
              // Find the value start
              for (let i = this.cachedTokens.indexOf(token) + 1; i < this.cachedTokens.length; i++) {
                const nextToken = this.cachedTokens[i];
                if (nextToken.type !== "colon" && nextToken.type !== "whitespace") {
                  // Find the end of this value
                  return this.findValueEnd(i);
                }
              }
            }
          }
          break;
      }
    }

    return null;
  }

  /**
   * Get the value at a specific JSON path
   */
  public getValueAtPath(path: string[]): unknown {
    if (!this.cachedParsed || path.length === 0) {
      return this.cachedParsed;
    }

    let current: unknown = this.cachedParsed;
    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Tokenize JSON text into tokens
   */
  private tokenize(text: string): IJsonToken[] {
    const tokens: IJsonToken[] = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        const start = i;
        while (i < text.length && /\s/.test(text[i])) i++;
        tokens.push({ type: "whitespace", value: text.slice(start, i), start, end: i });
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

      // String
      if (char === '"') {
        const start = i;
        i++; // Skip opening quote
        while (i < text.length) {
          if (text[i] === '"' && text[i - 1] !== "\\") {
            i++; // Include closing quote
            break;
          }
          i++;
        }
        tokens.push({ type: "string", value: text.slice(start, i), start, end: i });
        continue;
      }

      // Number
      if (/[-\d]/.test(char)) {
        const start = i;
        if (char === "-") i++;
        while (i < text.length && /[\d.eE+-]/.test(text[i])) i++;
        tokens.push({ type: "number", value: text.slice(start, i), start, end: i });
        continue;
      }

      // Boolean or null
      if (text.slice(i, i + 4) === "true") {
        tokens.push({ type: "boolean", value: "true", start: i, end: i + 4 });
        i += 4;
        continue;
      }
      if (text.slice(i, i + 5) === "false") {
        tokens.push({ type: "boolean", value: "false", start: i, end: i + 5 });
        i += 5;
        continue;
      }
      if (text.slice(i, i + 4) === "null") {
        tokens.push({ type: "null", value: "null", start: i, end: i + 4 });
        i += 4;
        continue;
      }

      // Unknown character - skip
      tokens.push({ type: "unknown", value: char, start: i, end: i + 1 });
      i++;
    }

    return tokens;
  }

  /**
   * Parse a token's value
   */
  private parseValue(token: IJsonToken): unknown {
    switch (token.type) {
      case "string":
        return token.value.slice(1, -1);
      case "number":
        return parseFloat(token.value);
      case "boolean":
        return token.value === "true";
      case "null":
        return null;
      default:
        return undefined;
    }
  }

  /**
   * Build current path from context stack
   */
  private buildPath(stack: IContextEntry[]): string[] {
    const path: string[] = [];
    for (let i = 1; i < stack.length; i++) {
      const entry = stack[i];
      if (entry.key !== null) {
        path.push(entry.key);
      }
      if (stack[i - 1]?.type === "array") {
        path.push(String(stack[i - 1].index));
      }
    }
    return path;
  }

  /**
   * Check if two paths are equal
   */
  private pathsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Find the end of a value starting at token index
   */
  private findValueEnd(startIndex: number): { start: number; end: number } {
    const startToken = this.cachedTokens[startIndex];
    const start = startToken.start;

    if (startToken.type === "openBrace" || startToken.type === "openBracket") {
      // Complex value - find matching close
      let depth = 1;
      const matchType = startToken.type === "openBrace" ? "closeBrace" : "closeBracket";
      const openType = startToken.type;

      for (let i = startIndex + 1; i < this.cachedTokens.length; i++) {
        const t = this.cachedTokens[i];
        if (t.type === openType) depth++;
        else if (t.type === matchType) {
          depth--;
          if (depth === 0) {
            return { start, end: t.end };
          }
        }
      }
    }

    // Simple value
    return { start, end: startToken.end };
  }
}

// Export singleton for shared use
export const jsonPathResolver = new JsonPathResolver();
