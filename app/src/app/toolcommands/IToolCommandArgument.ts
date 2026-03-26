// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { IToolCommandContext } from "./IToolCommandContext";

/**
 * Type of argument value.
 */
export type ToolCommandArgumentType =
  | "string" // Free-form string
  | "number" // Numeric value
  | "boolean" // true/false
  | "path" // File or folder path
  | "choice" // One of predefined choices
  | "identifier"; // Minecraft identifier (namespace:name)

/**
 * Function that provides autocomplete suggestions for an argument.
 *
 * @param partial The partial value typed so far
 * @param context The command execution context
 * @returns Array of completion suggestions
 */
export type AutocompleteProvider = (partial: string, context: IToolCommandContext) => Promise<string[]> | string[];

/**
 * Defines a positional argument for a ToolCommand.
 */
export interface IToolCommandArgument {
  /** Argument name (e.g., 'template', 'name') */
  name: string;

  /** Description for help text */
  description: string;

  /** Argument value type */
  type: ToolCommandArgumentType;

  /** Whether this argument is required */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: string;

  /** Valid choices (for 'choice' type) */
  choices?: string[];

  /**
   * Provider for autocomplete suggestions.
   * If not provided, uses choices if available.
   */
  autocompleteProvider?: AutocompleteProvider;
}

/**
 * Defines a named flag for a ToolCommand (--flag value).
 */
export interface IToolCommandFlag {
  /** Flag name without -- prefix (e.g., 'traits', 'output') */
  name: string;

  /** Short alias (e.g., 't' for --traits, used as -t) */
  shortName?: string;

  /** Description for help text */
  description: string;

  /** Value type */
  type: ToolCommandArgumentType | "stringArray"; // stringArray for comma-separated lists

  /** Whether this flag is required */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: string | boolean | string[];

  /** Valid choices (for 'choice' type) */
  choices?: string[];

  /** Whether this is a boolean flag (no value, presence = true) */
  isBoolean?: boolean;

  /**
   * Provider for autocomplete suggestions.
   */
  autocompleteProvider?: AutocompleteProvider;
}
