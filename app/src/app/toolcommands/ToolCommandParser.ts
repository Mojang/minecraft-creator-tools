// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToolCommandParser - Parse and tokenize ToolCommand strings
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Handles parsing of command strings in the format:
 *   /commandName arg1 arg2 --flag value --boolFlag
 *
 * PARSING RULES:
 * 1. Commands start with / (optional, stripped during parsing)
 * 2. Positional arguments are space-separated
 * 3. Flags start with -- or - (for short names)
 * 4. Boolean flags have no value
 * 5. String array flags use comma-separated values
 * 6. Quoted strings preserve spaces
 *
 * AUTOCOMPLETE:
 * The parser provides completion suggestions based on:
 * - Cursor position in the input
 * - Available commands in the registry
 * - Argument autocomplete providers
 * - Flag names and values
 */

import type { IToolCommand } from "./IToolCommand";
import { type ToolCommandScope } from "./IToolCommand";
import type { IToolCommandContext } from "./IToolCommandContext";

/**
 * Result of parsing a command string.
 */
export interface ParsedToolCommand {
  /** The command name (without leading /) */
  commandName: string;

  /** Positional arguments */
  args: string[];

  /** Flag values keyed by flag name (without --) */
  flags: Record<string, string | boolean | string[]>;

  /** The original input text */
  originalText: string;
}

/**
 * Token from command parsing.
 */
interface CommandToken {
  type: "command" | "arg" | "flag" | "flagValue";
  value: string;
  start: number;
  end: number;
}

/**
 * Parser for ToolCommand strings.
 */
export class ToolCommandParser {
  /**
   * Parse a command string into structured parts.
   * @param text The command string to parse
   * @returns Parsed command, or undefined if invalid
   */
  static parse(text: string): ParsedToolCommand | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;

    // Remove leading / if present
    const commandText = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    if (!commandText) return undefined;

    const tokens = this.tokenize(commandText);
    if (tokens.length === 0) return undefined;

