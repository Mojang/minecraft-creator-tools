// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** An explicit file option must never become folder discovery because its value is falsy. */
export function hasInputFileOption<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}

export function isValidInputFileOption(value: unknown): value is string | undefined {
  return !hasInputFileOption(value) || (typeof value === "string" && value.length > 0);
}

export const INVALID_INPUT_FILE_OPTION_MESSAGE =
  "The --if/--input-file option requires a non-empty package path. Provide the package with --if <path>.";
