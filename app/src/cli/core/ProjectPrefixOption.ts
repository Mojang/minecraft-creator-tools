// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** An empty explicit prefix must not silently select every project. Keep valid prefix bytes unchanged. */
export function isValidProjectPrefixOption(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length > 0);
}

export const INVALID_PROJECT_PREFIX_OPTION_MESSAGE =
  "The --psw/--project-starts-with option requires a non-empty prefix. " +
  "Provide --psw <prefix>, or omit it to process all detected projects.";