    const commandName = tokens[0].value;
    const args: string[] = [];
    const flags: Record<string, string | boolean | string[]> = {};

    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];

      if (token.type === "flag") {
        const flagName = token.value.replace(/^-+/, "");

        // Check if next token is a value or another flag
        if (i + 1 < tokens.length && tokens[i + 1].type === "flagValue") {
          const valueToken = tokens[i + 1];
          // Check for comma-separated values
          if (valueToken.value.includes(",")) {
            flags[flagName] = valueToken.value.split(",").map((v) => v.trim());
          } else {
            flags[flagName] = valueToken.value;
          }
          i += 2;
        } else {
          // Boolean flag
          flags[flagName] = true;
          i++;
        }
      } else if (token.type === "arg") {
        args.push(token.value);
        i++;
      } else {
        i++;
      }
    }

    return {
      commandName,
      args,
      flags,
      originalText: text,
    };
  }

  /**
   * Tokenize a command string.
   */
  private static tokenize(text: string): CommandToken[] {
    const tokens: CommandToken[] = [];
    let i = 0;
    let isFirstToken = true;
    let expectingFlagValue = false;

    while (i < text.length) {
      // Skip whitespace
      while (i < text.length && /\s/.test(text[i])) {
        i++;
      }
      if (i >= text.length) break;

      const start = i;

      // Check for quoted string
      if (text[i] === '"' || text[i] === "'") {
        const quote = text[i];
        i++;
        while (i < text.length && text[i] !== quote) {
          if (text[i] === "\\" && i + 1 < text.length) {
            i += 2;
          } else {
            i++;
          }
        }
        if (i < text.length) i++; // Skip closing quote

        const value = text.slice(start + 1, i - 1).replace(/\\(.)/g, "$1");
        tokens.push({
          type: expectingFlagValue ? "flagValue" : isFirstToken ? "command" : "arg",
          value,
          start,
          end: i,
        });
        expectingFlagValue = false;
        isFirstToken = false;
        continue;
      }

      // Check for flag
      if (text[i] === "-") {
        let flagEnd = i;
        // Skip -- or -
        while (flagEnd < text.length && text[flagEnd] === "-") {
          flagEnd++;
        }
        // Read flag name
        while (flagEnd < text.length && /[a-zA-Z0-9_-]/.test(text[flagEnd])) {
          flagEnd++;
        }

        tokens.push({
          type: "flag",
          value: text.slice(i, flagEnd),
          start,
          end: flagEnd,
        });
        i = flagEnd;
        expectingFlagValue = true;
        isFirstToken = false;
        continue;
      }

      // Regular token (command name, arg, or flag value)
      while (i < text.length && !/\s/.test(text[i])) {
        i++;
      }

      const value = text.slice(start, i);
      tokens.push({
        type: expectingFlagValue ? "flagValue" : isFirstToken ? "command" : "arg",
        value,
        start,
        end: i,
      });
      expectingFlagValue = false;
      isFirstToken = false;
    }

    return tokens;
  }

  /**
   * Get autocomplete suggestions for a partial command.
   * @param text The partial command text
   * @param cursorPos Cursor position in the text
   * @param registry The command registry to search
   * @param context Execution context
   */
  static async getCompletions(
    text: string,
    cursorPos: number,
    registry: {
      get: (name: string) => IToolCommand | undefined;
      getCommandNames: (scope?: ToolCommandScope) => string[];
      getAll: (scope?: ToolCommandScope) => IToolCommand[];
    },
    context: IToolCommandContext
  ): Promise<string[]> {
    const beforeCursor = text.slice(0, cursorPos);
    const trimmed = beforeCursor.trim();

    // Get available command names, filtering by scope and project availability
    const getAvailableNames = (): string[] => {
      const scope = context.scope as ToolCommandScope | undefined;
      const all = registry.getAll(scope);
      return all
        .filter((c) => !c.metadata.requiresProject || context.project)
        .map((c) => c.metadata.name);
    };

    // Handle empty or just /
    if (!trimmed || trimmed === "/") {
      return getAvailableNames().map((n) => "/" + n);
    }

    // Remove leading /
    const commandText = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    const tokens = this.tokenize(commandText);

    if (tokens.length === 0) {
      return getAvailableNames().map((n) => "/" + n);
    }

    // Get current token at cursor
    const lastToken = tokens[tokens.length - 1];
    const isCompletingLastToken = cursorPos >= (trimmed.startsWith("/") ? 1 : 0) + lastToken.start;

    // If ending with a space, we're completing a new token (not the last one)
    const isNewToken = beforeCursor.endsWith(" ");

    // If completing the command name (only one token AND not followed by a space)
    if (tokens.length === 1 && isCompletingLastToken && !isNewToken) {
      const partial = lastToken.value.toLowerCase();
      return getAvailableNames()
        .filter((n) => n.toLowerCase().startsWith(partial))
        .map((n) => "/" + n);
    }

    // Get the command
    const command = registry.get(tokens[0].value);
    if (!command) {
      return [];
    }

    // If completing a flag name
    if (lastToken.type === "flag" && isCompletingLastToken && !isNewToken) {
      const flagDefs = command.metadata.flags || [];
      const partial = lastToken.value.replace(/^-+/, "").toLowerCase();
      return flagDefs.filter((f) => f.name.toLowerCase().startsWith(partial)).map((f) => "--" + f.name);
    }

    // If we just typed a flag, suggest its values
    if (lastToken.type === "flag" && isNewToken) {
      const flagName = lastToken.value.replace(/^-+/, "");
      const flagDef = command.metadata.flags?.find(
        (f) => f.name.toLowerCase() === flagName.toLowerCase() || f.shortName === flagName
      );
      if (flagDef) {
        if (flagDef.choices) {
          return flagDef.choices;
        }
        if (flagDef.autocompleteProvider) {
          return flagDef.autocompleteProvider("", context);
        }
      }
      return [];
    }

    // If completing a flag value
    if (lastToken.type === "flagValue" && isCompletingLastToken) {
      // Find the flag this value belongs to
      const flagToken = tokens[tokens.length - 2];
      if (flagToken?.type === "flag") {
        const flagName = flagToken.value.replace(/^-+/, "");
        const flagDef = command.metadata.flags?.find(
          (f) => f.name.toLowerCase() === flagName.toLowerCase() || f.shortName === flagName
        );
        if (flagDef) {
          if (flagDef.choices) {
            return flagDef.choices.filter((c) => c.toLowerCase().startsWith(lastToken.value.toLowerCase()));
          }
          if (flagDef.autocompleteProvider) {
            return flagDef.autocompleteProvider(lastToken.value, context);
          }
        }
      }
      return [];
    }

    // Completing a positional argument
    const argTokens = tokens.filter((t) => t.type === "arg");
    const argIndex = isNewToken ? argTokens.length : argTokens.length - 1;
    const partial = isNewToken ? "" : lastToken.value;

    // Use command's getCompletions if available
    if (command.getCompletions) {
      const argValues = argTokens.map((t) => t.value);
      const completions = await command.getCompletions(context, argValues, partial, argIndex);
      if (completions.length > 0) {
        return completions;
      }
      // Fall through to argument metadata for hints
    }

    // Fall back to argument metadata
    const argDef = command.metadata.arguments?.[argIndex];
    if (argDef) {
      if (argDef.choices) {
        return argDef.choices.filter((c) => c.toLowerCase().startsWith(partial.toLowerCase()));
      }
      if (argDef.autocompleteProvider) {
        return argDef.autocompleteProvider(partial, context);
      }
      // No specific completions — return a usage hint so the UI can show what's expected
      if (!partial) {
        return [`<${argDef.name}>`];
      }
    }

    return [];
  }

  /**
   * Format a command with arguments for display/execution.
   */
  static format(commandName: string, args: string[], flags: Record<string, string | boolean | string[]>): string {
    const parts = ["/" + commandName];

    for (const arg of args) {
      parts.push(arg.includes(" ") ? `"${arg}"` : arg);
    }

    for (const [key, value] of Object.entries(flags)) {
      if (value === true) {
        parts.push(`--${key}`);
      } else if (Array.isArray(value)) {
        parts.push(`--${key}`, value.join(","));
      } else if (value !== false) {
        parts.push(`--${key}`, value.includes(" ") ? `"${value}"` : value);
      }
    }

    return parts.join(" ");
  }
}
