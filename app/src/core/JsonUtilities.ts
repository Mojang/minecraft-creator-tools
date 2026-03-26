// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * # JsonUtilities - Comment-Preserving JSON Handling
 *
 * This module provides centralized utilities for parsing and stringifying JSON
 * while preserving C-style comments (// and /* *\/).
 *
 * ## Key Concepts
 *
 * - Uses the `comment-json` library which stores comments as Symbol properties
 * - Comments are attached to the parsed object and survive mutations
 * - To preserve comments during round-trip, you must:
 *   1. Parse once with `parseJsonWithComments()`
 *   2. Mutate the returned object (don't create a new one)
 *   3. Stringify with `stringifyJsonWithComments()`
 *
 * ## Important Limitations
 *
 * - Array reassignment loses comments - use `commentJson.assign()` or in-place mutations
 * - Copying objects with spread/Object.assign loses comment symbols
 * - The parsed object must be retained to preserve comments
 *
 * ## Usage Pattern
 *
 * ```typescript
 * // Parse and cache the result
 * const obj = JsonUtilities.parseJsonWithComments(jsonString);
 *
 * // Modify properties directly on the parsed object
 * obj.someProperty = "new value";
 *
 * // Stringify preserves comments
 * const output = JsonUtilities.stringifyJsonWithComments(obj);
 * ```
 */

import * as commentJson from "comment-json";
import Utilities from "./Utilities";

// Re-export types from comment-json for convenience (as type-only exports)
export type { CommentJSONValue, CommentObject, CommentToken } from "comment-json";

// Re-export CommentArray as a value (it's a class)
export const CommentArrayClass = commentJson.CommentArray;

/**
 * Parses a JSON string while preserving comments.
 * The returned object contains Symbol properties that store comment metadata.
 *
 * @param jsonString The JSON string to parse (may contain // and /* *\/ comments)
 * @param fixContent If true, applies Utilities.fixJsonContentForCommentJson to handle
 *                   trailing commas and other non-standard JSON before parsing
 * @returns The parsed object with comment metadata preserved as Symbol properties
 */
export function parseJsonWithComments(jsonString: string, fixContent: boolean = true): commentJson.CommentJSONValue {
  if (fixContent) {
    jsonString = Utilities.fixJsonContentForCommentJson(jsonString);
  }

  return commentJson.parse(jsonString);
}

/**
 * Stringifies an object to JSON, preserving any comments stored as Symbol properties.
 *
 * @param value The object to stringify (should be one returned from parseJsonWithComments
 *              or created with comment-json utilities to have comments)
 * @param space Indentation (default: 2 spaces)
 * @returns JSON string with comments restored in their original positions
 */
export function stringifyJsonWithComments(value: unknown, space: string | number = 2): string {
  return commentJson.stringify(value, null, space);
}

/**
 * Assigns properties from source to target while preserving comment metadata.
 * Use this instead of Object.assign or spread to maintain comments.
 *
 * @param target The target object to assign properties to
 * @param source The source object to copy properties from
 * @param keys Optional array of keys to assign. If not provided, all keys are assigned.
 * @returns The target object with properties and comments from source
 */
export function assignJsonPreservingComments<T, S>(target: T, source: S, keys?: readonly (string | number)[]): T {
  return commentJson.assign(target, source, keys);
}

/**
 * Checks if two JSON strings are semantically equal (same data, ignoring whitespace/formatting).
 * This does NOT consider comments - it only compares the actual data values.
 *
 * @param contentA First JSON string
 * @param contentB Second JSON string
 * @returns true if the JSON data is semantically equivalent
 */
export function jsonContentsSemanticallyEqual(contentA: string, contentB: string): boolean {
  try {
    // Parse without preserving comments for semantic comparison
    const objA = commentJson.parse(contentA, null, true); // true = remove comments
    const objB = commentJson.parse(contentB, null, true);

    return Utilities.consistentStringify(objA) === Utilities.consistentStringify(objB);
  } catch (e) {
    // If parsing fails, fall back to string comparison
    return contentA === contentB;
  }
}

/**
 * Compares two JSON objects for semantic equality, ignoring comment metadata.
 * Use this when you have already-parsed objects and want to check if their
 * actual data (not comments) is the same.
 *
 * @param objA First object (may have comment metadata)
 * @param objB Second object (may have comment metadata)
 * @returns true if the JSON data is semantically equivalent
 */
export function jsonObjectsSemanticallyEqual(objA: unknown, objB: unknown): boolean {
  try {
    return Utilities.consistentStringify(objA) === Utilities.consistentStringify(objB);
  } catch (e) {
    return false;
  }
}

/**
 * Merges new values into an existing comment-json object, preserving comments.
 * This is the recommended way to update a JSON object while keeping its comments.
 *
 * @param original The original parsed object with comments
 * @param updates An object containing the properties to update
 * @returns The original object with updates applied (mutates in place)
 */
export function mergeJsonPreservingComments<T extends object>(original: T, updates: Partial<T>): T {
  // Use comment-json's assign to copy properties while preserving comment symbols
  for (const key of Object.keys(updates) as (keyof T)[]) {
    // Guard against prototype pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const value = updates[key];
    if (value !== undefined) {
      // For nested objects, we need to recursively merge
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof original[key] === "object" &&
        original[key] !== null &&
        !Array.isArray(original[key])
      ) {
        mergeJsonPreservingComments(original[key] as object, value as object);
      } else {
        // For primitives and arrays, just assign
        // Note: Array assignment will lose comments on the array itself
        // For arrays, consider using CommentArray methods like splice/push
        (original as any)[key] = value;
      }
    }
  }

  return original;
}

/**
 * Creates a deep clone of a comment-json object, preserving comments.
 * Use this when you need a copy that retains comment metadata.
 *
 * @param obj The object to clone
 * @returns A new object with the same data and comments
 */
export function cloneJsonWithComments<T>(obj: T): T {
  // The simplest way to clone while preserving comments is to stringify and re-parse
  const jsonString = commentJson.stringify(obj, null, 2);
  return commentJson.parse(jsonString) as T;
}

/**
 * Checks if an object was parsed with comment-json and contains comment metadata.
 *
 * @param obj The object to check
 * @returns true if the object has comment Symbol properties
 */
export function hasCommentMetadata(obj: unknown): boolean {
  if (obj === null || typeof obj !== "object") {
    return false;
  }

  // Check for any comment-json symbols
  const symbols = Object.getOwnPropertySymbols(obj);
  return symbols.some((sym) => sym.description?.startsWith("before") || sym.description?.startsWith("after"));
}

/**
 * Default export providing all JsonUtilities functions as a namespace-like object.
 * This allows both `import JsonUtilities from "./JsonUtilities"` and
 * `import { parseJsonWithComments } from "./JsonUtilities"` usage patterns.
 */
const JsonUtilities = {
  parseJsonWithComments,
  stringifyJsonWithComments,
  assignJsonPreservingComments,
  mergeJsonPreservingComments,
  jsonContentsSemanticallyEqual,
  jsonObjectsSemanticallyEqual,
  cloneJsonWithComments,
  hasCommentMetadata,
  CommentArrayClass,
};

export default JsonUtilities;
